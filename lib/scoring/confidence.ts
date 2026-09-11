/**
 * Confidence.
 *
 * Confidence answers "how much should this category score be trusted?", which is
 * a different question from "how good is the resume?". Two things reduce it:
 *
 *   1. How much of the category came from a model rather than from rules.
 *      Rule-derived categories are reproducible by construction; ones carrying
 *      bounded classifications inherit that classifier's uncertainty.
 *
 *   2. How much evidence there was to measure. Four bullets is a thinner basis
 *      for judging experience quality than forty, whatever the score says.
 *
 * Stored as 0-1, displayed as High / Medium / Low. Never rendered as a
 * percentage -- "87.42% confident" is false precision (spec section 25).
 */
import { CONFIDENCE_BANDS } from "@/lib/scoring/config";
import type { ConfidenceBand, FeatureVector, ScoreCategory } from "@/types/scoring";

import { clamp } from "./rubrics/utils";

/** Ceiling per category, set by how much of it is rule-derived. */
const BASE_CONFIDENCE: Readonly<Record<ScoreCategory, number>> = {
  parseability: 0.95,
  structure: 0.95,
  formatting: 0.95,
  contact: 0.95,
  // These carry bounded LLM classifications and cannot exceed their reliability.
  skills: 0.85,
  experience: 0.82,
  impact: 0.82,
};

/** Observation count at or above which a category has a full basis to judge on. */
const SUFFICIENCY_TARGET = 8;

/**
 * How much evidence the category actually had. Below the target, confidence is
 * scaled down proportionally -- floored at 0.4 so a thin resume still produces a
 * usable signal rather than an unusable one.
 */
function dataSufficiency(category: ScoreCategory, features: FeatureVector): number {
  const observations: number = (() => {
    switch (category) {
      case "skills":
        return features.skills.totalSkills;
      case "experience":
      case "impact":
        // Bullets per role times a conservative assumption of two roles.
        return features.experience.bulletsPerRoleMedian * 2;
      case "parseability":
      case "structure":
      case "formatting":
      case "contact":
        // Measured over the whole document; always a full basis.
        return SUFFICIENCY_TARGET;
    }
  })();

  return clamp(observations / SUFFICIENCY_TARGET, 0.4, 1);
}

export function categoryConfidence(category: ScoreCategory, features: FeatureVector): number {
  // A document that produced no readable text gives every other category
  // nothing to work from, so confidence collapses across the board.
  if (features.parseability.isImageOnly && category !== "parseability") return 0.2;

  return clamp(BASE_CONFIDENCE[category] * dataSufficiency(category, features));
}

/** Display band. The UI shows this, never the underlying number. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_BANDS.high) return "high";
  if (confidence >= CONFIDENCE_BANDS.medium) return "medium";
  return "low";
}
