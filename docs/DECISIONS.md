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

---

## ADR-007 — Toolchain version pins

**Date:** 2026-09-11 · **Status:** accepted, with one item to revisit

### Pins

| Package | Pinned | Latest available | Why |
|---|---|---|---|
| `next` | 16.3.4 | 16.3.4 | current |
| `react` | 19.3.0 | 19.3.0 | current |
| `typescript` | **5.9.3** | 7.0.2 | TS 7 is the native (Go) compiler rewrite. Pinning 5.9 avoids debugging ecosystem compatibility on a greenfield project; revisit once `eslint-config-next` and the Next plugin are known-good on 7 |
| `vitest` | **4.1.11** | 5.0.0 | Vitest 5 requires Node `^22.12 \|\| ^24 \|\| >=26`. The development machine runs Node 20.20.2, so Vitest 5 cannot run here |
| `eslint` | 9.39.5 | 10.10.0 | `eslint-config-next@16.3.4` is built against ESLint 9; ESLint 10 is untested with it |
| `tailwindcss` | 4.3.3 | 4.3.3 | Tailwind 4 CSS-first config, via `@tailwindcss/postcss` |

### Open item — Node 20 is past end of life

Node 20 reached EOL in **April 2026**; the development machine runs 20.20.2. That means no further
security patches, and it is what forces the Vitest 4 pin above.

Not a blocker for local development. It **is** a blocker before deployment, and a portfolio project built
on an EOL runtime is a poor look in the context this project exists for.

Upgrading is small and self-contained: `nvm install 22 && nvm use 22`, change `.nvmrc` to `22`, raise the
`engines.node` floor, and move `vitest` to `^5`. Deliberately not done unprompted, because it changes the
machine's global toolchain rather than anything in this repository.

### Rejected during setup

- `create-next-app` — refuses to scaffold into a directory that already contains `README.md`, and would
  not produce the strict-mode settings or the `no-restricted-imports` rule this project requires. Config
  written by hand instead.
- `@eslint/eslintrc` + `FlatCompat` — unnecessary. `eslint-config-next/core-web-vitals` already exports a
  flat-config array (and already includes `next/typescript`). The compat shim also crashed on a circular
  structure when serialising the React plugin.
- `vite-tsconfig-paths` — Vite resolves tsconfig `paths` natively via `resolve.tsconfigPaths`.

### Strictness beyond the spec's ask

`tsconfig.json` enables `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, `noUnusedLocals` and `noUnusedParameters` on top of `strict`.

`exactOptionalPropertyTypes` immediately caught a real defect in `playwright.config.ts`, where
`workers: undefined` was being passed to an optional property — an explicit `undefined` is not the same
as an absent key. Fixed by conditional spread rather than by relaxing the setting.

---

## ADR-009 — Gemini Flash 2.0 replaces Anthropic for bounded classification

**Date:** 2026-09-12 · **Status:** accepted · **Supersedes:** ADR-003 (Anthropic SDK)

### Decision

All bounded LLM classification calls (`statesContext`, `statesOutcome`, `genuineOutcomeRatio`, skill
semantic evidence) use **Google Gemini Flash 2.0** via `@google/generative-ai`, obtained from Google
AI Studio's free tier. `@anthropic-ai/sdk` is removed from the project.

The `ResumeClassifier` interface in `lib/analysis/classifier.ts` is unchanged — the provider is an
implementation detail behind that contract.

### Why

This is a personal portfolio project with no revenue and no company billing account. Anthropic's API
is pay-as-you-go with no free tier. Gemini Flash 2.0 from Google AI Studio is:

- **Free** — no credit card, no cost up to the AI Studio rate limits (15 RPM, 1M TPM as of 2026).
- **Structured output** — native JSON mode with a response schema, which is exactly what R2 requires
  (enum verdicts, never free-form). No output parsing fragility.
- **Capable enough** — the three classification prompts ask binary yes/no/unclear questions per item.
  A smaller, faster model is correct for this workload; Gemini Flash handles it comfortably.
- **Swappable** — Groq (Llama 3, also free) can replace it by implementing the same interface.

### Consequences

- `ANTHROPIC_API_KEY` removed from env schema; `GEMINI_API_KEY` added.
- `lib/ai/gemini.ts` implements `ResumeClassifier`. The existing fake classifier in tests is unaffected.
- `docs/AI.md` model routing table updated to reflect Gemini Flash.
- Prompt caching (ADR-003's main cost lever) is unavailable on Gemini's free tier. This is acceptable
  because the AI calls are the cheapest part of the pipeline — rule features cover 50% of the score at
  $0, and the three classification calls per resume are short. At the usage scale of a personal project,
  rate limits are the binding constraint, not cost.

---

## ADR-008 — Repository named `resume-intelligence`, not `ats-resume-intelligence`

**Date:** 2026-09-11 · **Status:** accepted

### Decision

The repository, package and product name drop the "ATS" prefix.

### Why

§1 and [`PRODUCT.md`](PRODUCT.md) §2 make it a governing rule that this product **never** claims to
compute an employer-specific or universal ATS score. Leading the name with "ATS" advertises precisely the
claim the product refuses to make — and the name is the first thing anyone reads, well before the
disclaimer.

The spec's own §1 calls "ATS Resume Intelligence" a *working name*, so this is a decision it invited
rather than one it forbids.

### Consequences

The three user-facing score names (Resume Health, Role Readiness, Job Match) are unaffected — they were
already the product. `ATS Parseability` remains a category name, which is accurate: it measures whether
automated systems can read the document, and claims nothing about any particular system's scoring.

The archived specification keeps its original filename as a historical record.
