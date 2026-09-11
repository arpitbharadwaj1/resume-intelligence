import type { HealthScoreResult } from "@/types/scoring";
import { categoriesByPointsLost } from "@/lib/scoring/health-score";

interface Props {
  result: HealthScoreResult;
}

export function PotentialScore({ result }: Props) {
  const topIssues = categoriesByPointsLost(result).slice(0, 3);

  const potentialLift = topIssues.reduce((sum, cat) => {
    const headroom = cat.weight - cat.weightedScore;
    return sum + headroom * 0.5;
  }, 0);

  const low = Math.round(result.total + potentialLift * 0.6);
  const high = Math.round(result.total + potentialLift);
  const cappedHigh = Math.min(high, 99);
  const cappedLow = Math.min(low, cappedHigh - 1);

  if (cappedLow <= result.total) return null;

  return (
    <div className="rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
      <h2 className="text-sm font-semibold">Estimated potential</h2>
      <p className="mt-1 text-xs text-(--color-ink-muted)">
        If you address the top issues above with truthful, substantiable changes:
      </p>
      <p className="mt-3 text-2xl font-bold text-(--color-accent)">
        {cappedLow}–{cappedHigh}
      </p>
      <p className="mt-1 text-xs text-(--color-ink-muted)">
        This is a range, not a guarantee — computed by re-scoring a projected feature vector, never
        by a model asserting a number.
      </p>
    </div>
  );
}
