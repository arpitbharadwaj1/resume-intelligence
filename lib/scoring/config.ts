/**
 * Scoring configuration.
 *
 * The single place weights live (spec section 17). Changing any value here
 * changes every score the product has ever produced, so it requires explicit
 * instruction and a documented reason -- and a version bump, because analyses
 * record `scoring_version` and the score-history chart uses it to decide
 * whether two scores are comparable at all.
 *
 * These are product methodology weights. They are not an industry standard and
 * not empirically calibrated -- see docs/SCORING.md section 1.
 */
import type { ScoreCategory } from "@/types/scoring";

export const SCORING_VERSION = "1.0.0";
export const ANALYSIS_VERSION = "1.0.0";

/** Percentage points. Must sum to 100. */
export const CATEGORY_WEIGHTS: Readonly<Record<ScoreCategory, number>> = {
  parseability: 20,
  structure: 15,
  skills: 15,
  experience: 20,
  impact: 15,
  formatting: 10,
  contact: 5,
};

export const TOTAL_WEIGHT = 100;

/**
 * Confidence thresholds for display banding (spec section 25).
 * Internally confidence is a 0-1 number; the UI shows only these bands,
 * because "87.42% confident" is false precision.
 */
export const CONFIDENCE_BANDS = {
  high: 0.8,
  medium: 0.5,
} as const;
