# Scoring

Spec background: §17–§20 (categories and weights), §26 (deterministic engine), §27 (explainability),
§31 (simulator). The measurement layer that makes these work is [`MEASUREMENT.md`](MEASUREMENT.md).

---

## 1. Honest statement of what these scores are

These are **product methodology scores, not an industry standard and not a prediction of any employer's
ATS behavior.** The weights below were chosen by judgment. The rubric anchors in
[`MEASUREMENT.md`](MEASUREMENT.md) were also chosen by judgment and are **not empirically calibrated**
until Phase 15's human-reviewer comparison provides evidence to tune them against.

This is stated plainly here, in the methodology page, and in the disclaimer on every results page.
Presenting judgment-derived numbers as empirically grounded would be the most damaging thing this
product could do.

## 2. Three scores

| Score | Input | Question answered |
|---|---|---|
| **Resume Health** | Resume only | Is my resume structurally and content-wise strong? |
| **Role Readiness** | Resume + target role context | Is my resume strong for the type of job I'm targeting? |
| **Job Match** | Resume + job description | How well does my resume fit this specific job? |

Role Readiness must be a contextual assessment, not a restatement of Resume Health (§19).

## 3. Resume Health weights — `scoring_version` 1.0.0

| Category | Weight | Derivation |
|---|---:|---|
| ATS Parseability | 20% | rule only |
| Resume Structure | 15% | rule only |
| Skills & Keywords | 15% | rule + bounded LLM |
| Experience Quality | 20% | rule + bounded LLM |
| Achievements / Impact | 15% | rule + bounded LLM |
| Formatting / Readability | 10% | rule only |
| Contact Information | 5% | rule only |

**50% of total weight is fully rule-derived** — deterministic, reproducible, $0 in AI cost.

Weights live in `lib/scoring/config.ts` and nowhere else. Changing them requires explicit instruction and
a documented reason.

## 4. Job Match weights

| Category | Weight |
|---|---:|
| Required Skills | 30% |
| Relevant Experience | 25% |
| Responsibilities | 20% |
| Keywords / Terminology | 10% |
| Seniority / Experience | 10% |
| Other Requirements | 5% |

Missing *preferred* skills penalize less than missing *required* skills (§21).

## 5. Engine constraints

- **No LLM import is permitted inside `lib/scoring/`.** Enforced by an ESLint `no-restricted-imports`
  rule. Hitting it means the design is wrong, not the rule.
- Pure functions wherever practical. Same feature vector in, same score out, always.
- Every category returns the §27 contract: score, weight, weighted score, reason, evidence references,
  confidence.
- The UI answers *"why is my score 72?"* from stored rows, **with no second model call.**

## 6. Confidence

Stored internally as 0–1. Displayed as **High / Medium / Low**. Never render false precision like
`87.42% confidence`.

## 7. Potential score (§31)

Computed by **mutating the persisted feature vector and re-running the same scorer** — never by an LLM
assigning a delta, which would put model output in control of the score.

- Presented as a **range**, never a single promised number.
- Only improvements supported by real evidence count.
- **A score never increases because a user accepted a suggestion.** It increases when the resume content
  actually changes and is re-analyzed (§53).

## 8. Provenance

Every analysis stores `scoring_version`, `prompt_version`, `model_id`, `taxonomy_version`,
`parser_version`.

The score-history chart (§52) **renders a discontinuity marker rather than a trend line** across any
`model_id` or `scoring_version` change. Without this, "v1 → 72, v2 → 79" cannot distinguish an improved
resume from a drifted model — which would quietly invalidate the before/after comparison that is the
product's core value.
