/**
 * Database operations for analyses and score_features.
 *
 * All writes use the server client (RLS applies, user identity is the session).
 * The analysis pipeline uses the admin client only when writing score_features
 * during an in-flight analysis — at that point we have already verified the
 * analysis belongs to the authenticated user.
 */
import type { HealthScoreResult } from "@/types/scoring";
import type { Recommendation } from "@/lib/ai/recommendations";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { ANALYSIS_VERSION } from "@/lib/scoring/config";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import type { FeatureVector, ScoreCategory } from "@/types/scoring";

export interface ResumeRecord {
  id: string;
  storagePath: string;
}

/** Save an uploaded file reference — called immediately after Storage upload. */
export async function createResumeRecord(data: {
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
}): Promise<string> {
  const db = await createServerClient();
  const { data: row, error } = await db
    .from("resumes")
    .insert({
      user_id: data.userId,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      storage_path: data.storagePath,
    })
    .select("id")
    .single();

  if (error || !row) throw new Error(`Failed to create resume record: ${error?.message}`);
  return row.id as string;
}

/** Create a queued analysis row and return its ID. */
export async function createAnalysis(data: {
  userId: string;
  resumeId: string;
}): Promise<string> {
  const db = await createServerClient();
  const { data: row, error } = await db
    .from("analyses")
    .insert({ user_id: data.userId, resume_id: data.resumeId, status: "processing" })
    .select("id")
    .single();

  if (error || !row) throw new Error(`Failed to create analysis: ${error?.message}`);
  return row.id as string;
}

/** Persist the completed score and feature vector (ADR-006). */
export async function completeAnalysis(
  analysisId: string,
  result: HealthScoreResult,
  features: FeatureVector,
  modelId: string,
  recommendations: Recommendation[] = [],
): Promise<void> {
  const admin = createAdminClient();

  // Update the analysis row with the final score and provenance.
  const { error: updateError } = await admin
    .from("analyses")
    .update({
      status: "completed",
      total_score: result.total,
      scoring_version: result.scoringVersion,
      prompt_version: PROMPT_VERSION,
      model_id: modelId,
      parser_version: ANALYSIS_VERSION,
      completed_at: new Date().toISOString(),
      recommendations_json: recommendations,
    })
    .eq("id", analysisId);

  if (updateError) throw new Error(`Failed to update analysis: ${updateError.message}`);

  // Persist each feature value so the simulator can work without re-running
  // the analysis (ADR-006, MEASUREMENT.md §8).
  const featureRows = buildFeatureRows(analysisId, features);
  const { error: featureError } = await admin.from("score_features").insert(featureRows);
  if (featureError) throw new Error(`Failed to save features: ${featureError.message}`);
}

/** Mark an analysis as failed so the UI can show a clear error state. */
export async function failAnalysis(analysisId: string, _reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("analyses").update({ status: "failed" }).eq("id", analysisId);
}

/** Fetch a completed analysis by ID, checking the user owns it. */
export async function getAnalysis(analysisId: string) {
  const db = await createServerClient();
  const { data, error } = await db
    .from("analyses")
    .select("id, status, total_score, scoring_version, created_at, resume_id")
    .eq("id", analysisId)
    .single();

  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const FEATURE_SOURCES: Partial<Record<string, "rule" | "llm">> = {
  // Parseability — all rule
  textYieldRatio: "rule", readingOrderCoherence: "rule", sectionsDetectedRatio: "rule",
  contactFieldsExtracted: "rule", glyphAnomalyRatio: "rule", repeatedLineRatio: "rule",
  isImageOnly: "rule",
  // Structure — all rule
  hasExperience: "rule", hasSkills: "rule", hasEducation: "rule", hasSummary: "rule",
  summaryExpected: "rule", sectionOrderScore: "rule", chronologyConsistent: "rule",
  datedEntryRatio: "rule",
  // Skills — mixed
  totalSkills: "rule", canonicalizedRatio: "rule", skillGroupingPresent: "rule",
  keywordRepetitionIndex: "rule", strongEvidenceRatio: "llm",
  // Experience — mixed
  bulletCompletenessRatio: "llm", bulletsInLengthBand: "rule",
  firstPersonRatio: "rule", bulletsPerRoleMedian: "rule",
  // Impact — mixed
  quantifiedBulletRatio: "rule", genuineOutcomeRatio: "llm",
  distinctMetricTypes: "rule", metricsInRecentRole: "rule",
  // Formatting — all rule
  dateFormatVariants: "rule", punctuationConsistency: "rule", headingCaseConsistency: "rule",
  unusualGlyphRatio: "rule", lineLengthOutlierRatio: "rule",
  // Contact — all rule
  hasName: "rule", hasEmail: "rule", hasPhone: "rule", optionalPresent: "rule",
};

function buildFeatureRows(analysisId: string, features: FeatureVector) {
  const rows: Array<{
    analysis_id: string;
    category: ScoreCategory;
    feature_key: string;
    feature_value: number;
    source: "rule" | "llm";
    evidence_json: unknown[];
  }> = [];

  for (const [category, categoryFeatures] of Object.entries(features) as [ScoreCategory, Record<string, unknown>][]) {
    for (const [key, value] of Object.entries(categoryFeatures)) {
      rows.push({
        analysis_id: analysisId,
        category,
        feature_key: key,
        feature_value: typeof value === "boolean" ? Number(value) : Number(value),
        source: FEATURE_SOURCES[key] ?? "rule",
        evidence_json: [],
      });
    }
  }

  return rows;
}
