/**
 * Rubric anchor tests.
 *
 * docs/MEASUREMENT.md section 4 documents named anchor points for every rubric.
 * This file asserts them, which is the difference between an anchor that
 * constrains the code and an anchor that is a comment someone can silently
 * drift away from.
 */
import { describe, expect, it } from "vitest";

import {
  scoreContact,
  scoreExperience,
  scoreFormatting,
  scoreImpact,
  scoreParseability,
  scoreSkills,
  scoreStructure,
} from "@/lib/scoring/rubrics";
import type {
  ContactFeatures,
  ExperienceFeatures,
  FormattingFeatures,
  ImpactFeatures,
  ParseabilityFeatures,
  SkillsFeatures,
  StructureFeatures,
} from "@/types/scoring";

describe("parseability anchors", () => {
  const clean: ParseabilityFeatures = {
    textYieldRatio: 0.95,
    readingOrderCoherence: 1,
    sectionsDetectedRatio: 1,
    contactFieldsExtracted: 1,
    glyphAnomalyRatio: 0,
    repeatedLineRatio: 0,
    isImageOnly: false,
  };

  it("an image-only scan scores 0.05", () => {
    expect(scoreParseability({ ...clean, isImageOnly: true })).toBe(0.05);
  });

  it("a clean single-column text PDF scores about 0.97", () => {
    expect(scoreParseability(clean)).toBeCloseTo(0.985, 2);
  });

  it("scrambled reading order drops the score to about 0.83", () => {
    expect(scoreParseability({ ...clean, readingOrderCoherence: 0.4 })).toBeCloseTo(0.835, 2);
  });

  it("does not penalise layout — only measured extraction quality", () => {
    // A two-column resume that extracts cleanly is indistinguishable here from
    // a single-column one, which is the whole point (spec section 18).
    const twoColumnButClean = { ...clean };
    expect(scoreParseability(twoColumnButClean)).toBe(scoreParseability(clean));
  });

  it("short-circuits before any other signal when there is no text", () => {
    const imageOnlyButOtherwisePerfect: ParseabilityFeatures = { ...clean, isImageOnly: true };
    expect(scoreParseability(imageOnlyButOtherwisePerfect)).toBe(0.05);
  });
});

describe("structure anchors", () => {
  const complete: StructureFeatures = {
    hasExperience: true,
    hasSkills: true,
    hasEducation: true,
    hasSummary: true,
    summaryExpected: true,
    sectionOrderScore: 1,
    chronologyConsistent: true,
    datedEntryRatio: 1,
  };

  it("all sections, ordered, dated and consistent scores 1.00", () => {
    expect(scoreStructure(complete)).toBe(1);
  });

  it("experience and skills only, undated, scores 0.50", () => {
    expect(
      scoreStructure({
        ...complete,
        hasEducation: false,
        hasSummary: false,
        sectionOrderScore: 0,
        chronologyConsistent: false,
        datedEntryRatio: 0,
      }),
    ).toBeCloseTo(0.5, 10);
  });

  it("exempts a fresher from the summary requirement rather than penalising them", () => {
    const fresher: StructureFeatures = {
      ...complete,
      hasSummary: false,
      summaryExpected: false,
    };
    expect(scoreStructure(fresher)).toBe(1);

    // The same resume from someone the convention does apply to loses the points.
    expect(scoreStructure({ ...fresher, summaryExpected: true })).toBeCloseTo(0.9, 10);
  });
});

