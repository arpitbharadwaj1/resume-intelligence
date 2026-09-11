/**
 * Parse quality -- the Parseability feature set (docs/MEASUREMENT.md section 3.1).
 *
 * This is the first real consumer of the measurement specification, and the only
 * category that is 100% rule-derived with no model involvement at all.
 *
 * The governing idea, from spec sections 11 and 18: a human-readable resume is
 * not necessarily a machine-readable one, and the two must be assessed
 * separately. What this module must never do is penalise a layout choice. A
 * two-column resume that extracts cleanly is a good resume; a two-column resume
 * that extracts as interleaved fragments is not -- and the difference is
 * measurable here without ever knowing how many columns there were.
 */
import type { ParseabilityFeatures } from "@/types/scoring";

import type { NormalizeStats } from "./normalize";
import { toLines } from "./normalize";
import { CORE_SECTIONS, detectSections, detectedCoreSections } from "./sections";

/** Below this many characters, a document has effectively no extractable text. */
const IMAGE_ONLY_CHAR_THRESHOLD = 200;

/** Characters of text a text-bearing page is expected to yield, roughly. */
const EXPECTED_CHARS_PER_PAGE = 2000;

export interface QualityInput {
  readonly normalizedText: string;
  readonly stats: NormalizeStats;
  /** Page count where the format reports one. DOCX does not; 1 is assumed. */
  readonly pageCount: number;
}

export interface QualityResult {
  readonly features: ParseabilityFeatures;
  /** Kept for diagnostics and for the Contact and Formatting extractors. */
  readonly detail: {
    readonly lineCount: number;
    readonly charCount: number;
    readonly suspiciousBreaks: number;
    readonly duplicateLines: number;
    readonly coreSectionsFound: readonly string[];
  };
}

/** Email, phone and a plausible name -- the three fields Parseability checks for. */
function countContactFieldsFound(lines: readonly string[]): number {
  const head = lines.slice(0, 15).join("\n");
  let found = 0;

  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(head)) found += 1;
  // Deliberately permissive: international formats vary enormously, and a false
  // negative here reads to the user as "we could not find your phone number".
  if (/(\+?\d[\d\s().-]{7,}\d)/.test(head)) found += 1;
  // A name is two to four capitalised words, on its own line, with no digits.
  if (lines.slice(0, 5).some((line) => /^[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’.-]+){1,3}$/.test(line.trim())))
    found += 1;

  return found;
}

/**
 * Lines that suggest the extractor recovered text out of order.
 *
 * Two signals, both independent of layout: a line that ends mid-word, and a line
 * that ends without terminal punctuation where the next line starts lowercase --
 * the shape produced when a column boundary interrupts a sentence.
 */
function countSuspiciousBreaks(lines: readonly string[]): number {
  let suspicious = 0;

  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    if (line === undefined || next === undefined) continue;

    // A trailing hyphen after normalization means the rejoin heuristic declined
    // it -- usually because the continuation is capitalised, i.e. scrambled.
    if (/\p{Ll}-$/u.test(line)) {
      suspicious += 1;
      continue;
    }

    const endsOpen = !/[.!?:;,)\]]$/.test(line) && !/^[•\-*]\s+/.test(next);
    const nextStartsLower = /^\p{Ll}/u.test(next);
    if (endsOpen && nextStartsLower) suspicious += 1;
  }

  return suspicious;
}

/** Non-empty lines appearing more than once -- the signature of an extraction loop. */
function countDuplicateLines(lines: readonly string[]): number {
  const seen = new Map<string, number>();
  for (const line of lines) {
    // Very short lines repeat legitimately (dates, single words).
    if (line.length < 12) continue;
    seen.set(line, (seen.get(line) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const count of seen.values()) if (count > 1) duplicates += count - 1;
  return duplicates;
}

/** Characters that should not appear in extracted prose. */
function countAnomalousGlyphs(text: string, stats: NormalizeStats): number {
  // Replacement characters are counted pre-normalization, since normalization
  // strips them -- they are the strongest single signal of a decode failure.
  const boxDrawing = text.match(/[─-╿-]/g);
  return stats.replacementChars + stats.controlCharsRemoved + (boxDrawing?.length ?? 0);
}

export function assessQuality(input: QualityInput): QualityResult {
  const { normalizedText, stats, pageCount } = input;
  const lines = toLines(normalizedText);
  const charCount = normalizedText.length;

  const isImageOnly = charCount < IMAGE_ONLY_CHAR_THRESHOLD;

  const sections = detectSections(lines);
  const coreFound = detectedCoreSections(sections);

  const suspiciousBreaks = countSuspiciousBreaks(lines);
  const duplicateLines = countDuplicateLines(lines);
  const anomalousGlyphs = countAnomalousGlyphs(normalizedText, stats);

  const safePages = Math.max(1, pageCount);
  const safeLines = Math.max(1, lines.length);
  const safeChars = Math.max(1, charCount);

  const features: ParseabilityFeatures = {
    textYieldRatio: Math.min(1, charCount / (safePages * EXPECTED_CHARS_PER_PAGE)),
    readingOrderCoherence: Math.max(0, 1 - suspiciousBreaks / safeLines),
    sectionsDetectedRatio: coreFound.size / CORE_SECTIONS.length,
    contactFieldsExtracted: countContactFieldsFound(lines) / 3,
    glyphAnomalyRatio: Math.min(1, anomalousGlyphs / safeChars),
    repeatedLineRatio: Math.min(1, duplicateLines / safeLines),
    isImageOnly,
  };

  return {
    features,
    detail: {
      lineCount: lines.length,
      charCount,
      suspiciousBreaks,
      duplicateLines,
      coreSectionsFound: [...coreFound],
    },
  };
}
