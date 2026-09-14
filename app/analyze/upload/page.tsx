import type { Metadata } from "next";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Upload your resume — Resume Intelligence" };

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Analyse your resume</h1>
        <p className="mt-3 text-base text-(--color-ink-muted)">
          Upload your PDF or DOCX and get a scored breakdown with specific, evidence-backed improvements.
        </p>
      </div>

      {/* Upload card */}
      <div className="mt-10 rounded-2xl border border-(--color-line) bg-(--color-surface-raised) p-8 shadow-sm">
        <UploadForm />
      </div>

      {/* What you'll get */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
        {[
          { label: "ATS Parseability", sub: "Can systems read it?", bg: "bg-(--color-accent-subtle)", fg: "text-(--color-accent)" },
          { label: "Evidence-backed", sub: "Every finding cited", bg: "bg-(--color-good-subtle)", fg: "text-(--color-good)" },
          { label: "Improvement plan", sub: "Specific actions", bg: "bg-(--color-warn-subtle)", fg: "text-(--color-warn)" },
        ].map(({ label, sub, bg, fg }) => (
          <div key={label} className={`rounded-xl p-4 ${bg}`}>
            <p className={`font-semibold ${fg}`}>{label}</p>
            <p className="mt-1 text-(--color-ink-muted)">{sub}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
