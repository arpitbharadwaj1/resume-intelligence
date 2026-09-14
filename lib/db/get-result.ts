/**
 * Reconstruct a HealthScoreResult from persisted score_features rows.
 *
 * The results page needs a HealthScoreResult to render. Rather than re-running
 * the scorer (which would need the feature vector in memory), we re-assemble it
 * from what was persisted: the feature rows give us back the FeatureVector, and
 * we re-score it deterministically to get the full CategoryScore breakdown with
 * reasons and confidence. Same input, same output — the score never drifts.
 */
import { createServerClient } from "@/lib/supabase/server";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import type { Recommendation } from "@/lib/ai/recommendations";
import type { RoleReadinessResult } from "@/types/role";
import type { JobMatchResult } from "@/types/jd";
import type {
  ContactFeatures,
  ExperienceFeatures,
  FeatureVector,
  FormattingFeatures,
  ImpactFeatures,
  ParseabilityFeatures,
  SkillsFeatures,
  StructureFeatures,
} from "@/types/scoring";

interface FeatureRow {
  category: string;
  feature_key: string;
  feature_value: number;
}

function toVector(rows: FeatureRow[]): FeatureVector {
  const by: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    (by[row.category] ??= {})[row.feature_key] = Number(row.feature_value);
  }

  const p = by["parseability"] ?? {};
  const s = by["structure"] ?? {};
  const sk = by["skills"] ?? {};
  const e = by["experience"] ?? {};
  const i = by["impact"] ?? {};
  const f = by["formatting"] ?? {};
  const c = by["contact"] ?? {};

  return {
    parseability: {
      textYieldRatio: p.textYieldRatio ?? 0,
      readingOrderCoherence: p.readingOrderCoherence ?? 1,
      sectionsDetectedRatio: p.sectionsDetectedRatio ?? 0,
      contactFieldsExtracted: p.contactFieldsExtracted ?? 0,
      glyphAnomalyRatio: p.glyphAnomalyRatio ?? 0,
      repeatedLineRatio: p.repeatedLineRatio ?? 0,
      isImageOnly: Boolean(p.isImageOnly),
    } satisfies ParseabilityFeatures,
    structure: {
      hasExperience: Boolean(s.hasExperience),
      hasSkills: Boolean(s.hasSkills),
      hasEducation: Boolean(s.hasEducation),
      hasSummary: Boolean(s.hasSummary),
      summaryExpected: Boolean(s.summaryExpected),
      sectionOrderScore: s.sectionOrderScore ?? 1,
      chronologyConsistent: Boolean(s.chronologyConsistent),
      datedEntryRatio: s.datedEntryRatio ?? 0,
    } satisfies StructureFeatures,
    skills: {
      totalSkills: sk.totalSkills ?? 0,
      canonicalizedRatio: sk.canonicalizedRatio ?? 0,
      skillGroupingPresent: Boolean(sk.skillGroupingPresent),
      keywordRepetitionIndex: sk.keywordRepetitionIndex ?? 0,
      strongEvidenceRatio: sk.strongEvidenceRatio ?? 0,
    } satisfies SkillsFeatures,
    experience: {
      bulletCompletenessRatio: e.bulletCompletenessRatio ?? 0,
      bulletsInLengthBand: e.bulletsInLengthBand ?? 0,
      firstPersonRatio: e.firstPersonRatio ?? 0,
      bulletsPerRoleMedian: e.bulletsPerRoleMedian ?? 0,
    } satisfies ExperienceFeatures,
    impact: {
      quantifiedBulletRatio: i.quantifiedBulletRatio ?? 0,
      genuineOutcomeRatio: i.genuineOutcomeRatio ?? 0,
      distinctMetricTypes: i.distinctMetricTypes ?? 0,
      metricsInRecentRole: Boolean(i.metricsInRecentRole),
    } satisfies ImpactFeatures,
    formatting: {
      dateFormatVariants: f.dateFormatVariants ?? 1,
      punctuationConsistency: f.punctuationConsistency ?? 1,
      headingCaseConsistency: f.headingCaseConsistency ?? 1,
      unusualGlyphRatio: f.unusualGlyphRatio ?? 0,
      lineLengthOutlierRatio: f.lineLengthOutlierRatio ?? 0,
    } satisfies FormattingFeatures,
    contact: {
      hasName: Boolean(c.hasName),
      hasEmail: Boolean(c.hasEmail),
      hasPhone: Boolean(c.hasPhone),
      optionalPresent: c.optionalPresent ?? 0,
    } satisfies ContactFeatures,
  };
}

/**
 * Load a completed analysis from the database and return a scored result.
 * Returns null if the analysis doesn't exist, isn't complete, or doesn't
 * belong to the current session user (RLS enforces the ownership check).
 */
export async function getAnalysisResult(analysisId: string) {
  const db = await createServerClient();

  const { data: analysis } = await db
    .from("analyses")
    .select("id, status, created_at, recommendations_json, role_readiness_json, job_match_json")
    .eq("id", analysisId)
    .single();

  if (!analysis || analysis.status !== "completed") return null;

  const { data: featureRows } = await db
    .from("score_features")
    .select("category, feature_key, feature_value")
    .eq("analysis_id", analysisId);

  if (!featureRows || featureRows.length === 0) return null;

  const features = toVector(featureRows);
  const result = scoreResumeHealth(features);
  const recommendations = (analysis.recommendations_json ?? []) as Recommendation[];
  const roleReadiness = (analysis.role_readiness_json ?? null) as RoleReadinessResult | null;
  const jobMatch = (analysis.job_match_json ?? null) as JobMatchResult | null;

  return { result, analysisId, createdAt: analysis.created_at as string, recommendations, roleReadiness, jobMatch };
}
