import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Resume Intelligence</h1>

      <p className="mt-4 text-base/7 text-(--color-ink-muted)">
        Understand what your resume is doing well, what is holding it back, and what to change —
        with the evidence behind every finding.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/analyze/upload"
          className="inline-flex items-center justify-center rounded-lg bg-(--color-accent) px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Analyse my resume
        </Link>
        <Link
          href="/results/preview"
          className="inline-flex items-center justify-center rounded-lg border border-(--color-line) px-5 py-2.5 text-sm font-medium hover:bg-(--color-surface-raised)"
        >
          See a sample result
        </Link>
      </div>

      <p className="mt-10 text-xs/5 text-(--color-ink-muted)">
        Scores are generated using our resume analysis methodology and are intended as guidance.
        They are not a prediction of a specific employer&rsquo;s ATS behaviour or hiring decision.
      </p>
    </main>
  );
}
