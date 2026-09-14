/**
 * Deterministic Role Readiness scorer (Phase 8, §19).
 *
 * Four dimensions — all rule-derived from the resume text and a structured
 * expectations object produced by lib/ai/role-expectations.ts. This file has
 * no AI dependency; the model output is validated and passed in as data.
 *
 * No import from lib/ai/ (enforced by ESLint no-restricted-imports rule).
 *
 * Weights:
 *   Skills alignment       35 pts  — required skills present in resume text
 *   Experience alignment   25 pts  — user's years vs expected seniority range
 *   Terminology coverage   20 pts  — role-specific terms found in resume text
 *   Responsibility signals 20 pts  — typical responsibilities with evidence
 */
import type { RoleContext, RoleExpectations, RoleGap, RoleReadinessCategoryScore, RoleReadinessResult } from "@/types/role";

const WEIGHTS = {
  skills: 35,
  experience: 25,
  terminology: 20,
  responsibilities: 20,
} as const;

const LABELS = {
  skills: "Required skills",
  experience: "Experience alignment",
  terminology: "Role terminology",
  responsibilities: "Typical responsibilities",
} as const;

// ---------------------------------------------------------------------------
// Text matching helpers
// ---------------------------------------------------------------------------

/** Normalize a string for comparison: lowercase, collapse whitespace. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 .#+]/g, " ").replace(/\s+/g, " ").trim();
}

/** True if the candidate phrase appears anywhere in the resume text. */
function textContains(resumeNorm: string, phrase: string): boolean {
  return resumeNorm.includes(norm(phrase));
}

/**
 * For a multi-word responsibility phrase, extract "meaningful" tokens
 * (length >= 4, not stop words) and count how many appear in the resume.
 * A responsibility is "covered" if at least 2 meaningful tokens match.
 */
const STOP = new Set(["with", "using", "across", "ensure", "work", "team", "able", "will", "have"]);

function responsibilityCovered(resumeNorm: string, responsibility: string): boolean {
  const tokens = norm(responsibility)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOP.has(t));
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => resumeNorm.includes(t)).length;
  return matched >= Math.min(2, tokens.length);
}

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scoreSkills(
  resumeNorm: string,
  expectations: RoleExpectations,
): { score: number; missingRequired: string[]; matchedRequired: string[] } {
  const { requiredSkills } = expectations;
  if (requiredSkills.length === 0) return { score: 1, missingRequired: [], matchedRequired: [] };

  const matchedRequired = requiredSkills.filter((s) => textContains(resumeNorm, s));
  const missingRequired = requiredSkills.filter((s) => !textContains(resumeNorm, s));

  const score = matchedRequired.length / requiredSkills.length;
  return { score, missingRequired, matchedRequired };
}

function scoreExperience(
  context: RoleContext,
  expectations: RoleExpectations,
): { score: number; gap: number } {
  const { min, max } = expectations.seniorityRange;
  const years = context.experienceYears;

  if (min <= 0) return { score: 1, gap: 0 };

  if (years >= min) {
    // At or above minimum — scale linearly up to max, full score at or beyond max.
    const extra = max > min ? Math.min(years - min, max - min) / (max - min) : 1;
    return { score: 0.7 + extra * 0.3, gap: 0 };
  }

  // Below minimum — partial credit proportional to how close they are.
  const score = Math.max(0, years / min) * 0.7;
  return { score, gap: min - years };
}

function scoreTerminology(
  resumeNorm: string,
  expectations: RoleExpectations,
): { score: number; missing: string[] } {
  const { keyTerminology } = expectations;
  if (keyTerminology.length === 0) return { score: 1, missing: [] };

  const matched = keyTerminology.filter((t) => textContains(resumeNorm, t));
  const missing = keyTerminology.filter((t) => !textContains(resumeNorm, t));

  return { score: matched.length / keyTerminology.length, missing };
}

function scoreResponsibilities(
  resumeNorm: string,
  expectations: RoleExpectations,
): { score: number; uncovered: string[] } {
  const { typicalResponsibilities } = expectations;
  if (typicalResponsibilities.length === 0) return { score: 1, uncovered: [] };

  const uncovered = typicalResponsibilities.filter((r) => !responsibilityCovered(resumeNorm, r));
  const score = (typicalResponsibilities.length - uncovered.length) / typicalResponsibilities.length;

  return { score, uncovered };
}

