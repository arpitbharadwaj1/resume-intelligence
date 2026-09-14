/**
 * Deterministic Job Match scorer (Phases 9–10, §20).
 *
 * Compares a resume against a ParsedJD across six weighted categories.
 * All matching is text-based with synonym normalization (§22).
 * No import from lib/ai/ — the ParsedJD is passed in as validated data.
 *
 * Weights (§20):
 *   Required Skills        30 pts
 *   Relevant Experience    25 pts
 *   Responsibilities       20 pts
 *   Keywords/Terminology   10 pts
 *   Seniority/Experience   10 pts
 *   Other Requirements      5 pts
 */
import type { JobMatchCategoryScore, JobMatchGap, JobMatchResult, ParsedJD } from "@/types/jd";

const WEIGHTS = {
  requiredSkills: 30,
  experience: 25,
  responsibilities: 20,
  keywords: 10,
  seniority: 10,
  otherRequirements: 5,
} as const;

const LABELS: Record<keyof typeof WEIGHTS, string> = {
  requiredSkills: "Required skills",
  experience: "Relevant experience",
  responsibilities: "Responsibilities",
  keywords: "Keywords & terminology",
  seniority: "Seniority alignment",
  otherRequirements: "Other requirements",
};

// ---------------------------------------------------------------------------
// Synonym normalization (§22)
// ---------------------------------------------------------------------------

const SYNONYM_GROUPS: string[][] = [
  ["react", "react.js", "reactjs"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angularjs", "angular.js"],
  ["node", "node.js", "nodejs"],
  ["next.js", "nextjs", "next"],
  ["typescript", "ts"],
  ["javascript", "js"],
  ["python", "py"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],
  ["kubernetes", "k8s"],
  ["postgresql", "postgres"],
  ["mongodb", "mongo"],
  ["elasticsearch", "elastic"],
  ["graphql", "gql"],
  ["continuous integration", "ci"],
  ["continuous deployment", "cd"],
  ["ci/cd", "cicd"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp"],
  ["large language model", "llm"],
  ["sql server", "mssql"],
  ["rest api", "rest", "restful api", "restful"],
  ["objective-c", "objc"],
];

/** Build canonical → [all variants] and variant → canonical maps. */
function buildSynonymMaps(): {
  toCanonical: Map<string, string>;
  fromCanonical: Map<string, string[]>;
} {
  const toCanonical = new Map<string, string>();
  const fromCanonical = new Map<string, string[]>();

  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0];
    if (!canonical) continue;
    fromCanonical.set(canonical, group);
    for (const variant of group) {
      if (variant) toCanonical.set(variant.toLowerCase(), canonical);
    }
  }

  return { toCanonical, fromCanonical };
}

const { toCanonical, fromCanonical } = buildSynonymMaps();

function canonicalize(skill: string): string {
  const lower = skill.toLowerCase();
  return toCanonical.get(lower) ?? lower;
}

/** Get all known variants of a skill (for searching in resume text). */
function variants(skill: string): string[] {
  const canon = canonicalize(skill);
  return fromCanonical.get(canon) ?? [canon];
}

// ---------------------------------------------------------------------------
// Text matching helpers
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 .#+/]/g, " ").replace(/\s+/g, " ").trim();
}

/** True if any variant of the skill appears in the normalized resume text. */
function skillInResume(resumeNorm: string, skill: string): boolean {
  return variants(norm(skill)).some((v) => resumeNorm.includes(v));
}

/** Responsibility covered if >= 2 meaningful tokens appear in resume text. */
const STOP = new Set(["with", "using", "across", "ensure", "work", "team", "will", "have", "must"]);

function responsibilityCovered(resumeNorm: string, responsibility: string): boolean {
  const tokens = norm(responsibility)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOP.has(t));
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => resumeNorm.includes(t)).length;
  return matched >= Math.min(2, tokens.length);
}

// ---------------------------------------------------------------------------
// Seniority year ranges
// ---------------------------------------------------------------------------

const SENIORITY_YEARS: Record<string, { min: number; max: number }> = {
  junior: { min: 0, max: 3 },
  mid: { min: 2, max: 6 },
  senior: { min: 5, max: 12 },
  lead: { min: 7, max: 15 },
  principal: { min: 10, max: 20 },
  unknown: { min: 0, max: 99 },
};

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scoreRequiredSkills(
  resumeNorm: string,
  jd: ParsedJD,
): { score: number; matched: string[]; missing: string[] } {
  if (jd.requiredSkills.length === 0) return { score: 1, matched: [], missing: [] };
  const matched = jd.requiredSkills.filter((s) => skillInResume(resumeNorm, s));
  const missing = jd.requiredSkills.filter((s) => !skillInResume(resumeNorm, s));
  return { score: matched.length / jd.requiredSkills.length, matched, missing };
}

function scoreExperience(
  candidateYears: number,
  jd: ParsedJD,
): { score: number; gap: number } {
  const min = jd.minExperienceYears;
  if (min === 0) return { score: 1, gap: 0 };
  if (candidateYears >= min) {
    const preferred = jd.preferredExperienceYears ?? min;
    const extra = preferred > min
      ? Math.min(candidateYears - min, preferred - min) / (preferred - min)
      : 1;
    return { score: 0.7 + extra * 0.3, gap: 0 };
  }
  return { score: Math.max(0, (candidateYears / min) * 0.7), gap: min - candidateYears };
}

function scoreResponsibilities(
  resumeNorm: string,
  jd: ParsedJD,
): { score: number; uncovered: string[] } {
  if (jd.responsibilities.length === 0) return { score: 1, uncovered: [] };
  const uncovered = jd.responsibilities.filter((r) => !responsibilityCovered(resumeNorm, r));
  return {
    score: (jd.responsibilities.length - uncovered.length) / jd.responsibilities.length,
    uncovered,
  };
}

