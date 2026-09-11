import { describe, expect, it } from "vitest";

import { CATEGORY_WEIGHTS, SCORING_VERSION, TOTAL_WEIGHT } from "@/lib/scoring/config";
import {
  categoriesByPointsLost,
  scoreResumeHealth,
  simulateChange,
} from "@/lib/scoring/health-score";
import type { FeatureVector } from "@/types/scoring";
import { SCORE_CATEGORIES } from "@/types/scoring";

import golden from "../../fixtures/golden/01-mid-frontend-weak-impact.json" with { type: "json" };

const goldenFeatures = golden.features as FeatureVector;

describe("golden fixture 01 — the hand-computed worked example", () => {
  // docs/MEASUREMENT.md section 9 claims a reviewer can compute this score by
  // hand and match the engine. This test is that claim, executable. If it fails,
  // either the engine drifted or the document is wrong -- and both are bugs.
  it("reproduces the documented total of 83", () => {
    expect(scoreResumeHealth(goldenFeatures).total).toBe(83);
  });

  it("reproduces every documented category score", () => {
    const result = scoreResumeHealth(goldenFeatures);
    const actual = Object.fromEntries(
      result.categories.map((c) => [c.category, Number(c.score.toFixed(4))]),
    );

    expect(actual).toEqual(golden.expected.categoryScores);
  });

  it("identifies impact as the single largest source of lost points", () => {
    const ranked = categoriesByPointsLost(scoreResumeHealth(goldenFeatures));
    expect(ranked[0]?.category).toBe("impact");
    // 15 available, ~7.71 earned.
    expect((ranked[0]!.weight - ranked[0]!.weightedScore)).toBeCloseTo(7.29, 1);
  });

  it("ranks skills evidence as the second largest gap", () => {
    const ranked = categoriesByPointsLost(scoreResumeHealth(goldenFeatures));
    expect(ranked[1]?.category).toBe("skills");
  });
});

describe("aggregation", () => {
  it("applies the configured weights, which sum to 100", () => {
    const sum = Object.values(CATEGORY_WEIGHTS).reduce((a, w) => a + w, 0);
    expect(sum).toBe(TOTAL_WEIGHT);
  });

  it("returns one scored category per defined category, and no others", () => {
    const result = scoreResumeHealth(goldenFeatures);
    expect(result.categories.map((c) => c.category).sort()).toEqual([...SCORE_CATEGORIES].sort());
  });

  it("stamps the scoring version, so a stored score is interpretable later", () => {
    expect(scoreResumeHealth(goldenFeatures).scoringVersion).toBe(SCORING_VERSION);
  });

  it("is deterministic — identical input produces a byte-identical result", () => {
    const a = scoreResumeHealth(goldenFeatures);
    const b = scoreResumeHealth(goldenFeatures);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not mutate the feature vector it is given", () => {
    const before = JSON.stringify(goldenFeatures);
    scoreResumeHealth(goldenFeatures);
    expect(JSON.stringify(goldenFeatures)).toBe(before);
  });

  it("keeps weightedScore equal to score times weight for every category", () => {
    for (const c of scoreResumeHealth(goldenFeatures).categories) {
      expect(c.weightedScore).toBeCloseTo(c.score * c.weight, 10);
    }
  });

  it("produces a total within 0-100 for both a perfect and an empty resume", () => {
    expect(scoreResumeHealth(perfectFeatures()).total).toBe(100);

    const empty = scoreResumeHealth(emptyFeatures());
    expect(empty.total).toBeGreaterThanOrEqual(0);
    expect(empty.total).toBeLessThan(20);
  });

  it("gives an image-only resume a near-zero score without dividing by zero", () => {
    const result = scoreResumeHealth(imageOnlyFeatures());
    expect(Number.isFinite(result.totalExact)).toBe(true);
    expect(result.total).toBeLessThan(15);
    expect(result.categories.every((c) => Number.isFinite(c.score))).toBe(true);
  });
});

