import { describe, expect, it } from "vitest";

import {
  buildAnalysisInput,
  extractSkillsFeatures,
  extractSkillsFeaturesWithEvidence,
  inferProfile,
} from "@/lib/analysis";

import { fakeClassifier } from "./classifier-fake";
import { inputFor } from "./helpers";

describe("extractSkillsFeatures", () => {
  it("reads the grouped Skills section of fixture 01", () => {
    const features = extractSkillsFeatures(inputFor("01-mid-frontend-weak-impact.txt"));

    // Twelve skills across three labelled groups.
    expect(features.totalSkills).toBe(12);
    expect(features.skillGroupingPresent).toBe(true);
    // Every listed skill resolves to the taxonomy. docs/MEASUREMENT.md §9 rounds
    // this to 0.92 for illustration; the real synonym table resolves all twelve.
    expect(features.canonicalizedRatio).toBe(1);
    // Honestly written — no single skill token dominates the document.
    expect(features.keywordRepetitionIndex).toBeLessThan(0.06);
  });

  it("grades a skill as strong only when it appears in an experience bullet", () => {
    const features = extractSkillsFeatures(inputFor("01-mid-frontend-weak-impact.txt"));

    // React, TypeScript, Next.js, Redux, Tailwind CSS, Jest, JavaScript and CSS
    // are demonstrated in bullets; HTML, Cypress, Webpack and Storybook are listed
    // only. Eight of twelve — the rule floor, which the LLM half can only raise.
    expect(features.strongEvidenceRatio).toBeCloseTo(8 / 12, 10);
  });

  it("scores a skills-list-only resume far lower on evidence than on presence", () => {
    const features = extractSkillsFeatures(inputFor("06-skills-no-evidence.txt"));
    // Skills are listed but never demonstrated: evidence is the weak point even
    // though the list itself is fine.
    expect(features.strongEvidenceRatio).toBeLessThan(0.3);
    expect(features.totalSkills).toBeGreaterThan(0);
  });

  it("flags keyword stuffing above the §35 threshold", () => {
    const features = extractSkillsFeatures(inputFor("11-keyword-stuffed.txt"));
    expect(features.keywordRepetitionIndex).toBeGreaterThan(0.06);
  });

  it("does not credit grouping for a flat comma dump", () => {
    const input = buildAnalysisInput(
      ["SKILLS", "JavaScript, TypeScript, React, Redux, Jest, Webpack"].join("\n"),
      1,
    );
    const features = extractSkillsFeatures(input);
    expect(features.skillGroupingPresent).toBe(false);
    expect(features.totalSkills).toBe(6);
  });

  it("promotes a weak skill the classifier confirms is demonstrated", async () => {
    const input = inputFor("01-mid-frontend-weak-impact.txt");
    const profile = inferProfile(input);
    const ruleOnly = extractSkillsFeatures(input, profile);

    // The classifier vouches for Cypress — listed but not literally in any bullet.
    const refined = await extractSkillsFeaturesWithEvidence(
      input,
      fakeClassifier({
        skillEvidence: (skill) => (skill === "Cypress" ? "yes" : "no"),
      }),
      profile,
    );

    // One skill promoted from weak to strong: the ratio rises by exactly 1/12.
    expect(refined.strongEvidenceRatio).toBeCloseTo(ruleOnly.strongEvidenceRatio + 1 / 12, 10);
    // The rule value is a floor — the LLM never lowers it.
    expect(refined.strongEvidenceRatio).toBeGreaterThan(ruleOnly.strongEvidenceRatio);
  });
});
