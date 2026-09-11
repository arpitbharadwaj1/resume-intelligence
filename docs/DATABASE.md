# Database

Schema is specified in §9. This document records the **amendments** and the operational rules; it does
not duplicate the table list.

---

## 1. Amendments to §9

Both from [ADR-006](DECISIONS.md#adr-006).

### `score_features` (new table)

```
id            UUID PK
analysis_id   UUID FK → analyses
category      text          -- parseability | structure | skills | experience | impact | formatting | contact
feature_key   text          -- e.g. 'quantifiedBulletRatio'
feature_value numeric
source        text          -- 'rule' | 'llm'
evidence_json jsonb         -- evidence IDs backing this value
created_at    timestamptz
```

Two things depend on it and cannot work without it:

- The §31 simulator and §28's `estimatedScoreImpact` are computed by mutating this vector and re-running
  the scorer — the only derivation that keeps LLM output out of the score.
- §27 requires answering *"why is my score 72?"* with no second model call. The answer is assembled from
  these rows.

### Provenance columns on `analyses`

Added alongside the existing `scoring_version`: `prompt_version`, `model_id`, `taxonomy_version`,
`parser_version`.

`model_id` matters more than it looks — with multi-model routing ([ADR-004](DECISIONS.md#adr-004)) two
models contribute to a single score, and a silent provider-side model update would otherwise shift every
score while every version string stayed unchanged.

## 2. Rules

- **Never silently overwrite a resume version.** `resume_versions` is append-only; every analysis
  references a concrete version.
- **RLS on every user-owned table.** Default deny, policies keyed on `auth.uid()`. Supabase Auth owns
  identity; `profiles` holds application-level data only.
- Indexes on every foreign key, plus `analyses(user_id, created_at)` for the history views.
- Enum-like columns use the values in §90's domain types — `analysis_mode`, `analysis_status`,
  `skill_assessments.status` (`strong` | `weak` | `missing`), `recommendations.priority`.
- Soft delete via `deleted_at` on `resumes`; retention cleanup removes the stored file, not the
  structured analysis.

## 3. Migrations

`db/migrations/`, applied with the Supabase CLI against the hosted project
([ADR-005](DECISIONS.md#adr-005)). No Docker locally until Phase 14.

Every migration is forward-only and committed. Do not edit an applied migration — add a new one.

## 4. Isolation tests

§44's four cases, with two real test users, all failing closed. These run against the hosted database and
are part of the Phase 2 exit criteria — not deferred to hardening.
