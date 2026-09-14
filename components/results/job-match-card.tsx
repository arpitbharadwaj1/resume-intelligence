import { AlertCircle, CheckCircle2, Briefcase } from "lucide-react";

import type { JobMatchResult } from "@/types/jd";

interface Props {
  data: JobMatchResult;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-(--color-good)";
  if (score >= 60) return "text-(--color-warn)";
  return "text-(--color-bad)";
}

function ringColor(score: number): string {
  if (score >= 80) return "stroke-(--color-good)";
  if (score >= 60) return "stroke-(--color-warn)";
  return "stroke-(--color-bad)";
}

function barColor(score: number): string {
  if (score >= 0.8) return "bg-(--color-good)";
  if (score >= 0.6) return "bg-(--color-warn)";
  return "bg-(--color-bad)";
}

export function JobMatchCard({ data }: Props) {
  const { total, categories, parsedJD, gaps, strengths } = data;
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - total / 100);

  return (
    <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-(--color-line) px-5 py-3.5 bg-(--color-good-subtle)">
        <Briefcase size={15} className="text-(--color-good)" />
        <span className="text-sm font-semibold text-(--color-good)">Job Match</span>
        <span className="ml-1 text-sm text-(--color-ink-muted)">— {parsedJD.jobTitle}</span>
        <span className="ml-auto rounded-full border border-(--color-line) bg-white/70 px-2 py-0.5 text-xs font-medium capitalize text-(--color-ink-muted)">
          {parsedJD.seniority}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Score ring + breakdown */}
        <div className="flex gap-6 items-start">
          {/* Mini ring */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-(--color-line)" />
              <circle
                cx="50" cy="50" r={radius} fill="none" strokeWidth="8"
                strokeLinecap="round"
                className={ringColor(total)}
                strokeDasharray={circ}
                strokeDashoffset={offset}
              />
            </svg>
            <span className={`-mt-14 text-2xl font-bold tabular-nums ${scoreColor(total)}`}>{total}</span>
            <span className="mt-7 text-xs text-(--color-ink-muted)">/ 100</span>
          </div>

          {/* Category bars */}
          <ul className="flex-1 space-y-2.5 min-w-0">
            {categories.map((cat) => {
              const pct = Math.round(cat.score * 100);
              return (
                <li key={cat.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{cat.label}</span>
                    <span className="tabular-nums text-(--color-ink-muted)">
                      {cat.weightedScore.toFixed(0)}<span className="text-[10px]">/{cat.weight}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
                    <div
                      className={`h-full rounded-full ${barColor(cat.score)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Parsed JD summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          {parsedJD.minExperienceYears > 0 && (
            <span className="rounded-full bg-(--color-surface-subtle) border border-(--color-line) px-2.5 py-1">
              {parsedJD.minExperienceYears}+ yrs required
            </span>
          )}
          {parsedJD.industry && (
            <span className="rounded-full bg-(--color-surface-subtle) border border-(--color-line) px-2.5 py-1">
              {parsedJD.industry}
            </span>
          )}
          {parsedJD.workModel && (
            <span className="rounded-full bg-(--color-surface-subtle) border border-(--color-line) px-2.5 py-1 capitalize">
              {parsedJD.workModel}
            </span>
          )}
        </div>

        {/* Skill coverage */}
        {parsedJD.requiredSkills.length > 0 && (() => {
          const reqCat = categories.find((c) => c.category === "requiredSkills");
          if (!reqCat) return null;
          return (
            <div>
              <p className="text-xs font-semibold text-(--color-ink-muted) uppercase tracking-wide mb-2">
                Required skill coverage
              </p>
              <div className="flex flex-wrap gap-1.5">
                {reqCat.matched.map((s) => (
                  <span key={s} className="rounded-md bg-(--color-good-subtle) border border-(--color-good)/20 px-2 py-0.5 text-xs font-medium text-(--color-good)">
                    {s}
                  </span>
                ))}
                {reqCat.missing.map((s) => (
                  <span key={s} className="rounded-md bg-(--color-bad-subtle) border border-(--color-bad)/20 px-2 py-0.5 text-xs font-medium text-(--color-bad)">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-(--color-ink-muted) uppercase tracking-wide mb-2">Strengths</p>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-(--color-good) shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-(--color-ink-muted) uppercase tracking-wide mb-2">Gaps to address</p>
            <ul className="space-y-3">
              {gaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertCircle size={14} className={`shrink-0 mt-0.5 ${gap.severity === "high" ? "text-(--color-bad)" : "text-(--color-warn)"}`} />
                  <div className="min-w-0">
                    <p>{gap.description}</p>
                    {gap.items.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {gap.items.map((item) => (
                          <span
                            key={item}
                            className="rounded-md bg-(--color-surface-subtle) border border-(--color-line) px-2 py-0.5 text-xs font-medium"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-(--color-ink-muted)">
          Job Match score is computed by matching your resume against the parsed requirements from this JD.
          It is not a prediction of any ATS system&rsquo;s behaviour.
        </p>
      </div>
    </div>
  );
}
