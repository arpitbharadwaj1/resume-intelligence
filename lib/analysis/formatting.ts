/**
 * Formatting feature extraction — weight 10, entirely rule-derived
 * (docs/MEASUREMENT.md §3.6).
 *
 * Formatting measures internal *consistency*, not taste: one date format rather
 * than three, one bullet-punctuation convention rather than a mix, one heading
 * case. None of these is right or wrong in isolation — the penalty is only ever
 * for mixing them, which is what reads as carelessness to a human and as noise to
 * a parser.
 *
 * The one non-obvious mechanic is bullet reconstruction. A PDF extractor wraps a
 * long bullet across several lines, and the terminal punctuation lands on the
 * last of them — so punctuation consistency has to be read from the whole bullet,
 * not the line that carries the marker.
 */
import { isBulletLine, stripBulletMarker } from "@/lib/parser/normalize";
import { looksLikeHeading } from "@/lib/parser/sections";
import type { FormattingFeatures } from "@/types/scoring";

import { collectDateFormats } from "./dates";
import type { AnalysisInput } from "./input";

// Anything outside letters, digits, whitespace and the punctuation a resume
// legitimately uses. Box-drawing, replacement characters and stray symbols land
// here; the bullet marker, dashes and the usual technical punctuation do not.
const UNUSUAL_GLYPH = /[^\p{L}\p{N}\s.,:;'"()[\]{}\-–—/&%+#@•*_=°]/gu;

/**
 * Rebuild logical bullets from wrapped lines. A bullet begins at a marker line
 * and absorbs following lines until the next bullet or the next heading-shaped
 * line (the start of a new role), which is where its text genuinely ends.
 */
function reconstructBullets(lines: readonly string[]): readonly string[] {
  const bullets: string[] = [];
  let current: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (isBulletLine(line)) {
      if (current !== null) bullets.push(current);
      current = stripBulletMarker(line);
      continue;
    }
    if (current === null) continue;

    // A heading-shaped line (a new job title, a section break) ends the bullet;
    // ordinary prose is a wrapped continuation of it.
    if (looksLikeHeading(line)) {
      bullets.push(current);
      current = null;
    } else {
      current = `${current} ${line}`;
    }
  }

  if (current !== null) bullets.push(current);
  return bullets;
}

/** Share of bullets following the majority terminal-punctuation convention. */
function punctuationConsistency(bullets: readonly string[]): number {
  if (bullets.length === 0) return 1;

  let punctuated = 0;
  for (const bullet of bullets) if (/[.!?]$/.test(bullet.trim())) punctuated += 1;

  const majority = Math.max(punctuated, bullets.length - punctuated);
  return majority / bullets.length;
}

type HeadingCase = "upper" | "title" | "other";

function headingCase(heading: string): HeadingCase {
  const text = heading.replace(/:$/, "").trim();
  if (text.length === 0) return "other";

  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && text === text.toUpperCase()) return "upper";

  const words = text.split(/\s+/);
  if (words.every((word) => /^[A-Z]/.test(word) || word.length <= 3)) return "title";

  return "other";
}

/** Share of section headings following the majority casing convention. */
function headingCaseConsistency(input: AnalysisInput): number {
  const cases = input.sections
    .map((section) => section.heading.trim())
    .filter((heading) => heading.length > 0)
    .map(headingCase);

  if (cases.length === 0) return 1;

  const counts = new Map<HeadingCase, number>();
  for (const kind of cases) counts.set(kind, (counts.get(kind) ?? 0) + 1);

  const majority = Math.max(...counts.values());
  return majority / cases.length;
}

/** Fraction of lines whose length is a statistical outlier (beyond 1.5×IQR). */
function lineLengthOutlierRatio(lines: readonly string[]): number {
  if (lines.length < 4) return 0;

  const lengths = lines.map((line) => line.length).sort((a, b) => a - b);
  const q1 = quantile(lengths, 0.25);
  const q3 = quantile(lengths, 0.75);
  const iqr = q3 - q1;
  const upper = q3 + 1.5 * iqr;
  const lower = q1 - 1.5 * iqr;

  const outliers = lengths.filter((length) => length > upper || length < lower).length;
  return outliers / lengths.length;
}

/** Linear-interpolated quantile of a pre-sorted array. */
function quantile(sorted: readonly number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lowIndex = Math.floor(position);
  const highIndex = Math.ceil(position);
  const low = sorted[lowIndex]!;
  const high = sorted[highIndex]!;
  return low + (high - low) * (position - lowIndex);
}

export function extractFormattingFeatures(input: AnalysisInput): FormattingFeatures {
  const bullets = reconstructBullets(input.lines);
  const anomalousGlyphs = (input.text.match(UNUSUAL_GLYPH) ?? []).length;
  const safeChars = Math.max(1, input.text.length);

  return {
    dateFormatVariants: collectDateFormats(input.lines).size,
    punctuationConsistency: punctuationConsistency(bullets),
    headingCaseConsistency: headingCaseConsistency(input),
    unusualGlyphRatio: Math.min(1, anomalousGlyphs / safeChars),
    lineLengthOutlierRatio: lineLengthOutlierRatio(input.lines),
  };
}
