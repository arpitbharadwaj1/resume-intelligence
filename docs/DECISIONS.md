# Architecture Decision Record

Append-only. Each entry states the decision, why, and what it costs. `§N` cites
[`ATS_Resume_Intelligence_ARCHITECTURE.md`](../ATS_Resume_Intelligence_ARCHITECTURE.md).

---

## ADR-001 — Insert a measurement layer between LLM signals and the score engine

**Date:** 2026-09-11 · **Status:** accepted · **Amends:** §17, §18, §26, §27, §31

### Context

§26 specifies the deterministic score engine as receiving an already-formed vector
(`{parseability: 0.92, impact: 0.54, …}`) and returning a weighted sum. That aggregation is ~20 lines of
arithmetic, and it is the only component the spec calls deterministic, versioned, unit-tested and
reproducible. **The spec never defines where the input vector comes from.** §18 lists qualities to
evaluate ("Action. Context. Specificity. Outcome.") with no rule converting any of them to a number.

Four consequences, all load-bearing:

1. **"Reproducible" is false as specified.** Experience (20%) + Impact (15%) + much of Skills (15%) is
   qualitative and can only originate with an LLM. LLMs are not reproducible even at temperature 0. A
   deterministic function over a non-deterministic input launders variance; it does not remove it. No
   tolerance band for run-to-run variation is defined anywhere.
2. **"Versioned" is hollow.** `scoring_version` versions the *weights*, not the measurement. A silent
   model update shifts every score while the version string stays `1.0.0`, destroying the score history
   (§52) and before/after comparison (§53) that §100 names as the product's actual value.
3. **The eval dataset has nothing to assert against.** §54's fixture is categorical
   (`expectedWeakAreas`), with no expected score and no tolerance.
4. **The simulator is unsound.** §31's `+5 / +3 / +2` deltas and §28's `estimatedScoreImpact` have no
   stated derivation. An LLM assigning them would put LLM output in control of the score, violating
   Principle 3 through the back door.

### Decision

Three layers, not two:

```
spec:   LLM  →  [ undefined ]  →  weighted sum  →  score
built:  LLM  →  signals  →  rubric  →  feature vector  →  weighted sum  →  score
```

Governed by R1 (features are countable and evidence-linked), R2 (no holistic LLM scoring — bounded
per-item classification only), R3 (rule-derived wherever honest). Full specification in
[`MEASUREMENT.md`](MEASUREMENT.md).

`estimatedScoreImpact` and the §31 simulator are computed by **mutating the persisted feature vector and
re-running the same scorer** — the only derivation that keeps Principle 3 intact.

### Consequences

- Four of seven categories (50% of weight) become fully rule-derived: $0 AI cost, perfectly reproducible.
- A CI stability gate becomes possible and mandatory: 5 runs per golden fixture, σ(total) ≤ 1.5 points.
- Requires a `score_features` table (ADR-006) — the simulator cannot work without persisted features.
- Cost: Phase 0.5 is a documentation phase with no shipped features. Accepted; the alternative is
  ad-hoc scoring baked in at Phase 7 and unfixable afterward.
- The rubric anchors are initially judgment calls and are **not** empirically grounded until Phase 15's
  human comparison. `SCORING.md` must say so plainly rather than implying otherwise.

---

## ADR-002 — Next.js App Router, not a browser-only React SPA

**Date:** 2026-09-11 · **Status:** accepted · **Confirms:** §7, §8

### Context

"Next.js or React" is a false choice — Next.js *is* React plus a router, a bundler and a server. The real
fork is Next.js (one repo, one deploy) versus Vite + React + React Router + a separate Node API (two
deploys, CORS, hand-shared types).

### Decision

Next.js App Router. Four spec requirements a browser-only SPA cannot satisfy:

- §47 server-side AI keys — a key in a React bundle is a published key.
- §45 private storage — signed URLs require the Supabase service-role key, server-only.
- §4/§11 upload validation and parsing — the client is untrusted input; browser-extracted text is
  forgeable, and client-side MIME checks are a UX nicety, not a control.
- §48 rate limiting — client-enforced limits are decoration.

