import { describe, expect, it } from "vitest";

import { buildAnalysisInput, extractFormattingFeatures } from "@/lib/analysis";

import { inputFor } from "./helpers";

describe("extractFormattingFeatures", () => {
  it("measures golden fixture 01's formatting signals", () => {
    const features = extractFormattingFeatures(inputFor("01-mid-frontend-weak-impact.txt"));

    // Two date conventions: "Jan 2022 - Mar 2024" and "03/2020 – 12/2021".
    expect(features.dateFormatVariants).toBe(2);
    // Every section heading is upper-case.
    expect(features.headingCaseConsistency).toBe(1);
    // 17 of 18 bullets end in a full stop. docs/MEASUREMENT.md §9 rounds this to
    // 0.94 for readability; the extractor produces the exact 17/18.
    expect(features.punctuationConsistency).toBeCloseTo(17 / 18, 10);
    // Clean synthetic text: no anomalous glyphs, no length outliers.
    expect(features.unusualGlyphRatio).toBe(0);
    expect(features.lineLengthOutlierRatio).toBeLessThan(0.1);
  });

  it("reads terminal punctuation from the end of a wrapped bullet, not its first line", () => {
    const wrapped = buildAnalysisInput(
      [
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Present",
        "- Rebuilt the dashboard in React and TypeScript, cutting time to",
        "interactive from 4.1 seconds to 1.6 seconds.",
      ].join("\n"),
      1,
    );
    // The one bullet ends in a full stop on its second line, so the convention is
    // consistent — not 0 as it would be if only the marker line were checked.
    expect(extractFormattingFeatures(wrapped).punctuationConsistency).toBe(1);
  });

  it("counts mixed date conventions across the document", () => {
    const mixed = buildAnalysisInput(
      [
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Mar 2021",
        "- Did a thing.",
        "Analyst",
        "Beta",
        "05/2018 - 12/2019",
        "- Did another thing.",
      ].join("\n"),
      1,
    );
    expect(extractFormattingFeatures(mixed).dateFormatVariants).toBe(2);
  });

  it("drops below 1 when heading case is inconsistent", () => {
    const mixed = buildAnalysisInput(
      [
        "Jordan Vale",
        "jordan@examplemail.test",
        "",
        "EXPERIENCE",
        "Developer",
        "Acme",
        "Jan 2020 - Present",
        "- Built things.",
        "Education",
        "A degree.",
        "Skills",
        "Languages: TypeScript",
      ].join("\n"),
      1,
    );
    // EXPERIENCE is upper-case; Education and Skills are title-case.
    expect(extractFormattingFeatures(mixed).headingCaseConsistency).toBeLessThan(1);
  });
});
