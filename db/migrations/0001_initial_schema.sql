-- =============================================================================
-- 0001_initial_schema.sql
--
-- Core schema for ATS Resume Intelligence. Spec section 9, plus the two
-- amendments in docs/DECISIONS.md ADR-006:
--   * score_features   -- persisted feature vector; the simulator and score
--                         explainability are both impossible without it
--   * provenance columns on analyses
--
-- Row-level security is enabled here but policies live in 0002. Enabling RLS
-- with no policy is deny-all, so the tables are never briefly world-readable
-- between migrations.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Enumerated domains (spec section 90) -----------------------------------

create type analysis_mode as enum ('resume_health', 'role_readiness', 'job_match');

create type analysis_status as enum (
  'queued', 'processing', 'parsing', 'analyzing', 'scoring',
  'generating_recommendations', 'completed', 'failed'
);

create type skill_evidence_status as enum ('strong', 'weak', 'missing');

create type priority_level as enum ('high', 'medium', 'low');

create type recommendation_status as enum ('open', 'accepted', 'dismissed', 'applied');

create type resume_status as enum ('uploaded', 'parsing', 'parsed', 'failed');

-- Whether a feature value came from deterministic code or a bounded model
-- classification. docs/MEASUREMENT.md R1/R2 -- this is what makes the rule vs
-- LLM split auditable after the fact rather than a claim in a document.
create type feature_source as enum ('rule', 'llm');

create type score_category as enum (
  'parseability', 'structure', 'skills', 'experience',
  'impact', 'formatting', 'contact'
);

-- --- profiles ---------------------------------------------------------------
-- Supabase Auth owns identity; this table holds application-level data only.

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  name         text,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --- resumes ----------------------------------------------------------------

create table resumes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles (id) on delete cascade,
  name              text not null,
  original_filename text not null,
  file_type         text not null check (file_type in ('pdf', 'docx')),
  storage_path      text not null,
  file_size         integer not null check (file_size > 0),
  status            resume_status not null default 'uploaded',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index resumes_user_id_created_at_idx on resumes (user_id, created_at desc);
create index resumes_deleted_at_idx on resumes (deleted_at) where deleted_at is null;

-- --- resume_versions --------------------------------------------------------
-- Append-only. A prior version is never silently overwritten (spec section 9),
-- because every analysis must reference the exact content it scored.

create table resume_versions (
  id              uuid primary key default gen_random_uuid(),
  resume_id       uuid not null references resumes (id) on delete cascade,
  version_number  integer not null check (version_number > 0),
  raw_text        text,
  normalized_text text,
  parsed_json     jsonb,
  parser_version  text not null,
  created_at      timestamptz not null default now(),
  unique (resume_id, version_number)
);

create index resume_versions_resume_id_idx on resume_versions (resume_id, version_number desc);

-- --- target_profiles --------------------------------------------------------

create table target_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  title           text not null,
  experience_min  integer check (experience_min >= 0),
  experience_max  integer check (experience_max >= 0),
  industry        text,
  specialization  text,
  location        text,
  work_model      text,
  employment_type text,
  skills_json     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint experience_range_ordered
    check (experience_min is null or experience_max is null or experience_min <= experience_max)
);

create index target_profiles_user_id_idx on target_profiles (user_id, created_at desc);

-- --- job_descriptions -------------------------------------------------------

create table job_descriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  title          text,
  raw_text       text not null,
  parsed_json    jsonb,
  parser_version text not null,
  created_at     timestamptz not null default now()
);

create index job_descriptions_user_id_idx on job_descriptions (user_id, created_at desc);

-- --- analyses ---------------------------------------------------------------

create table analyses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  resume_version_id   uuid not null references resume_versions (id) on delete cascade,
  target_profile_id   uuid references target_profiles (id) on delete set null,
  job_description_id  uuid references job_descriptions (id) on delete set null,
  analysis_mode       analysis_mode not null,
  status              analysis_status not null default 'queued',

  -- Provenance (ADR-006). Five versions, not one. scoring_version alone tracks
  -- the weights; without the rest, a silent provider-side model update shifts
  -- every score while every version string stays unchanged, and the v1->v2->v3
  -- score history becomes unreadable.
  scoring_version     text not null,
  analysis_version    text not null,
  prompt_version      text,
  model_id            text,
  taxonomy_version    text,
  parser_version      text,

  error_category      text,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,

  -- A mode must carry exactly the context it claims to use.
  constraint mode_requires_matching_context check (
    (analysis_mode = 'resume_health'
       and target_profile_id is null and job_description_id is null)
    or (analysis_mode = 'role_readiness'
       and target_profile_id is not null and job_description_id is null)
    or (analysis_mode = 'job_match'
       and job_description_id is not null)
  )
);

