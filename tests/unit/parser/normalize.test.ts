import { describe, expect, it } from "vitest";

import {
  BULLET_MARKER,
  isBulletLine,
  normalizeText,
  stripBulletMarker,
  toLines,
  wordCount,
} from "@/lib/parser/normalize";

describe("normalizeText", () => {
  it("expands ligatures that PDF extraction emits as single codepoints", () => {
    const { text, stats } = normalizeText("Identiﬁed workﬂow ineﬃciencies");
    expect(text).toContain("Identified");
    expect(text).toContain("workflow");
    expect(text).toContain("inefficiencies");
    expect(stats.ligaturesExpanded).toBe(3);
  });

  it("removes zero-width characters that would silently split words", () => {
    const { text, stats } = normalizeText("Type​Script and Java﻿Script");
    expect(text).toBe("TypeScript and JavaScript");
    expect(stats.invisiblesRemoved).toBe(2);
  });

  it("counts replacement characters before stripping them, as decode-failure evidence", () => {
    const { stats } = normalizeText("Managed �� systems");
    expect(stats.replacementChars).toBe(2);
  });

  it("rejoins a word hyphenated across a line break", () => {
    const { text, stats } = normalizeText("built a well-\nknown platform");
    expect(text).toBe("built a wellknown platform");
    expect(stats.hyphenationsJoined).toBe(1);
  });

  it("does not rejoin a hyphenated proper noun split across lines", () => {
    // "React-\nNative" is a real hyphenated name, not a line break artifact.
    // Silently gluing it would corrupt a skill token.
    const { text, stats } = normalizeText("used React-\nNative for mobile");
    expect(stats.hyphenationsJoined).toBe(0);
    expect(text).toContain("React-");
  });

  it("folds every bullet glyph to one marker", () => {
    const { text } = normalizeText("▪ First\n● Second\n‣ Third\n· Fourth");
    const markers = text.match(new RegExp(BULLET_MARKER, "g"));
    expect(markers).toHaveLength(4);
  });

  it("collapses horizontal whitespace but preserves line structure", () => {
    // Line structure is what section detection and bullet counting depend on;
    // collapsing newlines here would destroy both.
    const { text } = normalizeText("Role     Title\n\nCompany\t\tName");
    expect(text).toBe("Role Title\n\nCompany Name");
  });

  it("collapses runs of three or more blank lines to one blank line", () => {
    const { text } = normalizeText("A\n\n\n\n\nB");
    expect(text).toBe("A\n\nB");
  });

  it("normalizes CRLF and lone CR line endings", () => {
    expect(normalizeText("A\r\nB\rC").text).toBe("A\nB\nC");
  });

  it("converts smart quotes to their ASCII equivalents", () => {
    const { text } = normalizeText("“Delivered” the team’s roadmap");
    expect(text).toBe('"Delivered" the team\'s roadmap');
  });

  it("strips control characters while keeping tabs and newlines", () => {
    const { text, stats } = normalizeText("Cleantext\there\nand now");
    expect(text).toBe("Cleantext here\nand now");
    expect(stats.controlCharsRemoved).toBe(1);
  });

  it("handles empty input without throwing", () => {
    const { text, stats } = normalizeText("");
    expect(text).toBe("");
    expect(stats.originalLength).toBe(0);
    expect(stats.normalizedLength).toBe(0);
  });

  it("is idempotent — normalizing twice changes nothing further", () => {
    const messy = "Identiﬁed ▪ work​flow   issues\r\n\r\n\r\nand more";
    const once = normalizeText(messy).text;
    expect(normalizeText(once).text).toBe(once);
  });
});

describe("line helpers", () => {
  it("drops blank lines and trims the rest", () => {
    expect(toLines("  A  \n\n   \n B \n")).toEqual(["A", "B"]);
  });

  it("counts words by whitespace runs", () => {
    expect(wordCount("Built three services  across  two teams")).toBe(6);
    expect(wordCount("   ")).toBe(0);
  });

  it("recognises bullets after glyph folding", () => {
    expect(isBulletLine(`${BULLET_MARKER} Built a service`)).toBe(true);
    expect(isBulletLine("- Built a service")).toBe(true);
    expect(isBulletLine("* Built a service")).toBe(true);
    expect(isBulletLine("Built a service")).toBe(false);
    // A hyphenated date range is not a bullet.
    expect(isBulletLine("2020-2022 Senior Engineer")).toBe(false);
  });

  it("strips the marker without touching the content", () => {
    expect(stripBulletMarker(`${BULLET_MARKER}  Reduced build time by 40%`)).toBe(
      "Reduced build time by 40%",
    );
  });
});
