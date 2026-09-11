/**
 * Parse-quality tests, run against the real synthetic fixtures.
 *
 * These matter more than a synthetic-input unit test would, because the whole
 * point of Parseability is to distinguish documents that a machine can read from
 * documents that merely look fine to a person. That distinction only means
 * something against realistic input.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeText } from "@/lib/parser/normalize";
import { assessQuality } from "@/lib/parser/quality";
import { scoreParseability } from "@/lib/scoring/rubrics";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/resumes");

function assess(fixture: string, pageCount = 1) {
  const raw = readFileSync(join(FIXTURE_DIR, fixture), "utf8");
  const { text, stats } = normalizeText(raw);
  return assessQuality({ normalizedText: text, stats, pageCount });
}

describe("a clean, well-structured resume", () => {
  const { features, detail } = assess("01-mid-frontend-weak-impact.txt");

  it("is not flagged as image-only", () => {
    expect(features.isImageOnly).toBe(false);
  });

  it("finds all four core sections", () => {
    expect(features.sectionsDetectedRatio).toBe(1);
    expect([...detail.coreSectionsFound].sort()).toEqual([
      "contact",
      "education",
      "experience",
      "skills",
    ]);
  });

  it("extracts every contact field", () => {
    expect(features.contactFieldsExtracted).toBe(1);
  });

  it("reports coherent reading order", () => {
    expect(features.readingOrderCoherence).toBeGreaterThan(0.85);
  });

  it("finds no glyph damage and no duplicated lines", () => {
    expect(features.glyphAnomalyRatio).toBe(0);
    expect(features.repeatedLineRatio).toBe(0);
  });

  it("scores well on the Parseability rubric", () => {
    expect(scoreParseability(features)).toBeGreaterThan(0.85);
  });
});

describe("an image-only document", () => {
  const { features } = assess("03-image-only.txt");

  it("is flagged as image-only", () => {
    expect(features.isImageOnly).toBe(true);
  });

  it("collapses to the documented floor of 0.05 regardless of other signals", () => {
    // The short-circuit exists so a near-empty document cannot average its way
    // to a respectable score off a handful of incidentally-clean sub-signals.
    expect(scoreParseability(features)).toBe(0.05);
  });
});

describe("a two-column layout", () => {
  const twoColumn = assess("02-two-column.txt");
  const singleColumn = assess("01-mid-frontend-weak-impact.txt");

  it("is judged on extraction quality, not on having two columns", () => {
    // Spec section 18: the presence of columns is never itself a penalty. What
    // is measurable, and what does matter, is whether the reading order
    // survived -- and here it partly did not.
    expect(twoColumn.features.readingOrderCoherence).toBeLessThan(
      singleColumn.features.readingOrderCoherence,
    );
  });

  it("detects the interleaving as reading-order damage", () => {
    expect(twoColumn.detail.interleavedLines).toBeGreaterThan(0);
  });

  it("still scores above the image-only floor, because text was recovered", () => {
    const score = scoreParseability(twoColumn.features);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(scoreParseability(singleColumn.features));
  });
});

describe("a resume missing standard sections", () => {
  const { features, detail } = assess("12-missing-sections.txt");

  it("detects fewer core sections", () => {
    expect(features.sectionsDetectedRatio).toBeLessThan(1);
    expect(detail.coreSectionsFound).toContain("experience");
    expect(detail.coreSectionsFound).not.toContain("skills");
  });

  it("does not confuse a missing section with a failed parse", () => {
    // Structure penalises the missing sections. Parseability should not also
    // penalise them heavily -- the text extracted fine, the resume is just
    // incomplete, and double-counting would mislead the user about the fix.
    expect(features.isImageOnly).toBe(false);
    expect(features.readingOrderCoherence).toBeGreaterThan(0.8);
  });
});

describe("robustness", () => {
  it("handles an empty document without dividing by zero", () => {
    const { text, stats } = normalizeText("");
    const { features } = assessQuality({ normalizedText: text, stats, pageCount: 1 });

    for (const value of Object.values(features)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
    expect(features.isImageOnly).toBe(true);
  });

  it("counts replacement characters as glyph damage", () => {
    const damaged = `${"Senior Engineer at Example Corp. ".repeat(20)}���`;
    const { text, stats } = normalizeText(damaged);
    const { features } = assessQuality({ normalizedText: text, stats, pageCount: 1 });
    expect(features.glyphAnomalyRatio).toBeGreaterThan(0);
  });

  it("detects an extraction loop as repeated lines", () => {
    const looped = Array(10).fill("Developed and maintained internal tooling.").join("\n");
    const { text, stats } = normalizeText(looped);
    const { features } = assessQuality({ normalizedText: text, stats, pageCount: 1 });
    expect(features.repeatedLineRatio).toBeGreaterThan(0.5);
  });

  it("caps textYieldRatio at 1 for a dense single page", () => {
    const dense = "Delivered measurable improvements across the platform. ".repeat(200);
    const { text, stats } = normalizeText(dense);
    const { features } = assessQuality({ normalizedText: text, stats, pageCount: 1 });
    expect(features.textYieldRatio).toBe(1);
  });
});
