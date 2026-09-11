# Roadmap

Phase order is authoritative. Implement one phase at a time; do not run ahead. Spec background: §68–§83,
§98–§99.

---

## Phase status

| | Phase | Exit criterion | Status |
|---|---|---|---|
| 0 | Repository & documentation | Docs committed under personal identity | ✅ done |
| 0.5 | `docs/MEASUREMENT.md` | A reviewer can compute a score by hand and match the engine | ✅ done |
| 1 | Application bootstrap | `lint && typecheck && test` green on an empty app | ✅ done |
| 2 | Database + RLS | §44's four cross-user isolation tests pass | **next** |
| 3 | Authentication | OAuth + magic link, protected dashboard | |
| 4 | Resume upload | Full rejection matrix passes; no AI, no parsing | |
| 5 | Parser | Parseability features emitted; two-column judged on quality | |
| 6 | Resume extraction AI | Injection fixture neutralized; cache asserted; no raw text logged | |
| 7 | **Resume Health engine + results UI** | §92 acceptance checklist; stability gate green | ← **first usable milestone (§99)** |
| 8 | Target role + Role Readiness | Role corpus built; does not duplicate Health | |
| 9 | JD parsing | Required / preferred / nice-to-have separated | |
| 10 | Job matching | Exact + synonym + evidence + semantic | |
| 11 | Recommendations | Evidence-backed, prioritized, ~5 max | |
| 12 | Targeted rewrite | Truth guardrail rejects invented facts | |
| 13 | Versioning + before/after | History honors provenance discontinuity | |
| 14 | Hardening | Rate limits, retention, budgets, observability, local Docker | |
| 15 | Evaluation | Golden set (all synthetic), human comparison, weight tuning | |

## Known work sitting inside these phases

- **Phase 8 is larger than it looks.** §19 treats role expectations as one `roles.json` config file. It
  is the entire benchmark for Mode B — roughly 20 roles × (expected skills, seniority bands, typical
  responsibilities), built from public sources only. Budget it as a content project.
- **Phase 14 must add an idempotency key to `/api/analyze`.** Re-submitting the same resume + JD
  currently pays twice.
- **Phase 15 is when rubric anchors become defensible.** Until then they are documented judgment calls
  (see [`SCORING.md`](SCORING.md) §1).

## Deferred deliberately

- **Guest / anonymous analysis flow** (§43). Complicates RLS and is not needed for the milestone.
  Revisit after Phase 7.
- **pgvector** (§23). Not required for MVP semantic matching; introduce only when storing and querying
  embeddings actually earns it.
- **Recruiter first-impression module** (§34). V2, after core scoring is stable — and it must never be
  presented as an ATS-compatibility signal.

## V2 / V3

**V2:** rewrite engine, before/after comparison, resume versions, export, recruiter impression, better
role and skill taxonomies, analytics dashboard.

**V3:** job URL ingestion, multiple-job ranking, job recommendation, resume variant selection per job.
