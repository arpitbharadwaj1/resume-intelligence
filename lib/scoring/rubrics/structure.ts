/**
 * Structure rubric -- weight 15, entirely rule-derived.
 *
 * Anchors (docs/MEASUREMENT.md section 4.2):
 *   all sections, ordered, dated, consistent   1.00
 *   experience + skills only, undated          0.50
 *   fresher with no summary, else complete     1.00
 *
 * The third anchor is the point of `summaryExpected`: a recent graduate omitting
 * a summary is following convention, not making a mistake, and the rubric must
 * not read one as the other (spec section 18, section 89).
 */
import type { StructureFeatures } from "@/types/scoring";

import { b, clamp, finalize } from "./utils";

export function scoreStructure(f: StructureFeatures): number {
  const summaryCredit = f.summaryExpected ? b(f.hasSummary) : 1;

  return finalize(
    0.35 * b(f.hasExperience) +
      0.15 * b(f.hasSkills) +
      0.1 * b(f.hasEducation) +
      0.1 * summaryCredit +
      0.1 * clamp(f.sectionOrderScore) +
      0.1 * b(f.chronologyConsistent) +
      0.1 * clamp(f.datedEntryRatio),
  );
}