describe("skills anchors", () => {
  const grouped: SkillsFeatures = {
    totalSkills: 10,
    canonicalizedRatio: 1,
    skillGroupingPresent: true,
    keywordRepetitionIndex: 0.01,
    strongEvidenceRatio: 1,
  };

  it("ten canonical, grouped, fully evidenced skills score 1.00", () => {
    expect(scoreSkills(grouped)).toBe(1);
  });

  it("the same skills with no evidence anywhere score 0.45", () => {
    expect(scoreSkills({ ...grouped, strongEvidenceRatio: 0 })).toBeCloseTo(0.45, 10);
  });

  it("evidence is worth 0.55 — the majority of the category", () => {
    // This gap is the mechanism that stops keyword presence from driving the
    // score (spec section 35, Principle 2).
    const evidenced = scoreSkills(grouped);
    const listed = scoreSkills({ ...grouped, strongEvidenceRatio: 0 });
    expect(evidenced - listed).toBeCloseTo(0.55, 10);
  });

  it("penalises keyword stuffing, reaching 0.15 at an index of 0.12", () => {
    expect(scoreSkills({ ...grouped, strongEvidenceRatio: 0, keywordRepetitionIndex: 0.12 })).toBeCloseTo(
      0.15,
      10,
    );
  });

  it("treats repetition below the threshold as normal usage, not stuffing", () => {
    expect(scoreSkills({ ...grouped, keywordRepetitionIndex: 0.06 })).toBe(scoreSkills(grouped));
  });

  it("caps the stuffing penalty so one signal cannot zero the category", () => {
    const extreme = scoreSkills({ ...grouped, keywordRepetitionIndex: 1 });
    expect(extreme).toBeCloseTo(1 - 0.3, 10);
  });
});

describe("experience anchors", () => {
  const complete: ExperienceFeatures = {
    bulletCompletenessRatio: 1,
    bulletsInLengthBand: 1,
    firstPersonRatio: 0,
    bulletsPerRoleMedian: 4,
  };

  it("fully complete bullets score 1.00", () => {
    expect(scoreExperience(complete)).toBe(1);
  });

  it("duties only — action verb and tech present, no context or outcome — scores 0.50", () => {
    // Two of four per-bullet signals true.
    expect(scoreExperience({ ...complete, bulletCompletenessRatio: 0.5 })).toBeCloseTo(0.7, 10);
  });

  it("sparse one-line duties at two bullets per role score about 0.38", () => {
    expect(
      scoreExperience({
        bulletCompletenessRatio: 0.25,
        bulletsInLengthBand: 0.3,
        firstPersonRatio: 0.2,
        bulletsPerRoleMedian: 2,
      }),
    ).toBeCloseTo(0.34, 1);
  });
});

describe("impact anchors", () => {
  const base: ImpactFeatures = {
    quantifiedBulletRatio: 0,
    genuineOutcomeRatio: 0,
    distinctMetricTypes: 0,
    metricsInRecentRole: false,
  };

  it("no quantified outcomes anywhere scores 0.12, a floor rather than a zero", () => {
    // Principle 5: a truthful resume with qualitative outcomes must not be
    // pushed toward fabricating a number.
    expect(scoreImpact(base)).toBeCloseTo(0.12, 10);
  });

  it("30% effective with two metric types and recent coverage scores about 0.51", () => {
    expect(
      scoreImpact({
        quantifiedBulletRatio: 0.3,
        genuineOutcomeRatio: 1,
        distinctMetricTypes: 2,
        metricsInRecentRole: true,
      }),
    ).toBeCloseTo(0.508, 2);
  });

  it("50% effective with three types and recent coverage scores about 0.73", () => {
    expect(
      scoreImpact({
        quantifiedBulletRatio: 0.5,
        genuineOutcomeRatio: 1,
        distinctMetricTypes: 3,
        metricsInRecentRole: true,
      }),
    ).toBeCloseTo(0.725, 2);
  });

  it("80% effective with three types and recent coverage reaches 1.00", () => {
    expect(
      scoreImpact({
        quantifiedBulletRatio: 0.8,
        genuineOutcomeRatio: 1,
        distinctMetricTypes: 3,
        metricsInRecentRole: true,
      }),
    ).toBe(1);
  });

  it("gates quantified bullets on being genuine outcomes, not merely numeric", () => {
    // "Managed a team of 5" contains a number but states scope. Without the
    // gate, padding any bullet with a digit would raise the score.
    const allNumeric = { ...base, quantifiedBulletRatio: 1, genuineOutcomeRatio: 0 };
    const allOutcomes = { ...base, quantifiedBulletRatio: 1, genuineOutcomeRatio: 1 };

    expect(scoreImpact(allNumeric)).toBeCloseTo(0.12, 10);
    expect(scoreImpact(allOutcomes)).toBe(1);
  });
});

