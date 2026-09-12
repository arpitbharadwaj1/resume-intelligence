/**
 * The bounded-classification seam (docs/MEASUREMENT.md §5).
 *
 * Three of the twenty-odd features cannot be derived by rule: whether a bullet
 * states context, whether it states an outcome, whether a quantified bullet is a
 * real result or restated scope, and whether a bullet demonstrates a skill. Each
 * is a *bounded* question over one small unit with an enum answer — never a score,
 * a rating, or a weighted judgment (R2). A successful prompt injection can at most
 * flip one bullet's verdict; it can never move a category score, because no score
 * originates here.
 *
 * This file defines only the interface and the verdict→number mapping. The
 * implementation is a Gemini API call (`lib/ai/gemini.ts`) that needs a key; the
 * extractors here depend on the interface, so they stay fully testable with a
 * deterministic fake and never import `lib/ai`. §5 also requires these to
 * be *batched* — one request returning an array of per-item verdicts, not one call
 * per bullet — which is why every method takes and returns a list.
 */

/** The universal bounded answer. `unclear` is a real answer, scored at the midpoint. */
export type Ternary = "yes" | "no" | "unclear";

/** Whether a quantified bullet's number is an outcome or merely restated scope. */
export type OutcomeVerdict = "outcome" | "scope" | "unclear";

/** A bullet handed to a classifier, carrying the evidence ID its verdict must cite. */
export interface ClassifiableBullet {
  readonly evidenceId: string;
  readonly text: string;
}

/** A (skill, bullet) pair — the unit for semantic skill evidence. */
export interface ClassifiableSkillBullet {
  readonly skill: string;
  readonly evidenceId: string;
  readonly text: string;
}

/** The two per-bullet Experience verdicts (§3.4). */
export interface ExperienceVerdict {
  readonly evidenceId: string;
  readonly statesContext: Ternary;
  readonly statesOutcome: Ternary;
}

/** The per-quantified-bullet Impact verdict (§3.5). */
export interface OutcomeClassification {
  readonly evidenceId: string;
  readonly verdict: OutcomeVerdict;
}

/** The per-(skill, bullet) evidence verdict (§3.3). */
export interface SkillEvidenceVerdict {
  readonly skill: string;
  readonly evidenceId: string;
  readonly demonstratesSkill: Ternary;
}

/**
 * The seam the AI layer implements. Each method is one batched, bounded call.
 * The extractors accept whichever methods they need, so a test can supply a
 * deterministic fake and no rule feature ever waits on a model.
 */
export interface ResumeClassifier {
  classifyExperienceBullets(
    bullets: readonly ClassifiableBullet[],
  ): Promise<readonly ExperienceVerdict[]>;
  classifyQuantifiedOutcomes(
    bullets: readonly ClassifiableBullet[],
  ): Promise<readonly OutcomeClassification[]>;
  classifySkillEvidence(
    pairs: readonly ClassifiableSkillBullet[],
  ): Promise<readonly SkillEvidenceVerdict[]>;
}

/**
 * Verdict → number. `yes`/`outcome` is full credit, `unclear` is the midpoint,
 * everything else is zero. Forcing a binary on an ambiguous bullet is exactly
 * what makes runs unstable, so the midpoint is deliberate, not a fallback.
 */
export function ternaryScore(verdict: Ternary): number {
  if (verdict === "yes") return 1;
  if (verdict === "unclear") return 0.5;
  return 0;
}

/** Outcome verdict → number, with the same midpoint treatment for `unclear`. */
export function outcomeScore(verdict: OutcomeVerdict): number {
  if (verdict === "outcome") return 1;
  if (verdict === "unclear") return 0.5;
  return 0;
}
