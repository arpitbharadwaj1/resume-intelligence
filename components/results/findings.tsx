"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import type { CategoryScore } from "@/types/scoring";

interface Props {
  categories: readonly CategoryScore[];
}

type Severity = "bad" | "warn" | "good";

interface Finding {
  severity: Severity;
  category: string;
  label: string;
  reason: string;
  pointsLost: number;
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

function severityOf(score: number, pointsLost: number): Severity {
  if (pointsLost < 1) return "good";
  if (score >= 0.75) return "warn";
  return "bad";
}

function dot(severity: Severity) {
  if (severity === "good") return "text-(--color-good)";
  if (severity === "warn") return "text-(--color-warn)";
  return "text-(--color-bad)";
}

export function Findings({ categories }: Props) {
  const [showAll, setShowAll] = useState(false);

  const findings: Finding[] = categories
    .map((cat) => ({
      severity: severityOf(cat.score, cat.weight - cat.weightedScore),
      category: cat.category,
      label: CATEGORY_LABELS[cat.category] ?? cat.category,
      reason: cat.reason,
      pointsLost: cat.weight - cat.weightedScore,
    }))
    .sort((a, b) => b.pointsLost - a.pointsLost);

  const gaps = findings.filter((f) => f.severity === "bad" || f.severity === "warn");
  const strengths = findings.filter((f) => f.severity === "good");
  const visibleGaps = showAll ? gaps : gaps.slice(0, 3);

  return (
    <div className="space-y-4">
      {gaps.length > 0 && (
        <div className="rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
          <h2 className="text-sm font-semibold">Top issues</h2>
          <ul className="mt-3 space-y-3">
            {visibleGaps.map((f) => (
              <li key={f.category} className="flex gap-2.5">
                <span className={`mt-0.5 text-base leading-none ${dot(f.severity)}`}>●</span>
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="mt-0.5 text-sm text-(--color-ink-muted)">{f.reason}</p>
                </div>
              </li>
            ))}
          </ul>

          {gaps.length > 3 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 flex items-center gap-1 text-xs text-(--color-accent) hover:underline"
            >
              {showAll ? (
                <>
                  <ChevronUp size={13} />
                  Show fewer
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  {gaps.length - 3} more issue{gaps.length - 3 > 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {strengths.length > 0 && (
        <div className="rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5">
          <h2 className="text-sm font-semibold">Strengths</h2>
          <ul className="mt-3 space-y-2">
            {strengths.map((f) => (
              <li key={f.category} className="flex gap-2.5">
                <span className={`mt-0.5 text-base leading-none ${dot(f.severity)}`}>●</span>
                <p className="text-sm">{f.label}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
