import { describe, expect, it } from "vitest";

import { buildAnalysisInput, extractStructureFeatures } from "@/lib/analysis";

import golden from "../../fixtures/golden/01-mid-frontend-weak-impact.json" with { type: "json" };
import { inputFor } from "./helpers";

describe("extractStructureFeatures", () => {
  it("reproduces golden fixture 01's structure vector exactly", () => {
    const features = extractStructureFeatures(inputFor("01-mid-frontend-weak-impact.txt"));
    expect(features).toEqual(golden.features.structure);
  });

  it("exempts a fresher from the summary requirement", () => {
    const features = extractStructureFeatures(inputFor("09-fresher.txt"));
    expect(features.summaryExpected).toBe(false);
    // No summary is present, but because none is expected it is not a gap.
    expect(features.hasSummary).toBe(false);
  });

  it("marks the standard sections absent on an experience-only resume", () => {
    const features = extractStructureFeatures(inputFor("12-missing-sections.txt"));
    expect(features.hasExperience).toBe(true);
    expect(features.hasSkills).toBe(false);
    expect(features.hasEducation).toBe(false);
    expect(features.hasSummary).toBe(false);
    // A mid-career candidate is still expected to have a summary — its absence
    // is a real gap here, not an exemption.
    expect(features.summaryExpected).toBe(true);
    expect(features.datedEntryRatio).toBe(1);
  });

  it("flags experience entries that are not in reverse-chronological order", () => {
    const outOfOrder = buildAnalysisInput(
      [
        "EXPERIENCE",
        "",
        "Junior Developer",
        "Acme",
        "Jan 2018 - Dec 2019",
        "- Did the first job.",
        "Senior Developer",
        "Beta",
        "Jan 2020 - Present",
        "- Did the later job.",
      ].join("\n"),
      1,
    );
    // Oldest role listed first: a genuine chronology inconsistency.
    expect(extractStructureFeatures(outOfOrder).chronologyConsistent).toBe(false);
  });

  it("penalises a scrambled section order below a well-ordered one", () => {
    const scrambled = buildAnalysisInput(
      [
        "Jordan Vale",
        "jordan@examplemail.test",
        "",
        "SKILLS",
        "Languages: TypeScript",
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Present",
        "- Built things.",
        "SUMMARY",
        "A developer.",
      ].join("\n"),
      1,
    );
    expect(extractStructureFeatures(scrambled).sectionOrderScore).toBeLessThan(1);
  });
});
