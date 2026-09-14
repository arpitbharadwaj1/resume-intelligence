-- Resume Intelligence — initial schema
-- Run in order. All tables use UUID primary keys and are owned by the
-- authenticated user via row-level security.

-- Enable the pgcrypto extension for gen_random_uuid().
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- resumes — one row per uploaded document
-- ---------------------------------------------------------------------------

create table resumes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  file_name     text not null,
  file_size     int  not null,
  mime_type     text not null,
  storage_path  text not null,          -- private Supabase Storage path
  created_at    timestamptz not null default now()
);

alter table resumes enable row level security;

create policy "users see own resumes"
  on resumes for select
  using (auth.uid() = user_id);

create policy "users insert own resumes"
  on resumes for insert
  with check (auth.uid() = user_id);

create policy "users delete own resumes"
  on resumes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- analyses — one row per scored analysis of a resume
-- ---------------------------------------------------------------------------

create table analyses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  resume_id        uuid not null references resumes(id) on delete cascade,
  status           text not null default 'queued'
                     check (status in ('queued','processing','completed','failed')),
  total_score      int,
  scoring_version  text,
  prompt_version   text,
  model_id         text,
  parser_version   text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

alter table analyses enable row level security;

create policy "users see own analyses"
  on analyses for select
  using (auth.uid() = user_id);

create policy "users insert own analyses"
  on analyses for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- score_features — one row per feature value per analysis (ADR-006)
-- Required by the simulator and the score-history chart.
-- ---------------------------------------------------------------------------

create table score_features (
  id             uuid primary key default gen_random_uuid(),
  analysis_id    uuid not null references analyses(id) on delete cascade,
  category       text not null,
  feature_key    text not null,
  feature_value  numeric not null,
  source         text not null check (source in ('rule', 'llm')),
  evidence_json  jsonb not null default '[]',
  created_at     timestamptz not null default now()
);

alter table score_features enable row level security;

create policy "users see own score features"
  on score_features for select
  using (
    exists (
      select 1 from analyses a
      where a.id = score_features.analysis_id
        and a.user_id = auth.uid()
    )
  );

create policy "users insert own score features"
  on score_features for insert
  with check (
    exists (
      select 1 from analyses a
      where a.id = score_features.analysis_id
        and a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket — private resume files
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "users upload own resumes"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users read own resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users delete own resumes"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