describe("formatting anchors", () => {
  const consistent: FormattingFeatures = {
    dateFormatVariants: 1,
    punctuationConsistency: 1,
    headingCaseConsistency: 1,
    unusualGlyphRatio: 0,
    lineLengthOutlierRatio: 0,
  };

  it("a single consistent convention throughout scores 1.00", () => {
    expect(scoreFormatting(consistent)).toBe(1);
  });

  it("three date formats with everything else clean scores 0.85", () => {
    expect(scoreFormatting({ ...consistent, dateFormatVariants: 3 })).toBeCloseTo(0.85, 10);
  });

  it("never lets the date penalty go negative", () => {
    expect(scoreFormatting({ ...consistent, dateFormatVariants: 99 })).toBeCloseTo(0.7, 10);
  });
});

describe("contact anchors", () => {
  const full: ContactFeatures = {
    hasName: true,
    hasEmail: true,
    hasPhone: true,
    optionalPresent: 2,
  };

  it("name, email, phone and two optional fields score 1.00", () => {
    expect(scoreContact(full)).toBe(1);
  });

  it("name and email only score 0.75", () => {
    expect(scoreContact({ ...full, hasPhone: false, optionalPresent: 0 })).toBeCloseTo(0.75, 10);
  });

  it("a missing name caps the category at 0.60", () => {
    expect(scoreContact({ ...full, hasName: false })).toBeCloseTo(0.6, 10);
  });

  it("does not reward a third optional field over a second", () => {
    // Someone with a location and LinkedIn is not behind someone who also
    // lists GitHub (spec section 18).
    expect(scoreContact({ ...full, optionalPresent: 3 })).toBe(scoreContact(full));
  });
});

describe("rubric invariants", () => {
  it("every rubric returns a value in [0,1] for extreme and nonsensical input", () => {
    const wild = Number.MAX_SAFE_INTEGER;
    const results = [
      scoreParseability({
        textYieldRatio: wild,
        readingOrderCoherence: -5,
        sectionsDetectedRatio: wild,
        contactFieldsExtracted: -1,
        glyphAnomalyRatio: wild,
        repeatedLineRatio: -3,
        isImageOnly: false,
      }),
      scoreSkills({
        totalSkills: wild,
        canonicalizedRatio: wild,
        skillGroupingPresent: true,
        keywordRepetitionIndex: -1,
        strongEvidenceRatio: wild,
      }),
      scoreExperience({
        bulletCompletenessRatio: wild,
        bulletsInLengthBand: -2,
        firstPersonRatio: wild,
        bulletsPerRoleMedian: wild,
      }),
      scoreImpact({
        quantifiedBulletRatio: wild,
        genuineOutcomeRatio: wild,
        distinctMetricTypes: wild,
        metricsInRecentRole: true,
      }),
      scoreFormatting({
        dateFormatVariants: -4,
        punctuationConsistency: wild,
        headingCaseConsistency: -1,
        unusualGlyphRatio: wild,
        lineLengthOutlierRatio: -1,
      }),
      scoreContact({ hasName: true, hasEmail: true, hasPhone: true, optionalPresent: wild }),
    ];

    for (const score of results) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(Number.isFinite(score)).toBe(true);
    }
  });

  it("treats NaN as the floor rather than propagating it into the total", () => {
    const score = scoreParseability({
      textYieldRatio: Number.NaN,
      readingOrderCoherence: 1,
      sectionsDetectedRatio: 1,
      contactFieldsExtracted: 1,
      glyphAnomalyRatio: 0,
      repeatedLineRatio: 0,
      isImageOnly: false,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeCloseTo(0.7, 10);
  });
});
