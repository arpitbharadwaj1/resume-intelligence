# Resume Intelligence

A resume-intelligence platform that accepts PDF/DOCX resumes, normalizes them into structured data, and
evaluates them against a transparent, versioned scoring methodology — with every finding backed by
evidence drawn from the resume itself.

Personal portfolio project, built in phases. The scoring engine and its measurement layer are
implemented and tested; parsing is in progress; upload, auth and the results UI are not yet built. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for where each phase stands.

---

## What it does

Three analysis modes:

| Mode | Input | Question |
|---|---|---|
| **Resume Health** | Resume | Is my resume structurally and content-wise strong? |
| **Role Readiness** | Resume + target role | Is my resume strong for the kind of job I'm targeting? |
| **Job Match** | Resume + job description | How well does my resume fit this specific job? |

## What it deliberately does not do

It does not claim to compute a universal or employer-specific ATS score, and it does not predict hiring
outcomes. It does not invent experience, skills, employers, certifications, metrics or achievements, and
it will not encourage a user to make a claim they cannot substantiate.

## The interesting engineering problem

An LLM cannot produce a reproducible score. Ask one to rate a resume 0–100 twice and you get two answers,
so any "deterministic scoring engine" fed directly by model output is deterministic in form only.

This project separates the two. Observable, countable **features** are extracted from the resume —
`quantifiedBulletRatio`, `sectionsDetectedRatio`, `startsWithActionVerb` — each traceable to a specific
line of the source document. Where judgment is genuinely needed, the model answers a **bounded question
about one small unit** ("does this bullet state an outcome? yes / no / unclear") rather than returning a
score. Published rubric functions then map features to category scores, and a pure function aggregates
them.

Half the total score weight ends up fully rule-derived, costing nothing in AI and varying not at all. The
rest is held honest by a CI gate that runs each fixture five times and fails the build if the total score
varies by more than 1.5 points.

Every analysis records the scoring, prompt, model, taxonomy and parser versions that produced it — so
when a resume scores 72 and later 79, it's possible to tell whether the resume improved or the model
drifted.

## Documentation

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Working rules — read first |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Positioning and UX principles |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System shape and module boundaries |
| [`docs/MEASUREMENT.md`](docs/MEASUREMENT.md) | Features, rubrics, stability budget *(Phase 0.5)* |
| [`docs/SCORING.md`](docs/SCORING.md) | Weights, explainability, provenance |
| [`docs/AI.md`](docs/AI.md) | Model routing, caching, untrusted input |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema amendments and rules |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Privacy, validation, known gaps |
| [`docs/TESTING.md`](docs/TESTING.md) | Fixture policy, layers, CI gates |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase order and status |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision record |
| [`ATS_Resume_Intelligence_ARCHITECTURE.md`](ATS_Resume_Intelligence_ARCHITECTURE.md) | Original full specification (archived) |

## Stack

Next.js App Router · React · TypeScript (strict) · Tailwind · shadcn/ui · Supabase (Postgres / Auth /
Storage) · Anthropic SDK · Zod · Vitest · Playwright

## Privacy

Resume files are private, stored in a non-public bucket, and deleted after a configurable retention
period. Raw resume content is never written to logs. Resume text is sent to a third-party model provider
for analysis — see [`docs/SECURITY.md`](docs/SECURITY.md) §1 for the disclosure this requires before
public deployment.
