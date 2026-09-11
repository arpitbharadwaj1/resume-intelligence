# Architecture

Full system design is §6–§8, §11–§12, §40. This document records the shape of the system and the
decisions that differ from the spec.

---

## 1. Shape

Modular monolith on Next.js App Router. One repo, one deploy. No microservices in V1
([ADR-002](DECISIONS.md#adr-002)).

```
Upload → validate → extract text → quality check → normalize
       → structured extraction (LLM) → Zod → evidence mapping
       → feature extraction → rubrics → feature vector
       → deterministic scoring → recommendations → persist
```

The middle of that chain is the amendment: the spec goes straight from LLM output to a weighted sum with
nothing in between. See [`MEASUREMENT.md`](MEASUREMENT.md).

## 2. Why a server is required

The client is untrusted input, so four things cannot live in a browser: AI keys (§47), service-role
signed URLs (§45), upload validation and document parsing (§4, §11 — browser-extracted text is
forgeable), and rate limiting (§48). Roughly ten of eleven `lib/` directories are server-side; this is a
backend with a UI, not a frontend app.

## 3. Module boundaries

| Directory | Owns | Must not |
|---|---|---|
| `lib/parser/` | Text extraction, normalization, parse-quality features | Know about scoring |
| `lib/ai/` | Model calls, prompts, schemas | Compute any score |
| `lib/analysis/` | Feature extraction per category | Apply weights |
| `lib/scoring/` | Rubrics, aggregation, explanation | **Import from `lib/ai/`** (ESLint-enforced) |
| `lib/recommendations/` | Gap engine, prioritization, rewrite | Assign score deltas directly — it calls the scorer |
| `lib/taxonomy/` | Canonical skills, synonyms, roles, action verbs | Contain company-derived content |

Every subsystem is independently testable. The orchestrator (§40) coordinates; it does not embed the
rules.

## 4. Evidence as a first-class subsystem

Evidence IDs (`exp_02_bullet_03`) are assigned during parsing and survive into every downstream finding,
feature value, score explanation and recommendation. This is not UI metadata — it is what makes a score
auditable by a human, and what lets §27 answer "why 72?" without a model call.

Finding → evidence → confidence → score impact (§24).

## 5. Async posture

V1 may run analysis synchronously if it reliably completes quickly — but the domain must not depend on a
single long-lived HTTP request (§50). Analyses have explicit status states (§38) from the start, so
moving to background processing is a transport change, not a redesign.

The p95 latency measurement in Phase 7 decides whether V1 ships synchronous.

## 6. Versioning

Parser, prompts, taxonomy, scoring config and resume content are each versioned, and every analysis
records all five. See [`SCORING.md`](SCORING.md) §8 for why this is load-bearing rather than bookkeeping.
