/**
 * Scoring domain types.
 *
 * The shapes here mirror docs/MEASUREMENT.md section 3 exactly. If a feature is
 * added there, it is added here; the document is the specification and this file
 * is its type-level restatement.
 *
 * Two structures, deliberately separate:
 *
 *   FeatureVector   plain numbers and booleans -- what rubric functions consume.
 *                   Keeping it primitive is what lets a rubric stay a pure
 *                   function that a reviewer can evaluate by hand.
 *
 *   FeatureRecord   the same values annotated with source and evidence -- what
 *                   gets persisted, and what the simulator mutates.
 */

export const SCORE_CATEGORIES = [
  "parseability",
  "structure",
  "skills",
  "experience",
  "impact",
  "formatting",
  "contact",
] as const;

export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

/** Whether a feature value came from deterministic code or a bounded model call. */
export type FeatureSource = "rule" | "llm";

/**
 * A reference to the part of the resume a value came from.
 * `sourceId` uses the stable evidence-ID scheme (`exp_02_bullet_03`).
 */
export interface EvidenceRef {
  readonly section: string;
  readonly sourceId: string;
  readonly text?: string;
}

// ---------------------------------------------------------------------------
// Per-category feature sets (docs/MEASUREMENT.md section 3)
// ---------------------------------------------------------------------------

/** All rule-derived. No model involvement. */
export interface ParseabilityFeatures {
  readonly textYieldRatio: number;
  readonly readingOrderCoherence: number;
  readonly sectionsDetectedRatio: number;
  readonly contactFieldsExtracted: number;
  readonly glyphAnomalyRatio: number;
  readonly repeatedLineRatio: number;
  readonly isImageOnly: boolean;
}

/** All rule-derived. */
export interface StructureFeatures {
  readonly hasExperience: boolean;
  readonly hasSkills: boolean;
  readonly hasEducation: boolean;
  readonly hasSummary: boolean;
  /** False for entry-level candidates, who are not penalised for omitting a summary. */
  readonly summaryExpected: boolean;
  readonly sectionOrderScore: number;
  readonly chronologyConsistent: boolean;
  readonly datedEntryRatio: number;
}

/** `strongEvidenceRatio` is rule + LLM; the rest are rule-derived. */
export interface SkillsFeatures {
  readonly totalSkills: number;
  readonly canonicalizedRatio: number;
  readonly skillGroupingPresent: boolean;
  readonly keywordRepetitionIndex: number;
  readonly strongEvidenceRatio: number;
}

/** `bulletCompletenessRatio` mixes two rule signals with two bounded LLM signals. */
export interface ExperienceFeatures {
  readonly bulletCompletenessRatio: number;
  readonly bulletsInLengthBand: number;
  readonly firstPersonRatio: number;
  readonly bulletsPerRoleMedian: number;
}

/** `genuineOutcomeRatio` is LLM-derived; the rest are rule-derived. */
export interface ImpactFeatures {
  readonly quantifiedBulletRatio: number;
  readonly genuineOutcomeRatio: number;
  readonly distinctMetricTypes: number;
  readonly metricsInRecentRole: boolean;
}

/** All rule-derived. */
export interface FormattingFeatures {
  readonly dateFormatVariants: number;
  readonly punctuationConsistency: number;
  readonly headingCaseConsistency: number;
  readonly unusualGlyphRatio: number;
  readonly lineLengthOutlierRatio: number;
}

/** All rule-derived. GitHub counts toward `optionalPresent` only for engineering roles. */
export interface ContactFeatures {
  readonly hasName: boolean;
  readonly hasEmail: boolean;
  readonly hasPhone: boolean;
  readonly optionalPresent: number;
}

/** The complete input to the scoring engine. Nothing else is required. */
export interface FeatureVector {
  readonly parseability: ParseabilityFeatures;
  readonly structure: StructureFeatures;
  readonly skills: SkillsFeatures;
  readonly experience: ExperienceFeatures;
  readonly impact: ImpactFeatures;
  readonly formatting: FormattingFeatures;
  readonly contact: ContactFeatures;
}

// ---------------------------------------------------------------------------
// Persistence and explanation
// ---------------------------------------------------------------------------

/** One feature value as persisted to `score_features`. */
export interface FeatureRecord {
  readonly category: ScoreCategory;
  readonly key: string;
  readonly value: number;
  readonly source: FeatureSource;
  readonly evidence: readonly EvidenceRef[];
}

/** The spec section 27 explainability contract, per category. */
export interface CategoryScore {
  readonly category: ScoreCategory;
  /** Rubric output, 0-1. */
  readonly score: number;
  /** Percentage points this category contributes at most. */
  readonly weight: number;
  /** `score * weight`. */
  readonly weightedScore: number;
  readonly reason: string;
  readonly evidence: readonly EvidenceRef[];
  /** 0-1 internally; rendered as High / Medium / Low. Never shown as a percentage. */
  readonly confidence: number;
}

export interface HealthScoreResult {
  /** 0-100, rounded half up. */
  readonly total: number;
  /** Unrounded, for the simulator -- rounding twice loses small deltas. */
  readonly totalExact: number;
  readonly categories: readonly CategoryScore[];
  readonly scoringVersion: string;
}

/** Confidence buckets for display. Never render a raw percentage (spec section 25). */
export type ConfidenceBand = "high" | "medium" | "low";
