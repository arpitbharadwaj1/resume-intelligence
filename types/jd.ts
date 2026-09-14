/**
 * Job Description domain types (Phases 9–10).
 *
 * ParsedJD — structured extraction from the raw JD text (AI call, no scoring).
 * JobMatchResult — deterministic scoring output.
 */

/** Structured extraction from a bounded Gemini call. No scores, only facts. */
export interface ParsedJD {
  readonly jobTitle: string;
  readonly seniority: "junior" | "mid" | "senior" | "lead" | "principal" | "unknown";
  readonly minExperienceYears: number;
  readonly preferredExperienceYears?: number;
  readonly requiredSkills: string[];
  readonly preferredSkills: string[];
  readonly responsibilities: string[];
  readonly keywords: string[];
  readonly otherRequirements: string[];
  readonly industry?: string;
  readonly workModel?: string;
}

export type JobMatchCategory =
  | "requiredSkills"
  | "experience"
  | "responsibilities"
  | "keywords"
  | "seniority"
  | "otherRequirements";

export interface JobMatchCategoryScore {
  readonly category: JobMatchCategory;
  readonly score: number;
  readonly weight: number;
  readonly weightedScore: number;
  readonly label: string;
  readonly matched: string[];
  readonly missing: string[];
}

export interface JobMatchGap {
  readonly category: JobMatchCategory;
  readonly severity: "high" | "medium" | "low";
  readonly description: string;
  readonly items: string[];
}

export interface JobMatchResult {
  readonly total: number;
  readonly categories: readonly JobMatchCategoryScore[];
  readonly parsedJD: ParsedJD;
  readonly candidateYears: number;
  readonly gaps: readonly JobMatchGap[];
  readonly strengths: readonly string[];
}
