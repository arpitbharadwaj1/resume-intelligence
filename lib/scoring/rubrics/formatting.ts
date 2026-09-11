/**
 * Formatting rubric -- weight 10, entirely rule-derived.
 *
 * Anchors (docs/MEASUREMENT.md section 4.6):
 *   one date format, consistent punctuation and headings, clean glyphs   1.00
 *   three date formats, otherwise clean                                  0.85
 *
 * Everything measured here is observable in extracted text. Visual properties a
 * parser cannot see -- font choice, colour, margins -- are deliberately absent
 * rather than guessed at.
 */
import type { FormattingFeatures } from "@/types/scoring";

import { clamp, finalize } from "./utils";

const DATE_VARIANT_PENALTY = 0.25;

export function scoreFormatting(f: FormattingFeatures): number {
  const dateScore =
    f.dateFormatVariants <= 1
      ? 1
      : Math.max(0, 1 - DATE_VARIANT_PENALTY * (f.dateFormatVariants - 1));

  return finalize(
    0.3 * dateScore +
      0.25 * clamp(f.punctuationConsistency) +
      0.2 * clamp(f.headingCaseConsistency) +
      0.15 * (1 - clamp(f.unusualGlyphRatio)) +
      0.1 * (1 - clamp(f.lineLengthOutlierRatio)),
  );
}