describe("simulateChange — how estimated impact is derived", () => {
  it("computes a delta by re-scoring a mutated vector, not by assertion", () => {
    // Three more bullets gain a truthful, substantiable outcome.
    const { delta, projected } = simulateChange(goldenFeatures, (f) => ({
      ...f,
      impact: {
        ...f.impact,
        quantifiedBulletRatio: 10 / 18,
        genuineOutcomeRatio: 8 / 10,
      },
      experience: {
        ...f.experience,
        bulletCompletenessRatio: (18 + 15 + 14 + 10) / 72,
      },
    }));

    expect(delta).toBeGreaterThan(0);
    // Documented in docs/MEASUREMENT.md section 9 as reaching ~86.3.
    expect(projected.totalExact).toBeCloseTo(86.34, 1);
  });

  it("credits a single change across every category it genuinely affects", () => {
    // The point of re-scoring rather than hand-assigning a delta: adding an
    // outcome to a bullet improves Impact *and* Experience. A hand-written
    // "+5" against one category would miss half the effect.
    const before = scoreResumeHealth(goldenFeatures);
    const { projected } = simulateChange(goldenFeatures, (f) => ({
      ...f,
      impact: { ...f.impact, quantifiedBulletRatio: 10 / 18, genuineOutcomeRatio: 8 / 10 },
      experience: { ...f.experience, bulletCompletenessRatio: (18 + 15 + 14 + 10) / 72 },
    }));

    const gained = (name: string) => {
      const a = before.categories.find((c) => c.category === name)!;
      const b = projected.categories.find((c) => c.category === name)!;
      return b.weightedScore - a.weightedScore;
    };

    expect(gained("impact")).toBeGreaterThan(0);
    expect(gained("experience")).toBeGreaterThan(0);
    expect(gained("contact")).toBe(0);
  });

  it("reports no gain when the underlying evidence has not changed", () => {
    // Spec section 31: accepting a suggestion must not raise a score by itself.
    const { delta } = simulateChange(goldenFeatures, (f) => f);
    expect(delta).toBe(0);
  });
});

// --- helpers ---------------------------------------------------------------

function perfectFeatures(): FeatureVector {
  return {
    parseability: {
      textYieldRatio: 1,
      readingOrderCoherence: 1,
      sectionsDetectedRatio: 1,
      contactFieldsExtracted: 1,
      glyphAnomalyRatio: 0,
      repeatedLineRatio: 0,
      isImageOnly: false,
    },
    structure: {
      hasExperience: true,
      hasSkills: true,
      hasEducation: true,
      hasSummary: true,
      summaryExpected: true,
      sectionOrderScore: 1,
      chronologyConsistent: true,
      datedEntryRatio: 1,
    },
    skills: {
      totalSkills: 12,
      canonicalizedRatio: 1,
      skillGroupingPresent: true,
      keywordRepetitionIndex: 0.01,
      strongEvidenceRatio: 1,
    },
    experience: {
      bulletCompletenessRatio: 1,
      bulletsInLengthBand: 1,
      firstPersonRatio: 0,
      bulletsPerRoleMedian: 5,
    },
    impact: {
      quantifiedBulletRatio: 0.9,
      genuineOutcomeRatio: 1,
      distinctMetricTypes: 5,
      metricsInRecentRole: true,
    },
    formatting: {
      dateFormatVariants: 1,
      punctuationConsistency: 1,
      headingCaseConsistency: 1,
      unusualGlyphRatio: 0,
      lineLengthOutlierRatio: 0,
    },
    contact: { hasName: true, hasEmail: true, hasPhone: true, optionalPresent: 3 },
  };
}

function emptyFeatures(): FeatureVector {
  return {
    parseability: {
      textYieldRatio: 0,
      readingOrderCoherence: 0,
      sectionsDetectedRatio: 0,
      contactFieldsExtracted: 0,
      glyphAnomalyRatio: 1,
      repeatedLineRatio: 1,
      isImageOnly: false,
    },
    structure: {
      hasExperience: false,
      hasSkills: false,
      hasEducation: false,
      hasSummary: false,
      summaryExpected: true,
      sectionOrderScore: 0,
      chronologyConsistent: false,
      datedEntryRatio: 0,
    },
    skills: {
      totalSkills: 0,
      canonicalizedRatio: 0,
      skillGroupingPresent: false,
      keywordRepetitionIndex: 0,
      strongEvidenceRatio: 0,
    },
    experience: {
      bulletCompletenessRatio: 0,
      bulletsInLengthBand: 0,
      firstPersonRatio: 1,
      bulletsPerRoleMedian: 0,
    },
    impact: {
      quantifiedBulletRatio: 0,
      genuineOutcomeRatio: 0,
      distinctMetricTypes: 0,
      metricsInRecentRole: false,
    },
    formatting: {
      dateFormatVariants: 5,
      punctuationConsistency: 0,
      headingCaseConsistency: 0,
      unusualGlyphRatio: 1,
      lineLengthOutlierRatio: 1,
    },
    contact: { hasName: false, hasEmail: false, hasPhone: false, optionalPresent: 0 },
  };
}

function imageOnlyFeatures(): FeatureVector {
  const empty = emptyFeatures();
  return { ...empty, parseability: { ...empty.parseability, isImageOnly: true } };
}
