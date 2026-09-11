# Product

Full product definition is §1–§5, §36–§38, §63–§65. This document states the positioning rules that
constrain implementation.

---

## 1. What this product promises

Help a candidate understand whether their resume is strong, how ready it is for a target role, how
closely it matches a specific job, what is reducing the score, what to improve, why it matters, what
evidence supports each finding, and how the resume changes over time.

## 2. Positioning rule — the one that constrains everything

**Never claim to calculate an employer-specific or universal ATS score.** No real ATS is being simulated
and no hiring outcome is being predicted.

The three named scores are the product: **Resume Health**, **Role Readiness**, **Job Match**.

Every results page carries:

> Scores are generated using our resume analysis methodology and are intended as guidance. They are not a
> prediction of a specific employer's ATS behavior or hiring decision.

## 3. Three modes

| Mode | Input | Shows |
|---|---|---|
| Resume Health | Resume | Health score, category breakdown, strengths, top problems, improvement plan |
| Role Readiness | + target role context | Health + Role Readiness, role-specific gaps |
| Job Match | + job description | Health + Job Match, required/preferred coverage, responsibility alignment, missing and weak requirements |

## 4. UX principles

- **Do not over-question the user.** Required context is target role and experience range; everything
  else is optional.
- **Never ask for information already present in the JD.** Parse it, then show it for confirmation.
- **Never an indefinite spinner.** §38's explicit states render as real progress.
- **At most ~5 recommendations initially.** Dozens of changes is not a product, it is a wall.
- Distinguish **missing / weak / strong** evidence visibly, not just in the data model.

## 5. What the product will not do

**Never encourage a false claim.** Recommendations may tell a user to add a metric *if they can
substantiate one*; they may never supply the metric. Rewrites are checked for newly-introduced facts —
new skill, technology, employer, certification, metric, responsibility or achievement — and flagged or
rejected (§33).

Keyword stuffing is not the goal. The product optimizes for keyword presence *plus* context, evidence and
readability (§35).

## 6. The real value

The score is the entry point, not the product:

```
Score → Why? → Evidence → What's hurting me? → What should I change?
      → Make the change → Re-analyze → Before / After
```

A resume can be ATS-friendly and still a poor match for a job. A skill can be present but weakly
evidenced. A change worth 1 point may still matter to a recruiter. These distinctions are the product
(§63).

## 7. Not in V1

Payments, cover-letter generation, LinkedIn scraping, job-board integrations, browser extension, full
resume builder, interview prep, microservices, complex vector infrastructure (§58).
