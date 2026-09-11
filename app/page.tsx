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
          href="/results/preview"
          className="inline-flex items-center justify-center rounded-lg bg-(--color-accent) px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          See a sample result
        </Link>
      </div>

      <div className="mt-10 rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
        <p className="text-sm font-medium">In development</p>
        <p className="mt-2 text-sm/6 text-(--color-ink-muted)">
          Upload, authentication and AI analysis arrive in later phases. The sample result above
          renders against a scored synthetic resume so the full results UI is already visible.
        </p>
      </div>

      <p className="mt-10 text-xs/5 text-(--color-ink-muted)">
        Scores are generated using our resume analysis methodology and are intended as guidance.
        They are not a prediction of a specific employer&rsquo;s ATS behaviour or hiring decision.
      </p>
    </main>
  );
}
