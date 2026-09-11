/**
 * Resume Health scoring engine.
 *
 * A pure function from a feature vector to a score. Same input, same output,
 * always -- no clock, no randomness, no network, no model. The ESLint config
 * forbids this directory from importing lib/ai or lib/supabase so that stays
 * true (Principle 3, docs/MEASUREMENT.md R2).
 *
 * This file is only the aggregation. The judgement lives in the rubrics, and
 * the rubrics' anchors live in docs/MEASUREMENT.md section 4 -- which is what a
 * reviewer checks a score against by hand.
 */
import { CATEGORY_WEIGHTS, SCORING_VERSION } from "@/lib/scoring/config";
import { categoryConfidence } from "@/lib/scoring/confidence";
import { explainCategory } from "@/lib/scoring/explain";
import { RUBRICS } from "@/lib/scoring/rubrics";
import type {
  CategoryScore,
  EvidenceRef,
  FeatureVector,
  HealthScoreResult,
  ScoreCategory,
} from "@/types/scoring";
import { SCORE_CATEGORIES } from "@/types/scoring";

/** Evidence references per category, produced by the analysis layer. */
export type EvidenceMap = Partial<Record<ScoreCategory, readonly EvidenceRef[]>>;

/** Apply a category's rubric to its slice of the vector. */
function applyRubric(category: ScoreCategory, features: FeatureVector): number {
  switch (category) {
    case "parseability":
      return RUBRICS.parseability(features.parseability);
    case "structure":
      return RUBRICS.structure(features.structure);
    case "skills":
      return RUBRICS.skills(features.skills);
    case "experience":
      return RUBRICS.experience(features.experience);
    case "impact":
      return RUBRICS.impact(features.impact);
    case "formatting":
      return RUBRICS.formatting(features.formatting);
    case "contact":
      return RUBRICS.contact(features.contact);
  }
}

/**
 * Round half up. JavaScript's Math.round already rounds half up for positive
 * numbers; naming it makes the tie-breaking rule explicit, because a score that
 * silently changed rounding direction would look like a scoring change to a user
 * comparing two versions.
 */
function roundHalfUp(value: number): number {
  return Math.round(value);
}

export function scoreResumeHealth(
  features: FeatureVector,
  evidence: EvidenceMap = {},
): HealthScoreResult {
  const categories: CategoryScore[] = SCORE_CATEGORIES.map((category) => {
    const score = applyRubric(category, features);
    const weight = CATEGORY_WEIGHTS[category];

    return {
      category,
      score,
      weight,
      weightedScore: score * weight,
      reason: explainCategory(category, features),
      evidence: evidence[category] ?? [],
      confidence: categoryConfidence(category, features),
    };
  });

  const totalExact = categories.reduce((sum, c) => sum + c.weightedScore, 0);

  return {
    total: roundHalfUp(totalExact),
    // Unrounded, because the simulator compares two scores: rounding both first
    // would swallow any improvement smaller than half a point.
    totalExact,
    categories,
    scoringVersion: SCORING_VERSION,
  };
}

/**
 * Score a hypothetical version of the resume.
 *
 * This is how estimatedScoreImpact and the improvement simulator are computed
 * (spec sections 28 and 31): mutate the feature vector, re-run the same scorer,
 * take the difference. A model is never asked what a change is worth -- that
 * would put model output back in control of the score.
 *
 * Deltas are reported to users as a range, never as a promised number.
 */
export function simulateChange(
  features: FeatureVector,
  mutation: (features: FeatureVector) => FeatureVector,
): { readonly delta: number; readonly projected: HealthScoreResult } {
  const current = scoreResumeHealth(features);
  const projected = scoreResumeHealth(mutation(features));
  return { delta: projected.totalExact - current.totalExact, projected };
}

/** Categories ranked by points forfeited -- what the "top issues" list is built from. */
export function categoriesByPointsLost(result: HealthScoreResult): readonly CategoryScore[] {
  return [...result.categories].sort(
    (a, b) => b.weight - b.weightedScore - (a.weight - a.weightedScore),
  );
}
