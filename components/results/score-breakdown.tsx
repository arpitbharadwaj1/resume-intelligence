import type { CategoryScore } from "@/types/scoring";

interface Props {
  categories: readonly CategoryScore[];
}

const CATEGORY_LABELS: Record<string, string> = {
  parseability: "ATS Parseability",
  structure: "Structure",
  skills: "Skills",
  experience: "Experience",
  impact: "Impact",
  formatting: "Formatting",
  contact: "Contact",
};

function barColor(score: number): string {
  if (score >= 0.8) return "bg-(--color-good)";
  if (score >= 0.6) return "bg-(--color-warn)";
  return "bg-(--color-bad)";
}

function displayScore(score: number, weight: number): number {
  return Math.round(score * weight);
}

export function ScoreBreakdown({ categories }: Props) {
  return (
    <div className="rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
      <h2 className="text-sm font-semibold">Score breakdown</h2>

      <ul className="mt-4 space-y-3">
        {categories.map((cat) => {
          const pct = Math.round(cat.score * 100);
          const pts = displayScore(cat.score, cat.weight);

          return (
            <li key={cat.category}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                <span className="tabular-nums text-(--color-ink-muted)">
                  {pts}
                  <span className="text-xs">/{cat.weight}</span>
                </span>
              </div>

              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-(--color-line)">
                <div
                  className={`h-full rounded-full transition-all ${barColor(cat.score)}`}
                  style={{ width: `${pct}%` }}
                  role="meter"
                  aria-label={`${CATEGORY_LABELS[cat.category]}: ${pct}%`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
