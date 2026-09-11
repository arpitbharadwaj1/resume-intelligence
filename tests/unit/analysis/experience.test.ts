import { describe, expect, it } from "vitest";

import {
  assembleExperienceFeatures,
  buildAnalysisInput,
  extractExperienceFeatures,
  extractExperienceRuleSignals,
  inferProfile,
  type ExperienceRuleSignals,
} from "@/lib/analysis";

import { fakeClassifier } from "./classifier-fake";
import { inputFor } from "./helpers";

function ruleSignalsFor(name: string): ExperienceRuleSignals {
  const input = inputFor(name);
  return extractExperienceRuleSignals(inferProfile(input));
}

describe("extractExperienceRuleSignals", () => {
  it("measures fixture 01's rule signals", () => {
    const rule = ruleSignalsFor("01-mid-frontend-weak-impact.txt");

    expect(rule.bullets).toHaveLength(18);
    // Sixteen of eighteen open with a strong action verb. The two that do not —
    // "Supported…" and "Attended…" — open with *weak* verbs, which are held in a
    // separate list and deliberately excluded; docs/MEASUREMENT.md §9 rounds this
    // to 18, but the extractor is the sharper of the two.
    const actionLed = rule.bullets.filter((b) => b.startsWithActionVerb).length;
    expect(actionLed).toBe(16);
    // Three roles of six bullets each.
    expect(rule.bulletsPerRoleMedian).toBe(6);
    // Sixteen of eighteen bullets sit in the 8–40 word band; the terse "Maintained
    // the weekly release checklist and rota." and the very long guild-sessions
    // bullet fall outside.
    expect(rule.bulletsInLengthBand).toBeCloseTo(16 / 18, 10);
    // Every bullet is written impersonally.
    expect(rule.firstPersonRatio).toBe(0);
  });

  it("recognises a technology named with a trailing period", () => {
    const input = buildAnalysisInput(
      [
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Present",
        "- Migrated the customer portal to Next.js.",
      ].join("\n"),
      1,
    );
    const rule = extractExperienceRuleSignals(inferProfile(input));
    expect(rule.bullets[0]!.containsTaxonomyToken).toBe(true);
  });

  it("does not count a weak-verb or noun opener as action-led", () => {
    const input = buildAnalysisInput(
      [
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Present",
        "- Responsible for the checkout page and its tests.",
        "- Supported the on-call rotation each fortnight.",
        "- Rebuilt the checkout page in React from the ground up.",
      ].join("\n"),
      1,
    );
    const rule = extractExperienceRuleSignals(inferProfile(input));
    expect(rule.bullets.map((b) => b.startsWithActionVerb)).toEqual([false, false, true]);
  });

  it("counts first-person bullets", () => {
    const input = buildAnalysisInput(
      [
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Present",
        "- I rebuilt the dashboard and shipped it to production.",
        "- Delivered a reporting view used across three squads daily.",
      ].join("\n"),
      1,
    );
    const rule = extractExperienceRuleSignals(inferProfile(input));
    expect(rule.firstPersonRatio).toBe(0.5);
  });
});

describe("assembleExperienceFeatures", () => {
  const rule: ExperienceRuleSignals = {
    bullets: [
      { evidenceId: "exp_01_bullet_01", text: "a", startsWithActionVerb: true, containsTaxonomyToken: true },
      { evidenceId: "exp_01_bullet_02", text: "b", startsWithActionVerb: true, containsTaxonomyToken: false },
    ],
    bulletsInLengthBand: 1,
    firstPersonRatio: 0,
    bulletsPerRoleMedian: 2,
  };

  it("averages the four per-bullet signals", () => {
    // Bullet 1: (1 + 1 + 1 + 1)/4 = 1.0. Bullet 2: (1 + 0 + 0.5 + 0)/4 = 0.375.
    // Mean of the two = 0.6875.
    const features = assembleExperienceFeatures(rule, [
      { evidenceId: "exp_01_bullet_01", statesContext: "yes", statesOutcome: "yes" },
      { evidenceId: "exp_01_bullet_02", statesContext: "unclear", statesOutcome: "no" },
    ]);
    expect(features.bulletCompletenessRatio).toBeCloseTo(0.6875, 10);
    // Rule aggregates pass through untouched.
    expect(features.bulletsPerRoleMedian).toBe(2);
  });

  it("drops a bullet the classifier returned no verdict for, rather than zeroing it", () => {
    // Only bullet 1 is answered, so completeness is its score alone (1.0), not
    // averaged against a defaulted zero for bullet 2.
    const features = assembleExperienceFeatures(rule, [
      { evidenceId: "exp_01_bullet_01", statesContext: "yes", statesOutcome: "yes" },
    ]);
    expect(features.bulletCompletenessRatio).toBe(1);
  });
});

describe("extractExperienceFeatures — seam end to end", () => {
  it("composes rule signals with classifier verdicts on fixture 01", async () => {
    const input = inputFor("01-mid-frontend-weak-impact.txt");

    // With every bullet judged to state both context and outcome, completeness is
    // (16 action + 10 taxonomy + 18 context + 18 outcome) / 72 = 62/72.
    const generous = await extractExperienceFeatures(
      input,
      fakeClassifier({ everyBullet: { context: "yes", outcome: "yes" } }),
    );
    expect(generous.bulletCompletenessRatio).toBeCloseTo(62 / 72, 10);

    // With none, only the two rule signals remain: (16 + 10) / 72 = 26/72.
    const bare = await extractExperienceFeatures(
      input,
      fakeClassifier({ everyBullet: { context: "no", outcome: "no" } }),
    );
    expect(bare.bulletCompletenessRatio).toBeCloseTo(26 / 72, 10);
  });
});
