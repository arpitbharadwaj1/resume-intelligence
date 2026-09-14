import type { Recommendation } from "@/lib/ai/recommendations";

interface Props {
  recommendations: Recommendation[];
}

const PRIORITY_DOT: Record<Recommendation["priority"], string> = {
  high: "text-(--color-bad)",
  medium: "text-(--color-warn)",
  low: "text-(--color-good)",
};

const PRIORITY_LABEL: Record<Recommendation["priority"], string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

const CATEGORY_LABELS: Record<string, string> = {
  parseability: "ATS Parseability",
  structure: "Structure",
  skills: "Skills",
  experience: "Experience",
  impact: "Impact",
  formatting: "Formatting",
  contact: "Contact",
};

export function Recommendations({ recommendations }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
      <h2 className="text-sm font-semibold">Improvement plan</h2>
      <p className="mt-1 text-xs text-(--color-ink-muted)">
        Ordered by impact. Only act on items you can truthfully substantiate.
      </p>

      <ol className="mt-4 space-y-5">
        {recommendations.map((rec, i) => (
          <li key={rec.id} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--color-line) text-xs font-semibold tabular-nums">
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {CATEGORY_LABELS[rec.category] ?? rec.category}
                </span>
                <span className={`text-xs ${PRIORITY_DOT[rec.priority]}`}>
                  ● {PRIORITY_LABEL[rec.priority]}
                </span>
                {rec.estimatedImpact.high > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-(--color-ink-muted)">
                    +{rec.estimatedImpact.low}–{rec.estimatedImpact.high} pts
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-(--color-ink-muted)">{rec.issue}</p>

              <p className="mt-2 text-sm">
                <span className="font-medium">What to do: </span>
                {rec.action}
              </p>

              {rec.truthRequirement && (
                <p className="mt-1.5 text-xs text-(--color-warn)">
                  ⚠ Only make this change where you can substantiate it truthfully.
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
