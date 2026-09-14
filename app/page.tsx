import Link from "next/link";
import { ArrowRight, BarChart2, Shield, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant analysis",
    desc: "Upload your resume and get a scored breakdown in under 30 seconds.",
  },
  {
    icon: BarChart2,
    title: "7 scored categories",
    desc: "Parseability, structure, skills, experience, impact, formatting and contact.",
  },
  {
    icon: Shield,
    title: "Evidence-backed",
    desc: "Every finding traces back to the exact part of your resume that produced it.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-(--color-line) bg-(--color-surface-raised) px-3 py-1 text-xs font-medium text-(--color-ink-muted)">
          <span className="h-1.5 w-1.5 rounded-full bg-(--color-good)" />
          Free · No credit card
        </div>

        <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Know exactly what your resume is missing
        </h1>

        <p className="mt-4 max-w-lg text-lg text-(--color-ink-muted) text-balance">
          Upload your resume. Get a score, a breakdown, and a specific improvement plan — with the evidence behind every finding.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/analyze/upload"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Analyse my resume
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/results/preview"
            className="inline-flex items-center justify-center rounded-xl border border-(--color-line) bg-(--color-surface-raised) px-6 py-3 text-sm font-semibold hover:bg-(--color-surface-subtle)"
          >
            See sample result
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-(--color-line) bg-(--color-surface-raised)">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-0 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className={`px-8 py-8 ${i < FEATURES.length - 1 ? "border-b border-(--color-line) sm:border-b-0 sm:border-r" : ""}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--color-accent-subtle)">
                <Icon size={17} className="text-(--color-accent)" />
              </div>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-(--color-ink-muted)">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <p className="py-4 text-center text-xs text-(--color-ink-muted)">
        Scores are guidance only — not a prediction of any employer&rsquo;s ATS behaviour or hiring decision.
      </p>
    </div>
  );
}
