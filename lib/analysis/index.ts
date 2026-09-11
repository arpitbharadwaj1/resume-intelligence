/**
 * Public API of the analysis layer.
 *
 * Two entry points, one for each stage of the pipeline:
 *
 *   analyzeRuleDerivedFeatures  — the four fully-deterministic categories.
 *                                 No model, no key, σ = 0 (docs/MEASUREMENT.md §6).
 *
 *   analyzeFeatures             — the complete FeatureVector, composing the rule
 *                                 layer with the injected bounded classifier.
 *                                 Pass a real ResumeClassifier when a key is
 *                                 available; pass a fake in tests and CI.
 *
 * Everything else is re-exported so tests can reach individual extractors directly
 * without going through the assembler.
 */

export {
  analyzeRuleDerivedFeatures,
  analyzeFeatures,
  type AnalysisOptions,
} from "./analyze";
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
