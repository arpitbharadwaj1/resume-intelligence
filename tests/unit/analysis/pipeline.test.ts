/**
 * End-to-end pipeline: rawText → analyzeFeatures → scoreResumeHealth.
 *
 * This is the worked example (docs/MEASUREMENT.md §9) made fully executable,
 * with real extractors on all seven categories and fake classifier verdicts
 * matching what §9 documents. The goal is to verify that the three layers compose
 * correctly — analysis, classifier seam, scoring — before any live model is involved.
 *
 * The test pins the total at 83 ± 1 rather than an exact value because the rule
 * extractors compute sharper values than the doc's rounded illustrations (see
 * reconciliation items in the commit log). Once the golden vector is regenerated
 * from live extractors the exact expected total can be locked in.
 */
import { describe, expect, it } from "vitest";

import { analyzeFeatures, analyzeRuleDerivedFeatures } from "@/lib/analysis";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import { RUBRICS } from "@/lib/scoring/rubrics";

import golden from "../../fixtures/golden/01-mid-frontend-weak-impact.json" with { type: "json" };
import { fakeClassifier } from "./classifier-fake";
import { loadResume } from "./helpers";

const TEXT = loadResume("01-mid-frontend-weak-impact.txt");

// Verdicts matching docs/MEASUREMENT.md §9's documented signal counts:
//   Experience: context in 14 of 18 bullets, outcome in 7 of 18.
//   Impact: 5 of 7 quantified bullets are genuine outcomes (two headcounts are scope).
//
// Default is context=yes, outcome=no (14 of 18 bullets have context; only 7 have outcome).
// The 4 bullets without context override it to "no". The 7 outcome bullets get "yes".
const GOLDEN_CLASSIFIER = fakeClassifier({
  everyBullet: { context: "yes", outcome: "no" },
  // Four bullets without context (duty or logistics, no stated what/for-whom/at-scale).
  context: {
    exp_01_bullet_04: "no", // "Partnered with the design system group…"
    exp_01_bullet_05: "no", // "Maintained the weekly release checklist…"
    exp_01_bullet_06: "no", // "Facilitated fortnightly guild sessions…"
    exp_02_bullet_05: "no", // "Reviewed pull requests…"
  },
  // Seven bullets with a stated outcome.
  outcome: {
    exp_01_bullet_01: "yes", // "Rebuilt the dashboard… cutting median time to interactive…"
    exp_01_bullet_02: "yes", // "Introduced a shared component library… reducing code by 38%"
    exp_01_bullet_03: "yes", // "Led a team of 5 engineers…" (headcount is a result)
    exp_02_bullet_01: "yes", // "Delivered a self-service reporting view… 27% fewer tickets"
    exp_02_bullet_03: "yes", // "Cut the onboarding bundle size by 31 percent…"
    exp_02_bullet_06: "yes", // "Supported 3 product squads…" (headcount result)
    exp_03_bullet_01: "yes", // "Shipped a Tailwind site refresh… 4.2% → 6.1% signups"
  },
  // Impact: the two headcount bullets are scope, not genuine outcomes.
  quantifiedOutcome: {
    exp_01_bullet_03: "scope", // "Led a team of 5 engineers…"
    exp_02_bullet_06: "scope", // "Supported 3 product squads…"
    exp_01_bullet_01: "outcome",
    exp_01_bullet_02: "outcome",
    exp_02_bullet_01: "outcome",
    exp_02_bullet_03: "outcome",
    exp_03_bullet_01: "outcome",
  },
});

describe("analyzeFeatures + scoreResumeHealth — full pipeline on fixture 01", () => {
  it("produces a FeatureVector with the expected impact signals", async () => {
    const features = await analyzeFeatures(TEXT, GOLDEN_CLASSIFIER);

    // Rule-derived Impact signals — exact values, σ = 0.
    expect(features.impact.quantifiedBulletRatio).toBeCloseTo(7 / 18, 10);
    expect(features.impact.distinctMetricTypes).toBe(3);
    expect(features.impact.metricsInRecentRole).toBe(true);
    // LLM verdict: 5 of 7 genuine outcomes.
    expect(features.impact.genuineOutcomeRatio).toBeCloseTo(5 / 7, 10);
  });

  it("scores Impact within a point of the worked example's 0.5139", async () => {
    const features = await analyzeFeatures(TEXT, GOLDEN_CLASSIFIER);
    const impactScore = RUBRICS.impact(features.impact);
    // §9: effectiveQuantified = (7/18) × (5/7) = 5/18 ≈ 0.2778; impact ≈ 0.5139.
    expect(impactScore).toBeCloseTo(0.5139, 1);
  });

  it("produces a total Resume Health Score of 83", async () => {
    const features = await analyzeFeatures(TEXT, GOLDEN_CLASSIFIER);
    const result = scoreResumeHealth(features);
    // The extractor is sharper than the doc's rounded illustrations (e.g.
    // canonicalizedRatio 1.0 vs 0.92, action verbs 16 vs 18) so the total sits
    // slightly above the illustrative 83.47. It still rounds to 83 on the weaker
    // classifier verdicts, and remains within ±1.
    expect(result.total).toBeGreaterThanOrEqual(83);
    expect(result.total).toBeLessThanOrEqual(84);
  });

  it("categoriesByPointsLost ranks Impact as the top issue", async () => {
    const features = await analyzeFeatures(TEXT, GOLDEN_CLASSIFIER);
    const result = scoreResumeHealth(features);

    // §9 conclusion: "Top issue: Impact. At 0.514 it forfeits more than any other
    // category in absolute terms."
    const sorted = [...result.categories].sort(
      (a, b) => b.weight - b.weightedScore - (a.weight - a.weightedScore),
    );
    expect(sorted[0]!.category).toBe("impact");
  });

  it("degrades gracefully when the classifier throws, using rule floors", async () => {
    const broken = {
      classifyExperienceBullets: () => Promise.reject(new Error("network")),
      classifyQuantifiedOutcomes: () => Promise.reject(new Error("network")),
      classifySkillEvidence: () => Promise.reject(new Error("network")),
    };
    // Should not throw; all categories should produce valid (lower) scores.
    const features = await analyzeFeatures(TEXT, broken);
    const result = scoreResumeHealth(features);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
    // Without any verdicts, no bullet is "scored" (§5: a bullet with no verdict
    // is dropped, not defaulted). The rule signals (action verb, taxonomy token)
    // only count within a bullet's four-signal average — they do not appear on
    // their own when the verdict is missing, so the ratio is 0, not a partial
    // credit. This is the correct, documented behavior.
    expect(features.experience.bulletCompletenessRatio).toBe(0);
  });

  it("rule-only path still matches golden Structure and Contact exactly", () => {
    const rule = analyzeRuleDerivedFeatures(TEXT, 1);
    expect(rule.structure).toEqual(golden.features.structure);
    expect(rule.contact).toEqual(golden.features.contact);
  });
});
