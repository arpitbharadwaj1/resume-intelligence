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
    readonly interleavedLines: number;
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
 * The naive signal here -- "a line ends mid-sentence and the next starts
 * lowercase" -- was tried first and was wrong. It fires on soft-wrapped long
 * bullets, which every normal resume has, and it scored a clean single-column
 * document *worse* than a genuinely scrambled two-column one.
 *
 * What actually distinguishes interleaved extraction is two unrelated pieces of
 * the document landing on the same line, which cannot happen in correct reading
 * order:
 *
 *   - two section headings on one line ("CONTACT EXPERIENCE")
 *   - contact details sharing a line with an employment date range
 *   - a heading embedded mid-line inside prose
 *
 * Validated against all twelve fixtures: eleven report perfect coherence, and
 * only the two-column fixture flags -- on exactly its two real interleavings.
 */

/** Contact-shaped tokens. Phone requires nine digits, so a year range is not one. */
const EMAIL_TOKEN = /[\w.+-]+@[\w-]+\.\w+/;
const URL_TOKEN = /(https?:\/\/|www\.|linkedin\.com|github\.com)/i;
const PHONE_TOKEN = /(?=(?:\D*\d){9})\+?\d[\d\s().-]{7,}\d/;

const DATE_RANGE =
  /\b((19|20)\d{2}|[A-Za-z]{3,9}\s+(19|20)\d{2}|\d{1,2}\/(19|20)\d{2})\s*[-\u2013\u2014]\s*((19|20)\d{2}|present|current|[A-Za-z]{3,9}\s+(19|20)\d{2}|\d{1,2}\/(19|20)\d{2})/i;

const HEADING_WORD =
  /\b(CONTACT|EXPERIENCE|EDUCATION|SKILLS|SUMMARY|PROJECTS|PROFILE|CERTIFICATIONS|AWARDS|EMPLOYMENT)\b/g;

function hasContactToken(line: string): boolean {
  return EMAIL_TOKEN.test(line) || URL_TOKEN.test(line) || PHONE_TOKEN.test(line);
}

function isInterleaved(line: string): boolean {
  // A trailing hyphen after normalization means the rejoin heuristic declined
  // it -- usually because the continuation was capitalised, i.e. out of order.
  if (/\p{Ll}-$/u.test(line)) return true;

  // Contact details never legitimately share a line with an employment date
  // range. A contact block holding email, phone and location together is
  // normal, so contact tokens alone are not a signal.
  if (hasContactToken(line) && DATE_RANGE.test(line)) return true;

  const headings = line.match(HEADING_WORD);
  if (headings !== null) {
    if (headings.length > 1) return true;
    // A heading inside prose. An all-caps line such as "EXECUTIVE SUMMARY" is
    // a single heading, not interleaving, so lowercase content is required.
    const firstHeading = headings[0];
    if (
      firstHeading !== undefined &&
      /\p{Ll}/u.test(line) &&
      !line.trim().toUpperCase().startsWith(firstHeading)
    ) {
      return true;
    }
  }

  return false;
}

function countInterleavedLines(lines: readonly string[]): number {
  let count = 0;
  for (const line of lines) if (isInterleaved(line)) count += 1;
  return count;
}

/**
 * Prose-length lines appearing more than once -- the signature of an extraction
 * loop, where a PDF extractor re-emits the same run of text.
 *
 * The threshold is deliberately high. At 12 characters this flagged "Frontend
 * Developer" in a clean fixture -- the same job title held at two companies,
 * which is an ordinary career, not a parse fault. Job titles, section labels,
 * dates and company names all repeat legitimately; a repeated full sentence
 * does not.
 */
const DUPLICATE_MIN_LENGTH = 40;

function countDuplicateLines(lines: readonly string[]): number {
  const seen = new Map<string, number>();
  for (const line of lines) {
    if (line.length < DUPLICATE_MIN_LENGTH) continue;
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

  const interleavedLines = countInterleavedLines(lines);
  const duplicateLines = countDuplicateLines(lines);
  const anomalousGlyphs = countAnomalousGlyphs(normalizedText, stats);

  const safePages = Math.max(1, pageCount);
  const safeLines = Math.max(1, lines.length);
  const safeChars = Math.max(1, charCount);

  const features: ParseabilityFeatures = {
    textYieldRatio: Math.min(1, charCount / (safePages * EXPECTED_CHARS_PER_PAGE)),
    readingOrderCoherence: Math.max(0, 1 - interleavedLines / safeLines),
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
      interleavedLines,
      duplicateLines,
      coreSectionsFound: [...coreFound],
    },
  };
}