function scoreKeywords(
  resumeNorm: string,
  jd: ParsedJD,
): { score: number; missing: string[] } {
  if (jd.keywords.length === 0) return { score: 1, missing: [] };
  const matched = jd.keywords.filter((k) => skillInResume(resumeNorm, k));
  const missing = jd.keywords.filter((k) => !skillInResume(resumeNorm, k));
  return { score: matched.length / jd.keywords.length, missing };
}

function scoreSeniority(
  candidateYears: number,
  jd: ParsedJD,
): { score: number } {
  const range = SENIORITY_YEARS[jd.seniority] ?? { min: 0, max: 99 };
  if (range.min === 0) return { score: 1 };
  if (candidateYears >= range.min && candidateYears <= range.max + 3) return { score: 1 };
  if (candidateYears > range.max + 3) return { score: 0.8 }; // overqualified, slight discount
  const gap = range.min - candidateYears;
  return { score: Math.max(0, 1 - gap / range.min) };
}

function scoreOtherRequirements(
  resumeNorm: string,
  jd: ParsedJD,
): { score: number; missing: string[] } {
  if (jd.otherRequirements.length === 0) return { score: 1, missing: [] };
  const covered = jd.otherRequirements.filter((r) => responsibilityCovered(resumeNorm, r));
  const missing = jd.otherRequirements.filter((r) => !responsibilityCovered(resumeNorm, r));
  // Other requirements are often hard to evidence from text alone — partial credit is fair.
  const score = covered.length / jd.otherRequirements.length;
  return { score: score * 0.8 + 0.2, missing }; // floor at 0.2 (we can't penalise certainty)
}

// ---------------------------------------------------------------------------
// Gap + strength builders
// ---------------------------------------------------------------------------

function buildGaps(params: {
  missingRequired: string[];
  experienceGap: number;
  uncoveredResponsibilities: string[];
  missingKeywords: string[];
}): JobMatchGap[] {
  const gaps: JobMatchGap[] = [];

  if (params.missingRequired.length > 0) {
    const sev = params.missingRequired.length >= 5 ? "high" : params.missingRequired.length >= 2 ? "medium" : "low";
    gaps.push({
      category: "requiredSkills",
      severity: sev,
      description: `${params.missingRequired.length} required skill${params.missingRequired.length > 1 ? "s" : ""} not evidenced in the resume.`,
      items: params.missingRequired.slice(0, 8),
    });
  }

  if (params.experienceGap > 0) {
    gaps.push({
      category: "experience",
      severity: params.experienceGap >= 3 ? "high" : "medium",
      description: `Resume indicates ${params.experienceGap} fewer year${params.experienceGap > 1 ? "s" : ""} than the role requires.`,
      items: [],
    });
  }

  if (params.missingKeywords.length >= 6) {
    gaps.push({
      category: "keywords",
      severity: params.missingKeywords.length >= 12 ? "high" : "medium",
      description: `${params.missingKeywords.length} role-specific keywords absent from the resume.`,
      items: params.missingKeywords.slice(0, 8),
    });
  }

  return gaps;
}

function buildStrengths(params: {
  matchedRequired: string[];
  experienceScore: number;
  responsibilityScore: number;
}): string[] {
  const strengths: string[] = [];
  if (params.matchedRequired.length >= 3) {
    strengths.push(
      `${params.matchedRequired.length} required skill${params.matchedRequired.length > 1 ? "s" : ""} clearly evidenced: ${params.matchedRequired.slice(0, 4).join(", ")}`,
    );
  }
  if (params.experienceScore >= 0.9) strengths.push("Experience level matches the role requirements.");
  if (params.responsibilityScore >= 0.7) strengths.push("Resume covers most of the key responsibilities.");
  return strengths;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function scoreJobMatch(
  resumeText: string,
  candidateYears: number,
  jd: ParsedJD,
): JobMatchResult {
  const resumeNorm = norm(resumeText);

  const { score: reqScore, matched: matchedRequired, missing: missingRequired } = scoreRequiredSkills(resumeNorm, jd);
  const { score: expScore, gap: experienceGap } = scoreExperience(candidateYears, jd);
  const { score: respScore, uncovered } = scoreResponsibilities(resumeNorm, jd);
  const { score: kwScore, missing: missingKeywords } = scoreKeywords(resumeNorm, jd);
  const { score: senScore } = scoreSeniority(candidateYears, jd);
  const { score: otherScore } = scoreOtherRequirements(resumeNorm, jd);

  function cat(category: keyof typeof WEIGHTS, score: number, matched: string[] = [], missing: string[] = []): JobMatchCategoryScore {
    const weight = WEIGHTS[category];
    return {
      category,
      score,
      weight,
      weightedScore: Math.round(score * weight * 10) / 10,
      label: LABELS[category],
      matched,
      missing,
    };
  }

  const categories = [
    cat("requiredSkills", reqScore, matchedRequired, missingRequired),
    cat("experience", expScore),
    cat("responsibilities", respScore, [], uncovered),
    cat("keywords", kwScore, [], missingKeywords),
    cat("seniority", senScore),
    cat("otherRequirements", otherScore),
  ] as const;

  const total = Math.round(categories.reduce((s, c) => s + c.weightedScore, 0));
  const gaps = buildGaps({ missingRequired, experienceGap, uncoveredResponsibilities: uncovered, missingKeywords });
  const strengths = buildStrengths({ matchedRequired, experienceScore: expScore, responsibilityScore: respScore });

  return { total, categories, parsedJD: jd, candidateYears, gaps, strengths };
}
