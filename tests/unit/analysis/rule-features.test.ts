import { describe, expect, it } from "vitest";

import { analyzeRuleDerivedFeatures } from "@/lib/analysis";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import { RUBRICS } from "@/lib/scoring/rubrics";
import type { FeatureVector } from "@/types/scoring";

import golden from "../../fixtures/golden/01-mid-frontend-weak-impact.json" with { type: "json" };
import { loadResume } from "./helpers";

const RULES = analyzeRuleDerivedFeatures(loadResume("01-mid-frontend-weak-impact.txt"), 1);

describe("analyzeRuleDerivedFeatures — the rule layer, end to end", () => {
  it("produces Structure and Contact vectors identical to the hand-computed golden fixture", () => {
    // These two categories are exact fractions in the fixture, so the extractor
    // must land on them precisely — this is the worked example made executable.
    expect(RULES.structure).toEqual(golden.features.structure);
    expect(RULES.contact).toEqual(golden.features.contact);
  });

  it("carries the parser's Parseability features through unchanged", () => {
    expect(RULES.parseability.isImageOnly).toBe(false);
    expect(RULES.parseability.sectionsDetectedRatio).toBe(1);
  });

  it("drives the documented Structure and Contact category scores through the rubrics", () => {
    expect(Number(RUBRICS.structure(RULES.structure).toFixed(4))).toBe(
      golden.expected.categoryScores.structure,
    );
    expect(RUBRICS.contact(RULES.contact)).toBe(golden.expected.categoryScores.contact);
  });

  it("scores Formatting close to the documented value, refining its rounded inputs", () => {
    // docs/MEASUREMENT.md §9 uses illustrative rounded formatting inputs
    // (punctuation 0.94, glyphs 0.01, outliers 0.06) and derives 0.9025. The real
    // extractor measures cleaner values (17/18, 0, ~0), so the category scores a
    // touch higher. Within 0.02 — a difference far below a displayed point.
    expect(RUBRICS.formatting(RULES.formatting)).toBeCloseTo(0.9025, 1);
    expect(RUBRICS.formatting(RULES.formatting)).toBeGreaterThanOrEqual(0.9025);
  });

  it("reconstitutes the full worked-example score when combined with the LLM-derived categories", () => {
    // Until the Skills/Experience/Impact extractors exist, take those three from
    // the golden vector and supply the four rule categories from the extractor.
    // The total must still land on the documented 83 (±1), and the small lift is
    // entirely the Formatting refinement noted above — a reconciliation item for
    // when the golden vector is regenerated from live extractors.
    const combined: FeatureVector = {
      parseability: golden.features.parseability, // page-count independent of the .txt fixture
      structure: RULES.structure,
      formatting: RULES.formatting,
      contact: RULES.contact,
      skills: golden.features.skills,
      experience: golden.features.experience,
      impact: golden.features.impact,
    };

    const total = scoreResumeHealth(combined).total;
    expect(total).toBeGreaterThanOrEqual(83);
    expect(total).toBeLessThanOrEqual(84);
  });
});
