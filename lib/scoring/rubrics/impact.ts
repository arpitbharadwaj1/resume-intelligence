/**
 * Impact rubric -- weight 15.
 *
 * Anchors (docs/MEASUREMENT.md section 4.5):
 *   no quantified outcomes anywhere                  0.12
 *   30% effective, 2 metric types, recent covered    ~0.51
 *   50% effective, 3 types, recent covered           ~0.73
 *   80% effective, 3+ types, recent covered          1.00
 *
 * Two deliberate choices:
 *
 * The 0.12 floor. A truthful resume whose outcomes are qualitative is not a
 * zero-impact resume, and the product must never make fabricating a number the
 * rational move (Principle 5, spec section 18).
 *
 * `genuineOutcomeRatio` gates `quantifiedBulletRatio` rather than adding to it.
 * "Managed a team of 5" contains a number but describes scope, not an outcome;
 * without the gate, padding a bullet with any digit would raise the score.
 */
import type { ImpactFeatures } from "@/types/scoring";

import { b, clamp, finalize } from "./utils";

const FLOOR = 0.12;
/** Distinct metric families at which variety credit is full. */
const VARIETY_TARGET = 3;

export function scoreImpact(f: ImpactFeatures): number {
  const effectiveQuantified = clamp(f.quantifiedBulletRatio) * clamp(f.genuineOutcomeRatio);

  return finalize(
    FLOOR +
      0.95 * effectiveQuantified +
      0.08 * clamp(f.distinctMetricTypes / VARIETY_TARGET) +
      0.05 * b(f.metricsInRecentRole),
  );
}
