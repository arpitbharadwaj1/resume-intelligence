/**
 * Parseability rubric -- weight 20, entirely rule-derived.
 *
 * Anchors (docs/MEASUREMENT.md section 4.1), asserted in the unit test:
 *   image-only scan                                   0.05
 *   clean single-column text PDF, all sections found  ~0.97
 *   text extracts but reading order scrambled (0.40)  ~0.83
 *
 * Note what is absent: there is no two-column penalty. A two-column resume that
 * extracts cleanly scores exactly as well as a single-column one, because the
 * thing that matters is whether a machine can read it, not how it was laid out
 * (spec section 18).
 */
import type { ParseabilityFeatures } from "@/types/scoring";

import { clamp, finalize } from "./utils";

export function scoreParseability(f: ParseabilityFeatures): number {
  // Nothing downstream is meaningful when there is no text to analyse, so this
  // short-circuits rather than averaging misleadingly high sub-scores.
  if (f.isImageOnly) return 0.05;

  return finalize(
    0.3 * clamp(f.textYieldRatio) +
      0.25 * clamp(f.readingOrderCoherence) +
      0.2 * clamp(f.sectionsDetectedRatio) +
      0.1 * clamp(f.contactFieldsExtracted) +
      0.1 * (1 - clamp(f.glyphAnomalyRatio)) +
      0.05 * (1 - clamp(f.repeatedLineRatio)),
  );
}
