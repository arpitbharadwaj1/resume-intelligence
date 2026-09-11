# Security & Privacy

Spec background: §13, §44–§48. Uploaded documents are untrusted input; resumes are personal data.

---

## 1. Known gap — third-party model exposure

**Stated honestly because the spec does not address it.**

§46 and §47 promise privacy-by-default, but the architecture sends **full resume text to a third-party
model provider** (Anthropic). The spec never acknowledges this. Nothing about "never log raw resume
content" changes the fact that the content is transmitted off-machine for processing.

Required before any public deployment:

- A plain-language disclosure on the upload page and in the privacy statement: what is sent, to whom,
  and why.
- A decision, recorded in [`DECISIONS.md`](DECISIONS.md), on optional PII redaction before transmission
  (name, email, phone, address stripped and re-attached locally). Feasible because the measurement layer
  scores structure and evidence, not identity — but it degrades contact-field extraction, so it is a
  real tradeoff rather than a free win.
- Confirmation of the provider's data-retention terms for the account in use.

Not a blocker for local development. It is a blocker for sharing the deployed app.

## 2. File upload

Validate in this order, rejecting on first failure with a typed error:

1. Extension — `.pdf`, `.docx` only
2. MIME type
3. **Magic bytes** — `%PDF` for PDF, `PK\x03\x04` for DOCX. A `.pdf` that is actually a ZIP must be
   rejected; there is a test for exactly this.
4. Size ≤ `MAX_RESUME_SIZE` (default 5 MB)

Client-side checks are UX only. **The server repeats every check** — the client is untrusted input.
Parsing is server-side for the same reason: browser-extracted text is forgeable.

## 3. Storage

Private Supabase bucket. No public URLs, ever. Access via signed URLs minted server-side with the
service-role key, which never reaches the client bundle. Analysis URLs use opaque IDs and never expose a
filename or storage path (§42).

Retention: raw files deleted after `RETENTION_DAYS` (default 7). Structured analysis persists; the
source document does not.

## 4. Authorization

Row-level security on every user-owned table, default deny, policies keyed on `auth.uid()`.

Four isolation cases are tested with two real users and must fail closed (§44):

```
User A cannot read User B's resume
User A cannot read User B's analysis
User A cannot modify User B's target profile
User A cannot access User B's files
```

## 5. Logging (§46)

Resumes contain name, email, phone, address, employment history and education.

**Never logged:** raw resume text, extracted resume text, full JD content, prompt inputs containing
personal data, model outputs containing resume content.

**Logged:** request ID, analysis ID, user ID, stage, duration, model ID, error category, token and cost
estimates.

Enforced by test — the log stream is captured during an integration run and asserted to contain no
fixture resume content.

## 6. Prompt injection

See [`AI.md`](AI.md) §5. The structural defense matters more than the prompt-level one: because no LLM
produces a score, a successful injection cannot move one.

## 7. Cost protection (§48)

All configurable, none hardcoded: `MAX_RESUME_SIZE`, `MAX_JD_LENGTH`, `MAX_TEXT_LENGTH` (a *token*
budget), `MAX_OUTPUT_TOKENS`, `MAX_ANALYSES_PER_DAY`, `MAX_AI_RETRIES`, `RETENTION_DAYS`.

Rate limiting is server-enforced. An unprotected `/api/analyze` is a way to spend someone else's money.

**Open item:** `/api/analyze` has no idempotency key. Re-submitting the same resume + JD pays twice.
Add a request hash before Phase 14.
