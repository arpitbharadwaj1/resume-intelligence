# Measurement Layer

**The gate.** No scoring code is written until this document is complete, because this is the layer the
architecture specification omits. Decision and rationale: [ADR-001](DECISIONS.md#adr-001).

A reviewer must be able to compute a score by hand from this document and get the same number the engine
produces. §9 below is that worked example, and it is golden fixture #1.

---

## 1. Why this exists

§26 defines the deterministic score engine as receiving an already-formed vector and returning a weighted
sum. That aggregation is ~20 lines of arithmetic, and it is the only component the spec calls
deterministic, reproducible and versioned. **The spec never says where the vector comes from.**

Up to half the Health Score is qualitative and can only originate with a model. A deterministic function
over a non-deterministic input is deterministic in form only. This layer closes that gap.

## 2. The three rules

**R1 — Features are countable and evidence-linked.**
Impact is not "does this feel impactful"; it is `quantifiedBulletRatio`, `distinctMetricTypes`,
`metricsInRecentRole`. Every feature value carries the evidence IDs that produced it. A human can audit a
count. A human cannot audit a vibe.

**R2 — No holistic LLM scoring, anywhere.**
A model may answer a bounded question about one small unit — *"does this bullet state an outcome?
yes / no / unclear"* — and nothing larger. It may never return a 0–100 category score, a "quality rating",
or a weighted judgment. Bounded per-item classifications are far more stable across runs and are
individually auditable against the source text.

**R3 — Rule-derived beats LLM-derived wherever it is honest.**
Parseability, Structure, Formatting and Contact are fully rule-derived. That is **50% of total weight** at
zero AI cost and zero variance.

## 3. Feature inventory

`source` is `rule` (deterministic code) or `llm` (bounded classification). Every feature is in `[0,1]`
unless noted. `evidence` names what the value is traceable to.

### 3.1 Parseability — weight 20, rule only

| Feature | Source | Definition |
|---|---|---|
| `textYieldRatio` | rule | `clamp(extractedChars / (pageCount × 2000))` — expected density for a text-bearing page |
| `readingOrderCoherence` | rule | `1 − suspiciousBreaks / totalLines`; suspicious = line ends mid-word, or ends without terminal punctuation and the next line starts lowercase |
| `sectionsDetectedRatio` | rule | detected core sections / 4 (experience, education, skills, contact) |
| `contactFieldsExtracted` | rule | of name / email / phone, fraction found |
| `glyphAnomalyRatio` | rule | (U+FFFD + control chars + broken ligatures) / totalChars |
| `repeatedLineRatio` | rule | duplicate non-empty lines / totalLines — detects extraction loops |
| `isImageOnly` | rule | boolean: `extractedChars < 200` on a document of ≥ 1 page |

**§18 rule:** two-column layout is never itself a penalty. Only measured extraction quality counts.

### 3.2 Structure — weight 15, rule only

| Feature | Source | Definition |
|---|---|---|
| `hasExperience`, `hasSkills`, `hasEducation`, `hasSummary` | rule | booleans from structured extraction |
| `summaryExpected` | rule | false when inferred seniority is `entry` — a fresher is not penalized for omitting a summary |
| `sectionOrderScore` | rule | Kendall-tau similarity of actual section order to the expected order for the inferred seniority |
| `chronologyConsistent` | rule | boolean: experience entries in non-increasing date order |
| `datedEntryRatio` | rule | experience entries with a parseable date range / total |

**§18 rule:** do not require every possible section of every candidate. Projects and certifications are
contextual, not mandatory, and are not features here.

### 3.3 Skills — weight 15, rule + bounded LLM

| Feature | Source | Definition |
|---|---|---|
| `totalSkills` | rule | count of distinct listed skills (integer) |
| `canonicalizedRatio` | rule | skills resolving to a taxonomy entry / total |
| `skillGroupingPresent` | rule | boolean: skills grouped under labels vs a flat comma dump |
| `keywordRepetitionIndex` | rule | max frequency of any single skill token / total document tokens — the §35 stuffing signal |
| `strongEvidenceRatio` | rule + llm | skills with strong evidence / total |

**Evidence classification per skill** (§16, §30) — computed once, reused by scoring, UI and recommendations:

- **strong** — the canonical skill (or an alias) appears in an experience or project bullet, *or* a
  bounded LLM call confirms the bullet demonstrates it semantically.
- **weak** — appears only in the Skills section, nowhere demonstrated.
- **missing** — expected for the target role or JD, no reliable evidence found. (Modes B and C only.)

### 3.4 Experience — weight 20, rule + bounded LLM

**Per bullet**, four signals — two rule, two LLM. This decomposition is the critical move: it replaces one
holistic quality judgment with four small ones, half of which never touch a model.

| Signal | Source | Definition |
|---|---|---|
| `startsWithActionVerb` | rule | first token lemma ∈ `action-verbs.json` |
| `containsTaxonomyToken` | rule | contains ≥ 1 canonical skill, technology or domain token |
| `statesContext` | **llm** | does the bullet say what was built/for whom/at what scale? `yes` / `no` / `unclear` |
| `statesOutcome` | **llm** | does it state a result, rather than only a duty? `yes` / `no` / `unclear` |

`unclear` counts as `0.5`. Aggregates:

| Feature | Source | Definition |
|---|---|---|
| `bulletCompletenessRatio` | mixed | mean over bullets of (sum of the four signals / 4) |
| `bulletsInLengthBand` | rule | bullets of 8–40 words / total |
| `firstPersonRatio` | rule | bullets containing first-person pronouns / total (lower is better) |
| `bulletsPerRoleMedian` | rule | median bullets per role (integer) |

### 3.5 Impact — weight 15, rule + bounded LLM

| Feature | Source | Definition |
|---|---|---|
| `quantifiedBulletRatio` | rule | bullets containing a magnitude / total. Regex families: percentage, currency, counts, durations, multipliers, scale |
| `genuineOutcomeRatio` | **llm** | of quantified bullets, the fraction stating a real outcome rather than a restated duty. Guards against *"managed a team of 5"* scoring as impact |
| `distinctMetricTypes` | rule | how many of the six regex families appear (integer 0–6) |
| `metricsInRecentRole` | rule | boolean: ≥ 1 quantified bullet in the most recent role |

**§18 rule:** never require fabricated numbers. The rubric floor and the `genuineOutcomeRatio` gate exist
so a truthful qualitative outcome is not punished into a zero.

### 3.6 Formatting — weight 10, rule only

| Feature | Source | Definition |
|---|---|---|
| `dateFormatVariants` | rule | count of distinct date formats used (integer; 1 is ideal) |
| `punctuationConsistency` | rule | share of bullets following the majority terminal-punctuation convention |
| `headingCaseConsistency` | rule | share of headings following the majority casing convention |
| `unusualGlyphRatio` | rule | non-standard symbols / totalChars |
| `lineLengthOutlierRatio` | rule | lines beyond 1.5× IQR of the length distribution / totalLines |

### 3.7 Contact — weight 5, rule only

| Feature | Source | Definition |
|---|---|---|
| `hasName`, `hasEmail`, `hasPhone` | rule | booleans; email and phone format-validated |
| `optionalPresent` | rule | count of location / LinkedIn / GitHub present (integer 0–3) |

**§18 rule:** GitHub counts toward `optionalPresent` only when the inferred role is engineering. Absent
optional fields are never universally penalized.

## 4. Rubric functions

Each is a pure function `(features) => [0,1]`, lives in `lib/scoring/rubrics/`, and ships with a unit test
pinning the anchor points below **as assertions, not comments**. `clamp(x)` bounds to `[0,1]`.

### 4.1 Parseability

```
if (isImageOnly) return 0.05

parseability =
    0.30 × textYieldRatio
  + 0.25 × readingOrderCoherence
  + 0.20 × sectionsDetectedRatio
  + 0.10 × contactFieldsExtracted
  + 0.10 × (1 − glyphAnomalyRatio)
  + 0.05 × (1 − repeatedLineRatio)
```

| Anchor | Value |
|---|---|
| Image-only scan | 0.05 |
| Clean single-column text PDF, all sections found | ≈ 0.97 |
| Text extracts but reading order is scrambled (`readingOrderCoherence` 0.40) | ≈ 0.83 |

### 4.2 Structure

```
summaryCredit = summaryExpected ? (hasSummary ? 1 : 0) : 1

structure =
    0.35 × hasExperience
  + 0.15 × hasSkills
  + 0.10 × hasEducation
  + 0.10 × summaryCredit
  + 0.10 × sectionOrderScore
  + 0.10 × chronologyConsistent
  + 0.10 × datedEntryRatio
```

| Anchor | Value |
|---|---|
| All sections, ordered, dated, consistent | 1.00 |
| Experience + skills only, undated | 0.50 |
| Fresher with no summary, everything else present | 1.00 — the exemption, not a penalty |

### 4.3 Skills

```
stuffingPenalty = clamp((keywordRepetitionIndex − 0.06) × 5, 0, 0.30)

skills = clamp(
    0.55 × strongEvidenceRatio
  + 0.15 × canonicalizedRatio
  + 0.15 × skillGroupingPresent
  + 0.15 × min(1, totalSkills / 8)
  − stuffingPenalty
)
```

| Anchor | Value |
|---|---|
| 10 canonical skills, grouped, all strongly evidenced | 1.00 |
| 10 canonical skills, grouped, **none** evidenced | 0.45 — listed and organized, but undemonstrated |
| Same, plus stuffing at `keywordRepetitionIndex` 0.12 | 0.15 |

The gap between rows 1 and 2 is 0.55 by construction: **evidence is the majority of this category**,
which is what stops keyword presence from driving the score (§35, Principle 2).

### 4.4 Experience

```
experience =
    0.60 × bulletCompletenessRatio
  + 0.20 × bulletsInLengthBand
  + 0.10 × (1 − firstPersonRatio)
  + 0.10 × clamp(bulletsPerRoleMedian / 4)
```

| Anchor | Value |
|---|---|
| Every bullet action-led, technical, contextual, outcome-bearing; good lengths | 1.00 |
| Duties only — action verbs and tech present, no context or outcome | 0.50 |
| Sparse one-line duties, 2 per role | ≈ 0.38 |

### 4.5 Impact

```
effectiveQuantified = quantifiedBulletRatio × genuineOutcomeRatio

impact = clamp(
    0.12
  + 0.95 × effectiveQuantified
  + 0.08 × min(1, distinctMetricTypes / 3)
  + 0.05 × metricsInRecentRole
)
```

| Anchor | Value |
|---|---|
| No quantified outcomes anywhere | 0.12 — a floor, not a zero |
| 30% effective, 2 metric types, recent role covered | ≈ 0.51 |
| 50% effective, 3 types, recent role covered | ≈ 0.73 |
| 80% effective, 3+ types, recent role covered | 1.00 |

The 0.12 floor is deliberate: a truthful resume with qualitative outcomes is not a zero-impact resume, and
the product must never make fabricating a number the rational move (Principle 5).

### 4.6 Formatting

```
dateScore = dateFormatVariants <= 1 ? 1 : max(0, 1 − 0.25 × (dateFormatVariants − 1))

formatting =
    0.30 × dateScore
  + 0.25 × punctuationConsistency
  + 0.20 × headingCaseConsistency
  + 0.15 × (1 − unusualGlyphRatio)
  + 0.10 × (1 − lineLengthOutlierRatio)
```

| Anchor | Value |
|---|---|
| One date format, consistent punctuation and headings, clean glyphs | 1.00 |
| Three date formats, otherwise clean | 0.85 |

### 4.7 Contact

```
contact =
    0.40 × hasName
  + 0.35 × hasEmail
  + 0.15 × hasPhone
  + 0.10 × min(1, optionalPresent / 2)
```

| Anchor | Value |
|---|---|
| Name, email, phone, ≥ 2 optional | 1.00 |
| Name and email only | 0.75 |
| No name extracted | ≤ 0.60 — usually a parse failure, not a missing name |

## 5. Bounded classification contracts

Three LLM-derived features exist. Each is one narrow question over one small unit, with an enum output.
No prompt may ask for a score, a rating, or a weighted judgment.

| Feature | Unit | Question | Output |
|---|---|---|---|
| `statesContext` | one experience bullet | Does this bullet state what was built, for whom, or at what scale? | `yes` / `no` / `unclear` |
| `statesOutcome` | one experience bullet | Does this bullet state a result or effect, as opposed to only a duty or responsibility? | `yes` / `no` / `unclear` |
| `genuineOutcomeRatio` | one quantified bullet | Is the number an outcome the work produced, or a description of scope/duty? | `outcome` / `scope` / `unclear` |
| skill semantic evidence | one (skill, bullet) pair | Does this bullet demonstrate hands-on use of this skill? | `yes` / `no` / `unclear` |

Rules binding all four:

- **Batched, not fanned out.** All bullets go in one request returning an array of verdicts under a
  `strict: true` schema. Each element is still a bounded per-item judgment, so R2 holds — but it costs
  1–2 calls instead of 80, and avoids the parallel-request cache stampede ([`AI.md`](AI.md) §3).
- Every verdict carries the evidence ID of its bullet. A verdict without one is dropped, not defaulted.
- `unclear` scores `0.5`. It is a real answer, not an error — forcing a binary on an ambiguous bullet is
  what makes runs unstable.
- Resume text is untrusted data ([`AI.md`](AI.md) §5). Because these calls produce enum verdicts and never
  scores, a successful injection cannot move a score — it can at most flip one bullet's verdict.

## 5a. Result precision

Rubric results are clamped to `[0,1]` and then **rounded to 6 decimal places** at the single point where
each rubric returns.

This is not cosmetic. Weights that are exact in decimal are not exact in binary: a genuinely perfect
category sums to `0.9999999999999999`, not `1`. Persisting that leaves floating-point dust in stored
scores and in the version-to-version comparisons the product is built around — two identical resumes could
differ in the sixteenth decimal place and an equality check would call it a change. Six places is far
beyond what a 0–100 score can express, so it never alters a displayed number; it only makes stored scores
exact at the precision they claim.

`NaN` collapses to the category floor rather than propagating, so one malformed feature cannot void an
entire analysis.

## 6. Stability budget — the CI gate

The mechanism that keeps "reproducible" true as prompts and models change.

- Each golden fixture runs **5×** against the live models, through the Message Batches API.
- **Gate:** σ(total score) ≤ **1.5 points**; no single category σ > **3 points**.
- A breach means a feature is too holistic. The fix is to **decompose it further**, never to widen the
  threshold. The gate is never waived — waiving it is precisely how the reproducibility claim becomes
  quietly false.

Rule-only categories must show σ = 0 exactly. Any variance there is a bug in the extractor, not noise.

## 7. Provenance

Every analysis persists `scoring_version`, `prompt_version`, `model_id`, `taxonomy_version`,
`parser_version`, and every feature row records `source` (`rule` | `llm`).

The score-history chart renders a **discontinuity marker, not a trend line**, across any `model_id` or
`scoring_version` change. Without this, "v1 → 72, v2 → 79" cannot distinguish an improved resume from a
drifted model — which would silently invalidate the before/after comparison that §100 names as the
product's core value.

## 8. Potential score and recommendation impact

`estimatedScoreImpact` (§28) and the simulator (§31) are computed by **mutating the persisted feature
vector and re-running the same scorer**:

```
current  = score(features)
proposed = score({ ...features, quantifiedBulletRatio: 0.55 })   // 3 bullets gain outcomes
delta    = proposed − current
```

Never by a model asserting "+5". That would put LLM output in control of the score through the back door,
violating Principle 3. This is the reason `score_features` is persisted at all ([ADR-006](DECISIONS.md#adr-006)).

Deltas are presented as a **range**, and only improvements the user can truthfully make are counted.

## 9. Worked example — golden fixture #1

A synthetic mid-level frontend resume: clean parse, well structured, good experience writing, **weak on
quantified impact**. Three roles, 18 bullets, 12 listed skills.

### Feature vector

| Category | Features |
|---|---|
| Parseability | `textYieldRatio` 0.92 · `readingOrderCoherence` 0.96 · `sectionsDetectedRatio` 1.00 · `contactFieldsExtracted` 1.00 · `glyphAnomalyRatio` 0.002 · `repeatedLineRatio` 0.00 · `isImageOnly` false |
| Structure | experience/skills/education/summary all present · `summaryExpected` true · `sectionOrderScore` 1.00 · `chronologyConsistent` true · `datedEntryRatio` 0.67 (2 of 3 roles dated) |
| Skills | `totalSkills` 12 · `canonicalizedRatio` 0.92 · `skillGroupingPresent` true · `strongEvidenceRatio` 0.58 (7 of 12) · `keywordRepetitionIndex` 0.03 |
| Experience | 18 bullets — action 18, taxonomy 15, context 14, outcome 7 · `bulletsInLengthBand` 0.889 · `firstPersonRatio` 0.00 · `bulletsPerRoleMedian` 6 |
| Impact | `quantifiedBulletRatio` 0.389 (7 of 18) · `genuineOutcomeRatio` 0.714 (5 of 7) · `distinctMetricTypes` 3 · `metricsInRecentRole` true |
| Formatting | `dateFormatVariants` 2 · `punctuationConsistency` 0.94 · `headingCaseConsistency` 1.00 · `unusualGlyphRatio` 0.01 · `lineLengthOutlierRatio` 0.06 |
| Contact | name, email, phone present · `optionalPresent` 2 (location, LinkedIn) |

### Rubric evaluation

```
parseability = 0.30(0.92) + 0.25(0.96) + 0.20(1.00) + 0.10(1.00) + 0.10(0.998) + 0.05(1.00)
             = 0.2760 + 0.2400 + 0.2000 + 0.1000 + 0.0998 + 0.0500          = 0.9658

structure    = 0.35(1) + 0.15(1) + 0.10(1) + 0.10(1) + 0.10(1.00) + 0.10(1) + 0.10(0.67)
                                                                              = 0.9670

skills       = 0.55(0.58) + 0.15(0.92) + 0.15(1) + 0.15(1)      [no stuffing penalty]
             = 0.3190 + 0.1380 + 0.1500 + 0.1500                             = 0.7570

bulletCompletenessRatio = (18 + 15 + 14 + 7) / (4 × 18) = 54/72               = 0.7500
experience   = 0.60(0.7500) + 0.20(0.889) + 0.10(1.00) + 0.10(1.00)
             = 0.4500 + 0.1778 + 0.1000 + 0.1000                             = 0.8278

effectiveQuantified = 0.389 × 0.714                                           = 0.2778
impact       = 0.12 + 0.95(0.2778) + 0.08(1.00) + 0.05(1)
             = 0.1200 + 0.2639 + 0.0800 + 0.0500                             = 0.5139

dateScore    = 1 − 0.25(2 − 1)                                                = 0.7500
formatting   = 0.30(0.75) + 0.25(0.94) + 0.20(1.00) + 0.15(0.99) + 0.10(0.94)
             = 0.2250 + 0.2350 + 0.2000 + 0.1485 + 0.0940                    = 0.9025

contact      = 0.40(1) + 0.35(1) + 0.15(1) + 0.10(1)                          = 1.0000
```

### Weighted total

| Category | Score | Weight | Weighted |
|---|---:|---:|---:|
| Parseability | 0.9658 | 20 | 19.32 |
| Structure | 0.9670 | 15 | 14.50 |
| Skills | 0.7570 | 15 | 11.36 |
| Experience | 0.8278 | 20 | 16.56 |
| Impact | 0.5139 | 15 | 7.71 |
| Formatting | 0.9025 | 10 | 9.02 |
| Contact | 1.0000 | 5 | 5.00 |
| | | | **83.47** |

**Resume Health Score: 83** (round half up).

### What the engine must derive from this

- **Top issue: Impact.** At 0.514 it forfeits 7.29 of 15 available points — more than any other category
  in absolute terms. 11 of 18 bullets carry no magnitude, and 2 of the 7 that do describe scope rather
  than outcome.
- **Second: Skills evidence.** 5 of 12 skills appear only in the Skills list. The recommendation is to
  demonstrate them in experience, not to add more skills.
- **Third: dates.** Two date formats, and one role undated — cheap to fix, worth ≈ 1.2 points combined.
- **Strengths:** parse quality, structure, contact completeness, consistent action-led bullet writing.

### Simulator check

Adding truthful, substantiable outcomes to 3 bullets moves `quantifiedBulletRatio` from 7/18 to 10/18,
`genuineOutcomeRatio` from 5/7 to 8/10, and `statesOutcome` from 7 to 10 of 18:

```
effectiveQuantified = (10/18) × (8/10) = 0.4444
impact      = 0.12 + 0.95(0.4444) + 0.08 + 0.05 = 0.6722    (from 0.5139)  → +2.37 weighted
bulletCompleteness = (18 + 15 + 14 + 10) / 72   = 0.7917
experience  = 0.60(0.7917) + 0.20(0.889) + 0.10 + 0.10 = 0.8528            → +0.50 weighted

total 83.46 → 86.34
```

Reported to the user as **"86–88"** — a range, computed by re-scoring a mutated feature vector, never by a
model asserting a number. Note the delta lands in **two** categories: a bullet that gains an outcome
improves Impact *and* Experience, which a hand-assigned "+5" would have missed entirely.

---

## 10. Status

| Item | State |
|---|---|
| Feature inventory | complete — 7 categories, 3 LLM-derived features |
| Rubric functions with anchors | complete |
| Bounded classification contracts | complete |
| Stability budget | defined; wired to CI at Phase 7 |
| Provenance | defined; schema in [`DATABASE.md`](DATABASE.md) |
| Worked example | complete — golden fixture #1, expected score **83** |

**Anchors are documented judgment, not empirical calibration.** They become defensible only after Phase
15's human-reviewer comparison. See [`SCORING.md`](SCORING.md) §1.
