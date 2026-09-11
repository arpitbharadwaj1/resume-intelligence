/**
 * Resume analysis results page.
 *
 * During development (before the database and AI pipeline exist) this page
 * renders the golden fixture so the UI can be built and iterated on with real
 * scored data. Once Phase 3/4/6 are wired, the route will fetch the analysis
 * record by ID from Supabase and compute the live score.
 *
 * The `analysisId` param is validated as a non-empty string; an unknown ID
 * returns the same 404 as a missing record, so the URL structure does not leak
 * whether a given ID has ever been analysed.
 */
import { notFound } from "next/navigation";

import { Findings } from "@/components/results/findings";
import { PotentialScore } from "@/components/results/potential-score";
import { ScoreBreakdown } from "@/components/results/score-breakdown";
import { ScoreHero } from "@/components/results/score-hero";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import type { FeatureVector } from "@/types/scoring";

import goldenFixture from "@/tests/fixtures/golden/01-mid-frontend-weak-impact.json" with {
  type: "json",
};

// ---------------------------------------------------------------------------
// Dev fixture — replace with a real DB fetch once Phase 3/4/6 are live.
// ---------------------------------------------------------------------------

function getAnalysisResult(analysisId: string) {
  // In development every ID resolves to the golden fixture so the UI is always
  // renderable. The real implementation will return null for unknown IDs.
  if (!analysisId || analysisId.length === 0) return null;

  const features = goldenFixture.features as unknown as FeatureVector;
  return scoreResumeHealth(features);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ analysisId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { analysisId } = await params;
  const result = getAnalysisResult(analysisId);

  if (!result) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      {/* Score hero */}
      <ScoreHero result={result} />

      {/* Breakdown bars */}
      <div className="mt-8">
        <ScoreBreakdown categories={result.categories} />
      </div>

      {/* Potential */}
      <div className="mt-4">
        <PotentialScore result={result} />
      </div>

      {/* Gaps and strengths */}
      <div className="mt-4">
        <Findings categories={result.categories} />
      </div>

      {/* Footer */}
      <p className="mt-10 text-center text-xs text-(--color-ink-muted)">
        Analysis&nbsp;
        <span className="font-mono">{analysisId.slice(0, 8)}</span>
        &nbsp;·&nbsp;scoring&nbsp;v{result.scoringVersion}
      </p>
    </main>
  );
}

export function generateMetadata() {
  return {
    title: "Resume Analysis — Resume Intelligence",
  };
}
