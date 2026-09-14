import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Findings } from "@/components/results/findings";
import { PotentialScore } from "@/components/results/potential-score";
import { Recommendations } from "@/components/results/recommendations";
import { RoleReadinessCard } from "@/components/results/role-readiness-card";
import { ScoreBreakdown } from "@/components/results/score-breakdown";
import { ScoreRing } from "@/components/results/score-ring";
import { getAnalysisResult } from "@/lib/db/get-result";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import type { FeatureVector } from "@/types/scoring";

import goldenFixture from "@/tests/fixtures/golden/01-mid-frontend-weak-impact.json" with {
  type: "json",
};

function tagline(score: number): string {
  if (score >= 90) return "Excellent — this resume is in strong shape.";
  if (score >= 80) return "Good foundation. Several high-impact improvements are available.";
  if (score >= 65) return "Solid base with meaningful gaps to address.";
  if (score >= 50) return "Notable gaps are limiting this resume's effectiveness.";
  return "Significant work needed before this resume is ready to submit.";
}

async function loadResult(analysisId: string) {
  if (analysisId === "preview") {
    const features = goldenFixture.features as unknown as FeatureVector;
    return { result: scoreResumeHealth(features), analysisId: "preview", createdAt: null, recommendations: [], roleReadiness: null };
  }
  return getAnalysisResult(analysisId);
}

interface Props {
  params: Promise<{ analysisId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { analysisId } = await params;
  const data = await loadResult(analysisId);
  if (!data) notFound();

  const { result, createdAt, recommendations, roleReadiness } = data;

  return (
    <div className="min-h-screen bg-(--color-surface)">
      {/* Top bar */}
      <div className="border-b border-(--color-line) bg-(--color-surface-raised)">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-(--color-ink-muted) hover:text-(--color-ink)"
          >
            <ArrowLeft size={14} />
            All analyses
          </Link>
          {createdAt && (
            <span className="ml-auto text-xs text-(--color-ink-muted)">
              {new Date(createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">

          {/* Left column — score hero + breakdown */}
          <div className="space-y-4">
            {/* Score card */}
            <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) p-6 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-(--color-ink-muted)">
                Resume Health Score
              </p>
              <div className="mt-4 flex justify-center">
                <ScoreRing score={result.total} />
              </div>
              <p className="mt-4 text-sm text-(--color-ink-muted)">{tagline(result.total)}</p>
            </div>

            {/* Score breakdown */}
            <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) p-5 shadow-sm">
              <ScoreBreakdown categories={result.categories} />
            </div>

            {/* Potential */}
            <PotentialScore result={result} />

            {/* Disclaimer */}
            <p className="px-1 text-xs text-(--color-ink-muted)">
              Scores are generated using our resume analysis methodology and are intended as guidance.
              They are not a prediction of any employer&rsquo;s ATS behaviour or hiring decision.
            </p>
          </div>

          {/* Right column — role readiness + findings + recommendations */}
          <div className="space-y-4">
            {roleReadiness && <RoleReadinessCard data={roleReadiness} />}

            <Findings categories={result.categories} />

            {recommendations.length > 0 && (
              <Recommendations recommendations={recommendations} />
            )}

            {/* Footer */}
            {analysisId !== "preview" && (
              <p className="text-xs text-(--color-ink-muted)">
                Analysis&nbsp;
                <span className="font-mono">{analysisId.slice(0, 8)}</span>
                &nbsp;·&nbsp;scoring&nbsp;v{result.scoringVersion}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function generateMetadata() {
  return { title: "Resume Analysis — Resume Intelligence" };
}
