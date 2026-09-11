export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        ATS Resume Intelligence
      </h1>

      <p className="mt-4 text-base/7 text-(--color-ink-muted)">
        Understand what your resume is doing well, what is holding it back, and what to change —
        with the evidence behind every finding.
      </p>

      <div className="mt-10 rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
        <p className="text-sm font-medium">Phase 1 — application bootstrap</p>
        <p className="mt-2 text-sm/6 text-(--color-ink-muted)">
          Scaffolding only. Upload, parsing, scoring and recommendations arrive in later phases;
          see <code className="font-mono text-xs">docs/ROADMAP.md</code>.
        </p>
      </div>

      <p className="mt-10 text-xs/5 text-(--color-ink-muted)">
        Scores are generated using our resume analysis methodology and are intended as guidance.
        They are not a prediction of a specific employer&rsquo;s ATS behavior or hiring decision.
      </p>
    </main>
  );
}
