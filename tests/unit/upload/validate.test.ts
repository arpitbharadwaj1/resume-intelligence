import { describe, expect, it } from "vitest";

import {
  MAX_FILE_SIZE_BYTES,
  validateUpload,
  type FileMetadata,
} from "@/lib/upload/validate";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const DOCX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]); // PK\x03\x04…
const JUNK = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

function pdf(overrides: Partial<FileMetadata> = {}): FileMetadata {
  return {
    name: "resume.pdf",
    type: "application/pdf",
    size: 100,
    bytes: PDF_MAGIC,
    ...overrides,
  };
}

function docx(overrides: Partial<FileMetadata> = {}): FileMetadata {
  return {
    name: "resume.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 100,
    bytes: DOCX_MAGIC,
    ...overrides,
  };
}

describe("validateUpload", () => {
  it("accepts a valid PDF", () => {
    const result = validateUpload(pdf());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extension).toBe("pdf");
      expect(result.mimeType).toBe("application/pdf");
    }
  });

  it("accepts a valid DOCX", () => {
    const result = validateUpload(docx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extension).toBe("docx");
    }
  });

  it("rejects an unsupported extension", () => {
    const result = validateUpload(pdf({ name: "resume.txt" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported_extension");
  });

  it("rejects an unsupported MIME type", () => {
    const result = validateUpload(pdf({ type: "text/plain" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported_mime");
  });

  it("rejects a file that is too large", () => {
    const result = validateUpload(pdf({ size: MAX_FILE_SIZE_BYTES + 1, bytes: PDF_MAGIC }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("file_too_large");
  });

  it("rejects an empty file", () => {
    const result = validateUpload(pdf({ size: 0, bytes: new Uint8Array(0) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("file_empty");
  });

  it("rejects a file with unrecognised magic bytes", () => {
    const result = validateUpload(pdf({ bytes: JUNK }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("signature_mismatch");
  });

  it("rejects a DOCX extension with PDF magic bytes (content-sniffing attack)", () => {
    const result = validateUpload(docx({ bytes: PDF_MAGIC }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("signature_mismatch");
  });

  it("rejects a PDF extension with ZIP/DOCX magic bytes", () => {
    const result = validateUpload(pdf({ bytes: DOCX_MAGIC }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("signature_mismatch");
  });

  it("rejects a file name that exceeds 255 characters", () => {
    const result = validateUpload(pdf({ name: `${"a".repeat(252)}.pdf` }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("file_name_too_long");
  });

  it("accepts a generic octet-stream MIME type when magic bytes confirm PDF", () => {
    const result = validateUpload(pdf({ type: "application/octet-stream" }));
    expect(result.ok).toBe(true);
  });

  it("does not reveal which specific check failed in the user message", () => {
    const ext = validateUpload(pdf({ name: "resume.exe" }));
    const mime = validateUpload(pdf({ type: "text/html" }));
    const magic = validateUpload(pdf({ bytes: JUNK }));
    // All three rejection messages are identical — no information to an attacker.
    if (!ext.ok && !mime.ok && !magic.ok) {
      expect(ext.message).toBe(mime.message);
      expect(mime.message).toBe(magic.message);
    }
  });
});
