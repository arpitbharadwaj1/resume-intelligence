import { notFound } from "next/navigation";

import { Findings } from "@/components/results/findings";
import { PotentialScore } from "@/components/results/potential-score";
import { ScoreBreakdown } from "@/components/results/score-breakdown";
import { ScoreHero } from "@/components/results/score-hero";
import { getAnalysisResult } from "@/lib/db/get-result";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import type { FeatureVector } from "@/types/scoring";

import goldenFixture from "@/tests/fixtures/golden/01-mid-frontend-weak-impact.json" with {
  type: "json",
};

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadResult(analysisId: string) {
  // "preview" always renders the golden fixture — no DB needed, safe for demos.
  if (analysisId === "preview") {
    const features = goldenFixture.features as unknown as FeatureVector;
    return { result: scoreResumeHealth(features), analysisId: "preview", createdAt: null };
  }

  return getAnalysisResult(analysisId);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ analysisId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { analysisId } = await params;
  const data = await loadResult(analysisId);

  if (!data) notFound();

  const { result, createdAt } = data;

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <ScoreHero result={result} />

      <div className="mt-8">
        <ScoreBreakdown categories={result.categories} />
      </div>

      <div className="mt-4">
        <PotentialScore result={result} />
      </div>

      <div className="mt-4">
        <Findings categories={result.categories} />
      </div>

      <p className="mt-10 text-center text-xs text-(--color-ink-muted)">
        {analysisId !== "preview" && (
          <>
            Analysis&nbsp;
            <span className="font-mono">{analysisId.slice(0, 8)}</span>
            {createdAt && (
              <>&nbsp;·&nbsp;{new Date(createdAt).toLocaleDateString()}</>
            )}
            &nbsp;·&nbsp;
          </>
        )}
        scoring&nbsp;v{result.scoringVersion}
      </p>
    </main>
  );
}

export function generateMetadata() {
  return { title: "Resume Analysis — Resume Intelligence" };
}
