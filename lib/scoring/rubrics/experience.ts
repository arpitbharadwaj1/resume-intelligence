/**
 * Experience rubric -- weight 20, driven by `bulletCompletenessRatio`.
 *
 * Anchors (docs/MEASUREMENT.md section 4.4):
 *   every bullet action-led, technical, contextual, outcome-bearing   1.00
 *   duties only -- action verbs and tech present, no context/outcome  0.50
 *   sparse one-line duties, 2 per role                                ~0.38
 *
 * `bulletCompletenessRatio` is the mean over bullets of four per-bullet signals,
 * two rule-derived (action verb, taxonomy token) and two bounded classifications
 * (states context, states outcome). That decomposition is the reason this
 * category is stable across runs -- see docs/MEASUREMENT.md R2.
 */
import type { ExperienceFeatures } from "@/types/scoring";

import { clamp, finalize } from "./utils";

/** Bullets per role at which density credit is full. */
const DENSITY_TARGET = 4;

export function scoreExperience(f: ExperienceFeatures): number {
  return finalize(
    0.6 * clamp(f.bulletCompletenessRatio) +
      0.2 * clamp(f.bulletsInLengthBand) +
      0.1 * (1 - clamp(f.firstPersonRatio)) +
      0.1 * clamp(f.bulletsPerRoleMedian / DENSITY_TARGET),
  );
}
