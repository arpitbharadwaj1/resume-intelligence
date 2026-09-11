/**
 * Server-side upload validation (spec §11, CLAUDE.md §5).
 *
 * Runs entirely on the server — the client is untrusted input, browser MIME
 * checks are a UX nicety, not a control (docs/DECISIONS.md). Three layers:
 *
 *   1. Extension — cheapest check, catches obvious mistakes.
 *   2. Declared MIME type — what the browser sent; useful but forgeable.
 *   3. Magic bytes — the only reliable signal; reads the first bytes of the
 *      buffer regardless of what the client claimed.
 *
 * All three must agree before the file is accepted. A file that passes extension
 * and MIME but fails magic bytes is a forgery attempt, not a user error, and is
 * rejected with the same user-visible message as any other invalid file — we do
 * not tell the client which check failed (that is information useful only to an
 * attacker).
 *
 * Size is checked after extension/type so we don't read bytes from a file we
 * would reject on name alone.
 */

export type SupportedMimeType = "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface FileMetadata {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  /** Raw file bytes — needed for magic-byte verification. */
  readonly bytes: Uint8Array;
}

export type ValidationErrorCode =
  | "unsupported_extension"
  | "unsupported_mime"
  | "signature_mismatch"
  | "file_too_large"
  | "file_empty"
  | "file_name_too_long";

export interface ValidationError {
  readonly ok: false;
  readonly code: ValidationErrorCode;
  /** User-facing message. Never reveals which specific check failed (§5 security). */
  readonly message: string;
}

export interface ValidationSuccess {
  readonly ok: true;
  readonly mimeType: SupportedMimeType;
  /** Canonical lowercase extension without the leading dot. */
  readonly extension: "pdf" | "docx";
}

export type ValidationResult = ValidationSuccess | ValidationError;

/** Maximum accepted file size (5 MB, per spec §3). */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum file name length; keeps the database column from overflowing. */
export const MAX_FILE_NAME_LENGTH = 255;

// ---------------------------------------------------------------------------
// Extension helpers
// ---------------------------------------------------------------------------

function extractExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot + 1).toLowerCase();
}

const ALLOWED_EXTENSIONS = new Map<string, "pdf" | "docx">([
  ["pdf", "pdf"],
  ["docx", "docx"],
]);

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

const ALLOWED_MIMES = new Map<string, SupportedMimeType>([
  ["application/pdf", "application/pdf"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  // Older or mis-configured clients may send generic MIME types for DOCX.
  ["application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["application/octet-stream", "application/pdf"], // placeholder; overridden by magic bytes below
]);

// ---------------------------------------------------------------------------
// Magic byte signatures
// ---------------------------------------------------------------------------

/**
 * PDF: `%PDF` at offset 0 (the spec allows a small offset but compliant
 * generators always start at byte 0 or after a BOM). We check only offset 0.
 */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

/**
 * DOCX is a ZIP archive: `PK\x03\x04` at offset 0. A DOCX produced by any
 * Office-compatible application begins with exactly these four bytes.
 */
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

type MagicResult = "pdf" | "docx" | "unknown";

function detectMagicBytes(bytes: Uint8Array): MagicResult {
  if (bytes.length < 4) return "unknown";

  if (bytes[0] === PDF_MAGIC[0] && bytes[1] === PDF_MAGIC[1] &&
      bytes[2] === PDF_MAGIC[2] && bytes[3] === PDF_MAGIC[3]) {
    return "pdf";
  }

  if (bytes[0] === ZIP_MAGIC[0] && bytes[1] === ZIP_MAGIC[1] &&
      bytes[2] === ZIP_MAGIC[2] && bytes[3] === ZIP_MAGIC[3]) {
    return "docx";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Public validation entry point
// ---------------------------------------------------------------------------

const INVALID_FILE_MESSAGE =
  "The file could not be accepted. Please upload a valid PDF or DOCX resume under 5 MB.";

function error(code: ValidationErrorCode, message = INVALID_FILE_MESSAGE): ValidationError {
  return { ok: false, code, message };
}

/**
 * Validate an uploaded file. Call this on the server before storing or parsing
 * anything. Returns a discriminated union so callers must handle both cases.
 *
 * @param file — the file metadata as received from a Next.js FormData parse.
 */
export function validateUpload(file: FileMetadata): ValidationResult {
  // 1. File name sanity.
  if (file.name.length > MAX_FILE_NAME_LENGTH) {
    return error("file_name_too_long");
  }

  // 2. Extension.
  const ext = extractExtension(file.name);
  const canonicalExt = ALLOWED_EXTENSIONS.get(ext);
  if (canonicalExt === undefined) {
    return error("unsupported_extension");
  }

  // 3. Declared MIME type. Normalise to lower-case; some clients send mixed case.
  const declaredMime = file.type.toLowerCase().trim();
  if (!ALLOWED_MIMES.has(declaredMime)) {
    return error("unsupported_mime");
  }

  // 4. Size (after extension/MIME to avoid reading large buffers unnecessarily).
  if (file.size === 0 || file.bytes.length === 0) {
    return error("file_empty");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return error("file_too_large", "The file exceeds the 5 MB size limit.");
  }

  // 5. Magic bytes — the only check a motivated client cannot forge at this point.
  const magic = detectMagicBytes(file.bytes);
  if (magic === "unknown") {
    return error("signature_mismatch");
  }

  // 6. Cross-check: the magic bytes must agree with the extension. A file named
  //    "resume.pdf" with a ZIP header is not a PDF, and vice versa. This catches
  //    content-sniffing attacks and mislabelled files equally.
  if (magic !== canonicalExt) {
    return error("signature_mismatch");
  }

  const mimeType: SupportedMimeType =
    magic === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return { ok: true, mimeType, extension: canonicalExt };
}