An SPA plus an API server is also two services, contradicting Principle 9's modular monolith. §8's tree
(`app/(marketing)/`, `app/results/[analysisId]/page.tsx`, `layout.tsx`) is already App Router convention.

### Consequences

Server vs Client Components and `"use client"` add real mental load; App Router caching semantics have
been a recurring source of confusion across versions; the project is somewhat Vercel-flavored. Accepted —
the alternative costs a second deploy target for strictly less capability.

---

## ADR-003 — Anthropic SDK, overriding the spec's "OpenAI-compatible" placeholder

**Date:** 2026-09-11 · **Status:** accepted · **Amends:** §7, §84

### Decision

`@anthropic-ai/sdk` with structured outputs (`output_config.format` / `client.messages.parse()`, or
`strict: true` on tool definitions). §84's "OpenAI-compatible structured LLM integration" was a
placeholder, not a requirement — confirmed with the project owner.

### Consequences

Output shape is constrained at generation time, which demotes Zod from primary validation mechanism to
second line of defense — a meaningful reliability gain over "ask for JSON and validate the wreckage".
Zod validation is still required: it is what catches a schema the API honored but the business rules
reject.

---

## ADR-004 — Multi-model tiering, validated before it is trusted

**Date:** 2026-09-11 · **Status:** accepted, pending Phase 6 measurement

### Decision

| Workload | Model |
|---|---|
| Resume extraction, JD extraction, recommendation generation | `claude-opus-5` |
| Bulk bounded per-bullet classifications | `claude-haiku-4-5` |
| Escalation tier if Haiku cannot hold outcome-vs-responsibility | `claude-sonnet-5` |

Classifications are **batched** — all bullets in one request returning an array of verdicts under a
`strict: true` schema. 1–2 calls, not 80. Each element remains a bounded per-item judgment, so R2 holds.

### Consequences and open validation

- Caches are model-scoped, so a cascade forfeits cross-model cache reuse.
- **Haiku 4.5's minimum cacheable prefix is 4096 tokens; Opus 5's is 512.** A taxonomy prefix that caches
  on Opus may silently not cache on Haiku — no error, just a higher bill.
- **Before committing:** benchmark single-model `claude-opus-5` at `output_config: { effort: "low" }`
  against the cascade. If quality holds, one model is simpler and cache-coherent. Record the measurement
  here.
- Two models now contribute to one score, making per-call `model_id` provenance load-bearing (ADR-006).
- Rough pre-caching cost estimate: ~$0.12/analysis (extraction ~$0.06, classification ~$0.007,
  recommendations ~$0.05). **Estimate, not measurement** — replace with the measured figure in Phase 7.

---

## ADR-005 — Hosted Supabase for development; local Docker deferred to Phase 14

**Date:** 2026-09-11 · **Status:** accepted

### Context

Docker is not installed on the development machine, so `supabase start` is unavailable without adding a
heavy prerequisite before Phase 2.

### Decision

Develop against a hosted Supabase project on a personal account. Migrations applied via the Supabase CLI
against the remote database. Add Docker and the local stack at Phase 14, where isolated RLS and retention
testing genuinely benefit.

### Consequences

Slower migration iteration, no offline work, and RLS tests run against a shared remote using two real
test users. Accepted for velocity; revisit if migration churn becomes painful before Phase 14.

---

## ADR-006 — `score_features` table and provenance columns

**Date:** 2026-09-11 · **Status:** accepted · **Amends:** §9

### Decision

Add to the §9 schema:

**`score_features`** — `analysis_id`, `category`, `feature_key`, `feature_value`, `source` (`rule` |
`llm`), `evidence_json`.

**Provenance columns on `analyses`** — `prompt_version`, `model_id`, `taxonomy_version`,
`parser_version`, alongside the existing `scoring_version`.

### Why

- The §31 simulator and §28's `estimatedScoreImpact` are computed by mutating the feature vector and
  re-scoring. Impossible without persisted features.
- §27 requires answering "why is my score 72?" **without another model call** — that answer is assembled
  from stored feature rows.
- Provenance is what lets the score-history chart (§52) distinguish a genuinely improved resume from a
  drifted model. Without it, history is noise. The chart must render a discontinuity marker rather than a
  trend line across a `model_id` or `scoring_version` change.