create index analyses_user_id_created_at_idx on analyses (user_id, created_at desc);
create index analyses_resume_version_id_idx on analyses (resume_version_id);
create index analyses_status_idx on analyses (status) where status not in ('completed', 'failed');

-- --- score_categories -------------------------------------------------------
-- The section 27 explainability contract, persisted so the UI can answer
-- "why is my score 72?" with no second model call.

create table score_categories (
  id             uuid primary key default gen_random_uuid(),
  analysis_id    uuid not null references analyses (id) on delete cascade,
  category       score_category not null,
  raw_score      numeric(5, 4) not null check (raw_score between 0 and 1),
  weight         numeric(5, 2) not null check (weight >= 0),
  weighted_score numeric(6, 3) not null,
  reason         text not null,
  confidence     numeric(4, 3) check (confidence between 0 and 1),
  created_at     timestamptz not null default now(),
  unique (analysis_id, category)
);

create index score_categories_analysis_id_idx on score_categories (analysis_id);

-- --- score_features ---------------------------------------------------------
-- ADR-006. The persisted feature vector.
--
-- Two things depend on this table existing:
--   1. estimatedScoreImpact and the section 31 simulator, which are computed by
--      mutating this vector and re-running the same scorer. Any other
--      derivation puts model output in control of the score.
--   2. Score explainability, assembled from these rows.

create table score_features (
  id            uuid primary key default gen_random_uuid(),
  analysis_id   uuid not null references analyses (id) on delete cascade,
  category      score_category not null,
  feature_key   text not null,
  feature_value numeric not null,
  source        feature_source not null,
  evidence_json jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (analysis_id, category, feature_key)
);

create index score_features_analysis_id_idx on score_features (analysis_id);
create index score_features_analysis_category_idx on score_features (analysis_id, category);

-- --- skill_assessments ------------------------------------------------------

create table skill_assessments (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid not null references analyses (id) on delete cascade,
  skill_name      text not null,
  canonical_skill text,
  status          skill_evidence_status not null,
  evidence_level  text,
  source          text,
  confidence      numeric(4, 3) check (confidence between 0 and 1),
  importance      text,
  score_impact    numeric(6, 3),
  evidence_json   jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index skill_assessments_analysis_id_idx on skill_assessments (analysis_id);
create index skill_assessments_status_idx on skill_assessments (analysis_id, status);

-- --- recommendations --------------------------------------------------------

create table recommendations (
  id                     uuid primary key default gen_random_uuid(),
  analysis_id            uuid not null references analyses (id) on delete cascade,
  type                   text not null,
  title                  text not null,
  description            text not null,
  priority               priority_level not null,
  estimated_score_impact numeric(6, 3),
  current_evidence       jsonb not null default '[]'::jsonb,
  suggested_action       text not null,
  -- True when acting on this recommendation requires the user to supply a fact
  -- only they can substantiate. The product must never fabricate it for them
  -- (spec section 13, Principle 5).
  truth_requirement      boolean not null default false,
  status                 recommendation_status not null default 'open',
  created_at             timestamptz not null default now()
);

create index recommendations_analysis_id_idx on recommendations (analysis_id, priority);

-- --- resume_changes ---------------------------------------------------------

create table resume_changes (
  id                uuid primary key default gen_random_uuid(),
  analysis_id       uuid not null references analyses (id) on delete cascade,
  recommendation_id uuid references recommendations (id) on delete set null,
  section           text not null,
  original_text     text not null,
  suggested_text    text not null,
  accepted          boolean not null default false,
  created_at        timestamptz not null default now()
);

create index resume_changes_analysis_id_idx on resume_changes (analysis_id);

-- --- updated_at maintenance -------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger resumes_set_updated_at
  before update on resumes
  for each row execute function set_updated_at();

create trigger target_profiles_set_updated_at
  before update on target_profiles
  for each row execute function set_updated_at();

-- --- Enable RLS -------------------------------------------------------------
-- Enabled with no policies = deny all. Policies arrive in 0002; the tables are
-- never briefly readable in between.

alter table profiles           enable row level security;
alter table resumes            enable row level security;
alter table resume_versions    enable row level security;
alter table target_profiles    enable row level security;
alter table job_descriptions   enable row level security;
alter table analyses           enable row level security;
alter table score_categories   enable row level security;
alter table score_features     enable row level security;
alter table skill_assessments  enable row level security;
alter table recommendations    enable row level security;
alter table resume_changes     enable row level security;
