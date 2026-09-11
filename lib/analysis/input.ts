/**
 * The one parse every rule extractor shares.
 *
 * Normalisation, line splitting, section detection and parse-quality assessment
 * all happen once, here, and the result is handed to each extractor. Running them
 * per-extractor would be wasteful, but more importantly it would let two
 * extractors disagree about what the document even says — a Structure that sees a
 * Skills section a Formatting pass does not. A single `AnalysisInput` makes that
 * impossible.
 */
import { normalizeText, toLines, type NormalizeStats } from "@/lib/parser/normalize";
import { assessQuality, type QualityResult } from "@/lib/parser/quality";
import { detectSections, type DetectedSection } from "@/lib/parser/sections";

export interface AnalysisInput {
  /** Normalised document text. */
  readonly text: string;
  /** Non-empty trimmed lines — the unit most features count over. */
  readonly lines: readonly string[];
  /** Detected sections, in document order. */
  readonly sections: readonly DetectedSection[];
  /** Normalisation counters (glyph anomalies etc.). */
  readonly stats: NormalizeStats;
  /** Pages the format reported; DOCX assumes 1. */
  readonly pageCount: number;
  /** Parseability features and diagnostics. */
  readonly quality: QualityResult;
}

export function buildAnalysisInput(rawText: string, pageCount: number): AnalysisInput {
  const { text, stats } = normalizeText(rawText);
  const lines = toLines(text);
  const sections = detectSections(lines);
  const quality = assessQuality({ normalizedText: text, stats, pageCount });

  return { text, lines, sections, stats, pageCount, quality };
}
