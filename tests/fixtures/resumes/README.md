# Resume fixtures — synthetic, authored for this project

Every `.txt` file in this directory was **invented for this repository**. Every name, employer,
school, email address, phone number, URL, date and metric is fictional. None of it is copied,
adapted or paraphrased from a real person's resume, a real job posting, a real job requisition,
or any file elsewhere on the development machine.

## Why this matters

This is the fixture policy in [`docs/TESTING.md` §1 — Fixture policy, synthetic only](../../../docs/TESTING.md#1-fixture-policy--synthetic-only),
which is itself a restatement of the hard boundary in [`CLAUDE.md` §0](../../../CLAUDE.md#0-hard-boundary--personal-project-zero-company-data).
It is a boundary, not a preference:

- A real candidate resume from any ATS or recruiting pipeline is off-limits.
- A third party's real resume is off-limits **regardless of how it was obtained**, including files
  already sitting on this machine.
- Test job descriptions are public postings or synthetic; internal requisitions are off-limits.

Two independent reasons. First, this is a personal portfolio project deliberately separated from the
author's employer, and no company data or IP enters the repo at any phase. Second, a third party's
real resume carries PII obligations that exist regardless of the company boundary.

There is also a practical reason the synthetic route is the better one: these fixtures are
**reproducible and precisely controllable**. `01-mid-frontend-weak-impact.txt` is authored to produce
the exact feature vector hand-computed in [`docs/MEASUREMENT.md` §9](../../../docs/MEASUREMENT.md#9-worked-example--golden-fixture-1)
— 18 bullets, 7 quantified, 2 of those describing scope rather than outcome. A borrowed resume could
never be dialled in like that.

## File format

Each file is **plain text as a PDF or DOCX parser would emit it**, not markdown: no `#` headings, no
markdown emphasis, hyphen or asterisk bullets only, and line wrapping where a real extractor would
wrap. Whitespace, column bleed and inconsistent spacing in these files are deliberate — they are the
signal several extractors are being tested against.

## Scenario coverage

Numbered against the twelve golden scenarios in §55 of the architecture specification.

| File | §55 scenario | Designed to exercise |
|---|---|---|
| `01-mid-frontend-weak-impact.txt` | (golden fixture #1, `MEASUREMENT.md` §9) | The hand-computed worked example: clean parse, good structure, **weak Impact** — 7 of 18 bullets quantified, 2 of those scope not outcome; 2 date formats, 1 undated role, no GitHub |
| `02-two-column.txt` | 1 — two-column resume | §18: layout is never itself a penalty. Interleaved reading order with genuinely strong content, so only measured extraction quality may move the score |
| `03-image-only.txt` | 2 — image-heavy resume | `isImageOnly` (< 200 extracted chars on a ≥ 1 page document) and the Parseability floor of 0.05 |
| `04-strong-resume.txt` | 3 — strong resume + weak JD match | The high-water mark: quantified outcomes throughout, strong evidence for every listed skill, one date format, complete contact block. Pair with an unrelated JD for scenario 3 |
| `05-weak-resume.txt` | 4 — weak resume + strong JD match | Duties-only bullets, zero metrics anywhere, no summary, three heading-case conventions and three date formats. Exercises the 0.12 Impact floor and the formatting consistency features |
| `06-skills-no-evidence.txt` | 5 — skill listed with no evidence | `strongEvidenceRatio`: 15 skills listed, only 3 (Python, SQL, PostgreSQL) demonstrated in Experience. Strong vs weak vs missing evidence, and the flat comma-dump form of `skillGroupingPresent` |
| `07-synonym-variants.txt` | 6 — skill synonym matching | `canonicalizedRatio`: alias forms used consistently throughout — "Amazon Web Services", "React.js", "Postgres", "JS", "TS", "K8s" |
| `08-career-changer.txt` | 7 — career changer | 6 years secondary teaching, then a bootcamp, then 1 year as a junior developer. Seniority inference, role-history/target-role divergence, and transferable-evidence handling |
| `09-fresher.txt` | 8 — fresher | `summaryExpected = false` for inferred `entry` seniority — the exemption, not a penalty. Projects and internships as the only experience evidence |
| `10-executive.txt` | 9 — senior executive | 18 years, VP Engineering. Business outcomes and leadership language with few hands-on technical tokens: `containsTaxonomyToken` must not punish a genuinely senior non-IC resume |
| `11-keyword-stuffed.txt` | 10 — keyword-stuffed resume | `keywordRepetitionIndex` and the `stuffingPenalty`: ~100 comma-separated keywords plus heavy in-bullet repetition. §35 Principle 2 — keyword frequency alone never drives a score |
| `12-missing-sections.txt` | 12 — missing standard sections | Experience only: no Skills, no Education, no Summary. Structure category and `sectionsDetectedRatio` |

Scenario 11 (*resume with parsing problems*) is covered jointly by `03-image-only.txt` (extraction
failure) and `02-two-column.txt` (degraded reading order), which are the two distinct parse failure
modes the Parseability features distinguish.

## Adding a fixture

1. Write it yourself. Do not start from anyone's real resume, and do not open one "just to see the
   shape of it".
2. Use obviously fictional names, employers and schools. Do not use real well-known companies.
3. Use `@examplemail.test` addresses and invented phone numbers.
4. Plain extracted-text formatting only — see **File format** above.
5. Add a row to the table above naming the §55 scenario and the features it exercises.
