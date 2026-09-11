import { describe, expect, it } from "vitest";

import { buildAnalysisInput, extractContactFeatures } from "@/lib/analysis";

import golden from "../../fixtures/golden/01-mid-frontend-weak-impact.json" with { type: "json" };
import { inputFor } from "./helpers";

describe("extractContactFeatures", () => {
  it("reproduces golden fixture 01's contact vector exactly", () => {
    const features = extractContactFeatures(inputFor("01-mid-frontend-weak-impact.txt"));
    expect(features).toEqual(golden.features.contact);
  });

  it("finds the name, email and phone in a top-of-document contact block", () => {
    const features = extractContactFeatures(inputFor("12-missing-sections.txt"));
    expect(features.hasName).toBe(true);
    expect(features.hasEmail).toBe(true);
    expect(features.hasPhone).toBe(true);
    // Halvard's resume lists no location, LinkedIn or GitHub.
    expect(features.optionalPresent).toBe(0);
  });

  it("counts a hyphenated surname as a name", () => {
    const features = extractContactFeatures(inputFor("09-fresher.txt"));
    expect(features.hasName).toBe(true);
  });

  it("credits a GitHub link only for an engineering resume", () => {
    const contactBlock = [
      "Dana Whitlock",
      "Perth, WA",
      "dana.w@examplemail.test",
      "+61 400 000 111",
      "github.com/dana-w",
    ].join("\n");

    const engineering = buildAnalysisInput(
      `${contactBlock}\n\nEXPERIENCE\n\nSoftware Engineer\nAcme\nJan 2020 - Present\n- Built services.`,
      1,
    );
    const nonEngineering = buildAnalysisInput(
      `${contactBlock}\n\nEXPERIENCE\n\nOperations Analyst\nAcme\nJan 2020 - Present\n- Ran reports.`,
      1,
    );

    // location + github for the engineer; location only for the analyst.
    expect(extractContactFeatures(engineering).optionalPresent).toBe(2);
    expect(extractContactFeatures(nonEngineering).optionalPresent).toBe(1);
  });
});
