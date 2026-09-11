import { describe, expect, it } from "vitest";

import {
  assembleImpactFeatures,
  buildAnalysisInput,
  extractImpactFeatures,
  extractImpactRuleSignals,
  inferProfile,
  type ImpactRuleSignals,
} from "@/lib/analysis";

import { fakeClassifier } from "./classifier-fake";
import { inputFor } from "./helpers";

function ruleSignalsFor(name: string): ImpactRuleSignals {
  const input = inputFor(name);
  return extractImpactRuleSignals(inferProfile(input));
}

/** Build a one-role résumé whose single bullet is the given text. */
function bulletFixture(bullet: string): ImpactRuleSignals {
  const input = buildAnalysisInput(
    ["EXPERIENCE", "Developer", "Acme", "Jan 2020 - Present", `- ${bullet}`].join("\n"),
    1,
  );
  return extractImpactRuleSignals(inferProfile(input));
}

describe("extractImpactRuleSignals", () => {
  it("measures fixture 01's magnitude signals", () => {
    const rule = ruleSignalsFor("01-mid-frontend-weak-impact.txt");

    // Seven of eighteen bullets carry a magnitude.
    expect(rule.quantifiedBulletRatio).toBeCloseTo(7 / 18, 10);
    // Percentages, a duration and headcounts — three of the six families.
    expect(rule.distinctMetricTypes).toBe(3);
    // The most recent role has quantified bullets.
    expect(rule.metricsInRecentRole).toBe(true);
  });

  it("recognises each metric family", () => {
    expect(bulletFixture("Cut load time by 42 percent.").distinctMetricTypes).toBe(1);
    expect(bulletFixture("Reduced annual spend by $40,000.").distinctMetricTypes).toBe(1);
    // "$1.2 million" is both a currency and a scale magnitude — two families, not one.
    expect(bulletFixture("Reduced spend by $1.2 million a year.").distinctMetricTypes).toBe(2);
    expect(bulletFixture("Cut build time from 9 minutes to 2 minutes.").distinctMetricTypes).toBe(1);
    expect(bulletFixture("Improved throughput 3x under peak load.").distinctMetricTypes).toBe(1);
    expect(bulletFixture("Scaled the platform to 5 million users.").distinctMetricTypes).toBeGreaterThanOrEqual(1);
    expect(bulletFixture("Mentored 4 junior engineers to promotion.").distinctMetricTypes).toBe(1);
  });

  it("does not read a duration as a headcount", () => {
    // "1.6 seconds" is a duration, not "1.6 <plural noun>"; only the duration
    // family should fire, so the count of distinct families stays 1.
    const rule = bulletFixture("Cut time to interactive from 4.1 seconds to 1.6 seconds.");
    expect(rule.distinctMetricTypes).toBe(1);
  });

  it("returns a floor of zeros for a résumé with no magnitudes", () => {
    const rule = bulletFixture("Maintained the release checklist and the on-call rota.");
    expect(rule.quantifiedBulletRatio).toBe(0);
    expect(rule.distinctMetricTypes).toBe(0);
    expect(rule.metricsInRecentRole).toBe(false);
  });
});

describe("assembleImpactFeatures", () => {
  it("counts only genuine outcomes among quantified bullets", () => {
    const rule: ImpactRuleSignals = {
      quantifiedBullets: [
        { evidenceId: "exp_01_bullet_01", text: "cut load time 40%", roleIndex: 0, bulletIndex: 0 },
        { evidenceId: "exp_01_bullet_02", text: "managed a team of 5", roleIndex: 0, bulletIndex: 1 },
      ],
      quantifiedBulletRatio: 2 / 3,
      distinctMetricTypes: 2,
      metricsInRecentRole: true,
    };
    // One real outcome, one restated scope → 0.5, even though both are quantified.
    const features = assembleImpactFeatures(rule, [
      { evidenceId: "exp_01_bullet_01", verdict: "outcome" },
      { evidenceId: "exp_01_bullet_02", verdict: "scope" },
    ]);
    expect(features.genuineOutcomeRatio).toBe(0.5);
    expect(features.quantifiedBulletRatio).toBeCloseTo(2 / 3, 10);
  });
});

describe("extractImpactFeatures — seam end to end", () => {
  it("reproduces the worked example's genuine-outcome ratio on fixture 01", async () => {
    const input = inputFor("01-mid-frontend-weak-impact.txt");

    // The two headcount bullets — "Led a team of 5 engineers" and "Supported 3
    // product squads" — are scope, not outcome; the other five quantified bullets
    // are genuine. That is docs/MEASUREMENT.md §9's 5-of-7 = 0.714.
    const features = await extractImpactFeatures(
      input,
      fakeClassifier({
        quantifiedOutcome: {
          exp_01_bullet_03: "scope",
          exp_02_bullet_06: "scope",
          exp_01_bullet_01: "outcome",
          exp_01_bullet_02: "outcome",
          exp_02_bullet_01: "outcome",
          exp_02_bullet_03: "outcome",
          exp_03_bullet_01: "outcome",
        },
      }),
    );

    expect(features.genuineOutcomeRatio).toBeCloseTo(5 / 7, 10);
    expect(features.quantifiedBulletRatio).toBeCloseTo(7 / 18, 10);
    expect(features.distinctMetricTypes).toBe(3);
    expect(features.metricsInRecentRole).toBe(true);
  });
});
