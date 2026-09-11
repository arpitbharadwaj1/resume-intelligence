/**
 * Skills rubric -- weight 15, rule-derived plus one bounded LLM signal
 * (semantic evidence, folded into `strongEvidenceRatio`).
 *
 * Anchors (docs/MEASUREMENT.md section 4.3):
 *   10 canonical skills, grouped, all strongly evidenced   1.00
 *   10 canonical skills, grouped, none evidenced           0.45
 *   same, plus stuffing at keywordRepetitionIndex 0.12     0.15
 *
 * The 0.55 gap between the first two anchors is the design: evidence is the
 * majority of this category. That is what stops keyword presence from driving
 * the score (spec section 35, Principle 2) -- listing a skill is not proof of it.
 */
import type { SkillsFeatures } from "@/types/scoring";

import { b, clamp, finalize } from "./utils";

/** Repetition below this share of document tokens is normal usage, not stuffing. */
const STUFFING_THRESHOLD = 0.06;
const STUFFING_SLOPE = 5;
const STUFFING_MAX_PENALTY = 0.3;

/** Skill count at which coverage credit is full. */
const COVERAGE_TARGET = 8;

export function scoreSkills(f: SkillsFeatures): number {
  const stuffingPenalty = clamp(
    (clamp(f.keywordRepetitionIndex) - STUFFING_THRESHOLD) * STUFFING_SLOPE,
    0,
    STUFFING_MAX_PENALTY,
  );

  return finalize(
    0.55 * clamp(f.strongEvidenceRatio) +
      0.15 * clamp(f.canonicalizedRatio) +
      0.15 * b(f.skillGroupingPresent) +
      0.15 * clamp(f.totalSkills / COVERAGE_TARGET) -
      stuffingPenalty,
  );
}