// ---------------------------------------------------------------------------
// Gap builder
// ---------------------------------------------------------------------------

function buildGaps(params: {
  missingSkills: string[];
  experienceGap: number;
  missingTerms: string[];
  uncoveredResponsibilities: string[];
}): RoleGap[] {
  const gaps: RoleGap[] = [];

  if (params.missingSkills.length > 0) {
    const severity =
      params.missingSkills.length >= 5 ? "high" : params.missingSkills.length >= 2 ? "medium" : "low";
    gaps.push({
      area: "skills",
      severity,
      description: `${params.missingSkills.length} required skill${params.missingSkills.length > 1 ? "s" : ""} not evidenced in the resume.`,
      missing: params.missingSkills.slice(0, 8),
    });
  }

  if (params.experienceGap > 0) {
    gaps.push({
      area: "experience",
      severity: params.experienceGap >= 3 ? "high" : "medium",
      description: `Resume shows ${params.experienceGap} fewer year${params.experienceGap > 1 ? "s" : ""} of experience than the role typically expects.`,
      missing: [],
    });
  }

  if (params.missingTerms.length > 0) {
    const ratio = params.missingTerms.length;
    if (ratio >= 5) {
      gaps.push({
        area: "terminology",
        severity: ratio >= 12 ? "high" : "medium",
        description: `${ratio} role-specific terms are absent from the resume.`,
        missing: params.missingTerms.slice(0, 8),
      });
    }
  }

  if (params.uncoveredResponsibilities.length >= 4) {
    gaps.push({
      area: "responsibilities",
      severity: params.uncoveredResponsibilities.length >= 7 ? "high" : "medium",
      description: `${params.uncoveredResponsibilities.length} typical responsibilities have no clear evidence in the resume.`,
      missing: params.uncoveredResponsibilities.slice(0, 5),
    });
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Strength builder
// ---------------------------------------------------------------------------

function buildStrengths(params: {
  matchedSkills: string[];
  experienceScore: number;
  terminologyScore: number;
  responsibilityScore: number;
}): string[] {
  const strengths: string[] = [];

  if (params.matchedSkills.length >= 3) {
    strengths.push(
      `${params.matchedSkills.length} required skill${params.matchedSkills.length > 1 ? "s" : ""} clearly evidenced: ${params.matchedSkills.slice(0, 4).join(", ")}`,
    );
  }

  if (params.experienceScore >= 0.9) {
    strengths.push("Experience level aligns well with the role's expectations.");
  }

  if (params.terminologyScore >= 0.6) {
    strengths.push("Resume uses role-relevant terminology throughout.");
  }

  if (params.responsibilityScore >= 0.7) {
    strengths.push("Most typical responsibilities are covered in the experience section.");
  }

  return strengths;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function scoreRoleReadiness(
  resumeText: string,
  context: RoleContext,
  expectations: RoleExpectations,
): RoleReadinessResult {
  const resumeNorm = norm(resumeText);

  const { score: skillsScore, missingRequired, matchedRequired } = scoreSkills(resumeNorm, expectations);
  const { score: expScore, gap: experienceGap } = scoreExperience(context, expectations);
  const { score: termScore, missing: missingTerms } = scoreTerminology(resumeNorm, expectations);
  const { score: respScore, uncovered: uncoveredResponsibilities } = scoreResponsibilities(resumeNorm, expectations);

  function cat(category: keyof typeof WEIGHTS, score: number): RoleReadinessCategoryScore {
    const weight = WEIGHTS[category];
    return {
      category,
      score,
      weight,
      weightedScore: Math.round(score * weight * 10) / 10,
      label: LABELS[category],
    };
  }

  const categories = [
    cat("skills", skillsScore),
    cat("experience", expScore),
    cat("terminology", termScore),
    cat("responsibilities", respScore),
  ] as const;

  const total = Math.round(categories.reduce((sum, c) => sum + c.weightedScore, 0));

  const gaps = buildGaps({ missingSkills: missingRequired, experienceGap, missingTerms, uncoveredResponsibilities });
  const strengths = buildStrengths({
    matchedSkills: matchedRequired,
    experienceScore: expScore,
    terminologyScore: termScore,
    responsibilityScore: respScore,
  });

  return { total, categories, roleContext: context, expectations, gaps, strengths };
}
