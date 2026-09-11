/**
 * The rule-derived measurement layer.
 *
 * This is the middle layer docs/MEASUREMENT.md describes and the architecture
 * spec omits: it turns parsed resume text into the countable, evidence-linked
 * feature values the scoring engine consumes (R1). Everything here is
 * deterministic code — no model is involved, and by ESLint rule none may be
 * (Principle 3 / R2).
 *
 * Four of the seven categories are fully rule-derived and are produced here in
 * full: Parseability (via the parser's quality pass), Structure, Formatting and
 * Contact — 50% of the total weight at zero AI cost and zero variance (R3). The
 * remaining three (Skills, Experience, Impact) mix these rule signals with
 * bounded LLM classifications and are assembled a layer up, once that seam
 * exists.
 */
import type {
  ContactFeatures,
  FormattingFeatures,
  ParseabilityFeatures,
  StructureFeatures,
} from "@/types/scoring";

import { extractContactFeatures } from "./contact";
import { extractFormattingFeatures } from "./formatting";
import { buildAnalysisInput } from "./input";
import { inferProfile } from "./profile";
import { extractStructureFeatures } from "./structure";

/** The categories the rule layer can compute on its own, with no model. */
export interface RuleDerivedFeatures {
  readonly parseability: ParseabilityFeatures;
  readonly structure: StructureFeatures;
  readonly formatting: FormattingFeatures;
  readonly contact: ContactFeatures;
}

/**
 * Produce the rule-derived feature slice from extracted resume text.
 *
 * The profile (seniority, engineering signal) is inferred once and shared by the
 * Structure and Contact extractors, so the two cannot disagree about who the
 * resume belongs to.
 */
export function analyzeRuleDerivedFeatures(
  rawText: string,
  pageCount: number,
): RuleDerivedFeatures {
  const input = buildAnalysisInput(rawText, pageCount);
  const profile = inferProfile(input);

  return {
    parseability: input.quality.features,
    structure: extractStructureFeatures(input, profile),
    formatting: extractFormattingFeatures(input),
    contact: extractContactFeatures(input, profile),
  };
}

export { buildAnalysisInput, type AnalysisInput } from "./input";
export { inferProfile, type ResumeProfile, type Seniority } from "./profile";
export { extractContactFeatures } from "./contact";
export { extractStructureFeatures } from "./structure";
export { extractFormattingFeatures } from "./formatting";
export {
  extractSkillsFeatures,
  extractSkillsFeaturesWithEvidence,
  type SkillEvidence,
} from "./skills";
export {
  extractExperienceRuleSignals,
  assembleExperienceFeatures,
  experienceBulletsForClassification,
  extractExperienceFeatures,
  type ExperienceRuleSignal,
  type ExperienceRuleSignals,
} from "./experience";
export {
  extractImpactRuleSignals,
  assembleImpactFeatures,
  quantifiedBulletsForClassification,
  extractImpactFeatures,
  type ImpactRuleSignals,
} from "./impact";
export { segmentEntries, type ExperienceEntry } from "./segment";
export {
  collectRoleBullets,
  bulletsInMostRecentRole,
  type RoleBullet,
} from "./bullets";
export {
  ternaryScore,
  outcomeScore,
  type Ternary,
  type OutcomeVerdict,
  type ResumeClassifier,
  type ClassifiableBullet,
  type ClassifiableSkillBullet,
  type ExperienceVerdict,
  type OutcomeClassification,
  type SkillEvidenceVerdict,
} from "./classifier";
export {
  parseDateRange,
  hasDateRange,
  collectDateFormats,
  type DateRange,
  type DateFormatSignature,
} from "./dates";
