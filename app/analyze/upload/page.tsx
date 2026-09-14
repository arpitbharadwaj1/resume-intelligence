import type { Metadata } from "next";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Upload your resume — Resume Intelligence" };

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Upload your resume</h1>
      <p className="mt-2 text-sm text-(--color-ink-muted)">
        PDF or DOCX, up to 5 MB. Your file is stored privately and never shared.
      </p>

      <div className="mt-8">
        <UploadForm />
      </div>
    </main>
  );
}
