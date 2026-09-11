import type { HealthScoreResult } from "@/types/scoring";

interface Props {
  result: HealthScoreResult;
}

function tagline(score: number): string {
  if (score >= 90) return "Excellent — this resume is in strong shape.";
  if (score >= 80) return "Good foundation. Several high-impact improvements are available.";
  if (score >= 65) return "Solid base with meaningful gaps to address.";
  if (score >= 50) return "Notable gaps are limiting this resume's effectiveness.";
  return "Significant work needed before this resume is ready to submit.";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-(--color-good)";
  if (score >= 60) return "text-(--color-warn)";
  return "text-(--color-bad)";
}

export function ScoreHero({ result }: Props) {
  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-(--color-ink-muted)">
        Resume Health Score
      </p>

      <div className="mt-3 flex items-end justify-center gap-1">
        <span className={`text-7xl font-bold tabular-nums leading-none ${scoreColor(result.total)}`}>
          {result.total}
        </span>
        <span className="mb-2 text-2xl font-light text-(--color-ink-muted)">/&thinsp;100</span>
      </div>

      <p className="mt-4 text-base text-(--color-ink-muted)">{tagline(result.total)}</p>

      <p className="mt-4 text-xs text-(--color-ink-muted)">
        Scores are generated using our resume analysis methodology and are intended as guidance. They
        are not a prediction of any employer&rsquo;s ATS behaviour or hiring decision.
      </p>
    </div>
  );
}
