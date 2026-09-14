/**
 * Role Readiness domain types (Phase 8).
 *
 * RoleContext — what the user tells us (submitted with the upload form).
 * RoleExpectations — what the AI extracts about the target role (structured
 *   extraction, not scoring — the LLM never returns a number).
 * RoleReadinessResult — the deterministic scoring output.
 */

/** Submitted by the user alongside their resume. */
export interface RoleContext {
  readonly jobTitle: string;
  readonly experienceYears: number;
  readonly industry?: string;
  readonly specialization?: string;
}

/** Structured extraction from a bounded Gemini call — no scores, only facts. */
export interface RoleExpectations {
  readonly requiredSkills: string[];
  readonly preferredSkills: string[];
  readonly typicalResponsibilities: string[];
  readonly seniorityRange: { readonly min: number; readonly max: number };
  readonly keyTerminology: string[];
}

/** One scoring dimension in the Role Readiness breakdown. */
export interface RoleReadinessCategoryScore {
  readonly category: RoleReadinessCategory;
  readonly score: number;       // 0–1
  readonly weight: number;      // max points
  readonly weightedScore: number;
  readonly label: string;
}

export type RoleReadinessCategory =
  | "skills"
  | "experience"
  | "terminology"
  | "responsibilities";

/** A specific gap between the resume and the role expectations. */
export interface RoleGap {
  readonly area: RoleReadinessCategory;
  readonly severity: "high" | "medium" | "low";
  readonly description: string;
  readonly missing: string[];
}

/** Full output of `scoreRoleReadiness()`. */
export interface RoleReadinessResult {
  readonly total: number;
  readonly categories: readonly RoleReadinessCategoryScore[];
  readonly roleContext: RoleContext;
  readonly expectations: RoleExpectations;
  readonly gaps: readonly RoleGap[];
  readonly strengths: readonly string[];
}
