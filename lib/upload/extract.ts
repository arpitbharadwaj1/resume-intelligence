/**
 * Document text extraction — PDF via unpdf (pdf.js), DOCX via mammoth.
 *
 * Extraction runs on the server only. The client delivers bytes; we return plain
 * text. Two concerns are deliberately separate:
 *
 *   - Extraction: get what the format contains.
 *   - Quality assessment: decide how much of it is usable (lib/parser/quality.ts).
 *
 * Neither mammoth nor unpdf throws on a corrupt or truncated file — both return
 * partial results. The quality layer handles that correctly; this layer just
 * propagates whatever either library produces.
 *
 * Spec §11: "A human-readable resume is not necessarily a machine-readable resume.
 * The system must assess extraction quality separately."
 */
import * as mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export interface ExtractionResult {
  /** Raw extracted text, before normalisation. */
  readonly text: string;
  /**
   * Number of pages (PDF) or 1 for DOCX, which has no page concept at
   * extraction time. Used by the Parseability `textYieldRatio` feature.
   */
  readonly pageCount: number;
  /** Which extractor ran — useful for provenance logging. */
  readonly extractor: "pdf" | "docx";
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Extract text from a PDF buffer.
 *
 * unpdf (pdf.js) runs in a Node.js context without a canvas. Text order follows
 * the PDF's internal content-stream order, which matches reading order for
 * standard single- and two-column resumes. Multi-column layouts may see columns
 * interleaved — that is a genuine parse quality issue and is measured by
 * `readingOrderCoherence`, not something to fix here.
 */
export async function extractPdf(buffer: Uint8Array): Promise<ExtractionResult> {
  try {
    const pdf = await getDocumentProxy(buffer);
    const pageCount = pdf.numPages;
    const { text } = await extractText(pdf, { mergePages: true });
    return { text, pageCount, extractor: "pdf" };
  } catch (error) {
    throw new ExtractionError("PDF extraction failed", error);
  }
}

/**
 * Extract text from a DOCX buffer.
 *
 * mammoth.extractRawText strips all formatting and returns only the text content.
 * Mammoth warns on unsupported elements (e.g. charts) — these are discarded
 * because they are content-noise in a resume and because logging them would risk
 * logging resume content (§46).
 */
export async function extractDocx(buffer: Uint8Array): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return { text: result.value, pageCount: 1, extractor: "docx" };
  } catch (error) {
    throw new ExtractionError("DOCX extraction failed", error);
  }
}

/**
 * Dispatch to the right extractor based on the validated file type.
 * Only call this after `validateUpload` has passed — the extension is trusted
 * to match the magic bytes at that point.
 */
export async function extractDocument(
  buffer: Uint8Array,
  extension: "pdf" | "docx",
): Promise<ExtractionResult> {
  if (extension === "pdf") return extractPdf(buffer);
  return extractDocx(buffer);
}
