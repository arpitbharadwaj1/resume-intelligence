/**
 * Document text extraction.
 *
 * Runs server-side only. This is not an optimisation -- it is a correctness
 * requirement. Browser-extracted text is forgeable, and a user who could post
 * their own "extracted text" could manufacture the input to their own score
 * (docs/SECURITY.md section 2).
 *
 * Extraction failures are returned as values, not thrown. A resume that cannot
 * be read is an ordinary, expected outcome that the product has a real answer
 * for -- "machine-readable text could not be extracted" is one of the most
 * useful things this tool can tell someone (spec section 89).
 */
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export const PARSER_VERSION = "1.0.0";

export type ExtractionFailure =
  | "empty_file"
  | "corrupt_file"
  | "unsupported_format"
  | "no_text_layer"
  | "extraction_error";

export interface ExtractionSuccess {
  readonly ok: true;
  readonly rawText: string;
  readonly pageCount: number;
  readonly parserVersion: string;
}

export interface ExtractionError {
  readonly ok: false;
  readonly failure: ExtractionFailure;
  /** Safe for logs and for display. Never contains document content. */
  readonly message: string;
}

export type ExtractionResult = ExtractionSuccess | ExtractionError;

/** Below this, treat the document as having no usable text layer. */
const MIN_USABLE_CHARS = 20;

export async function extractPdf(bytes: Uint8Array): Promise<ExtractionResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, failure: "empty_file", message: "The file is empty." };
  }

  try {
    const pdf = await getDocumentProxy(bytes);
    // mergePages returns a single string rather than per-page chunks.
    const { text: rawText, totalPages } = await extractPdfText(pdf, { mergePages: true });

    if (rawText.trim().length < MIN_USABLE_CHARS) {
      return {
        ok: false,
        failure: "no_text_layer",
        // This is the scanned-or-image-only case. Worth naming precisely,
        // because the fix (export a text PDF) is entirely in the user's hands.
        message:
          "No machine-readable text could be extracted. This usually means the document is a scan or an exported image rather than a text PDF.",
      };
    }

    return { ok: true, rawText, pageCount: totalPages, parserVersion: PARSER_VERSION };
  } catch {
    return {
      ok: false,
      failure: "corrupt_file",
      // The underlying error is deliberately not interpolated: parser errors
      // can echo document content, which must never reach a log (spec section 46).
      message: "The PDF could not be read. It may be corrupt or password-protected.",
    };
  }
}

export async function extractDocx(bytes: Uint8Array): Promise<ExtractionResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, failure: "empty_file", message: "The file is empty." };
  }

  try {
    // Imported lazily: mammoth pulls in a sizeable dependency tree, and most
    // uploads are PDFs.
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const rawText = result.value;

    if (rawText.trim().length < MIN_USABLE_CHARS) {
      return {
        ok: false,
        failure: "no_text_layer",
        message:
          "No text could be extracted. The document may contain only images, or its content may sit in a text box the extractor cannot reach.",
      };
    }

    // DOCX has no fixed pagination; page count is derived from text volume so
    // textYieldRatio stays comparable across formats.
    const pageCount = Math.max(1, Math.ceil(rawText.length / 3000));

    return { ok: true, rawText, pageCount, parserVersion: PARSER_VERSION };
  } catch {
    return {
      ok: false,
      failure: "corrupt_file",
      message: "The Word document could not be read. It may be corrupt or in an unsupported format.",
    };
  }
}

export async function extractDocument(
  bytes: Uint8Array,
  fileType: "pdf" | "docx",
): Promise<ExtractionResult> {
  switch (fileType) {
    case "pdf":
      return extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
  }
}
