/**
 * Full feature assembly — the complete FeatureVector from text + classifier.
 *
 * This is the one place that composes all three layers:
 *   1. rule-derived (contact, structure, formatting, parseability)
 *   2. rule halves of the mixed categories (skills literal evidence, experience
 *      rule signals, impact rule signals)
 *   3. LLM verdicts folded in via the injected classifier (one batched call per
 *      category that needs it)
 *
 * The assembler does not know whether the classifier talks to a real model or a
 * test fake — that is the interface's job. It passes each call's bullets in once,
 * the classifier returns an array of verdicts, and the extractors fold them in.
 * No verdict is ever defaulted to zero on a dropped ID (docs/MEASUREMENT.md §5).
 *
 * Rule features always run even when the classifier is unavailable: every call
 * wraps classifier work in try/catch so a network error or a missing key degrades
 * gracefully to the rule floor rather than failing the whole analysis.
 */
import type { FeatureVector } from "@/types/scoring";

import { extractContactFeatures } from "./contact";
import {
  assembleExperienceFeatures,
  experienceBulletsForClassification,
  extractExperienceRuleSignals,
} from "./experience";
import { extractFormattingFeatures } from "./formatting";
import {
  assembleImpactFeatures,
  extractImpactRuleSignals,
  quantifiedBulletsForClassification,
} from "./impact";
import { buildAnalysisInput, type AnalysisInput } from "./input";
import { inferProfile, type ResumeProfile } from "./profile";
import { extractSkillsFeatures, extractSkillsFeaturesWithEvidence } from "./skills";
import { extractStructureFeatures } from "./structure";
import type { ResumeClassifier } from "./classifier";

export interface AnalysisOptions {
  readonly pageCount?: number;
}

/**
 * The rule-only half: every feature that never needs a model.
 * Stable to call with just the text — useful for quick previews and for the
 * stability-budget CI that runs rule categories against golden fixtures.
 */
export function analyzeRuleDerivedFeatures(
  rawText: string,
  pageCount = 1,
): Pick<FeatureVector, "parseability" | "structure" | "formatting" | "contact"> {
  const input = buildAnalysisInput(rawText, pageCount);
  const profile = inferProfile(input);

  return {
    parseability: input.quality.features,
    structure: extractStructureFeatures(input, profile),
    formatting: extractFormattingFeatures(input),
    contact: extractContactFeatures(input, profile),
  };
}

/**
 * The full FeatureVector, composed from the rule layer and the bounded
 * classifier. Three LLM calls are made — each once, each batched, each asking
 * a narrow per-item question with an enum answer (R2).
 *
 * Any classifier call that throws falls back to the rule floor rather than
 * propagating the error. This means a bad network makes the score lower
 * (less evidence credited) rather than making it unavailable — the right
 * degradation direction for a user-facing tool.
 */
export async function analyzeFeatures(
  rawText: string,
  classifier: ResumeClassifier,
  options: AnalysisOptions = {},
): Promise<FeatureVector> {
  const pageCount = options.pageCount ?? 1;
  const input = buildAnalysisInput(rawText, pageCount);
  const profile = inferProfile(input);

  const [skills, experience, impact] = await Promise.all([
    analyzeSkillsWithFallback(input, classifier, profile),
    analyzeExperienceWithFallback(input, classifier, profile),
    analyzeImpactWithFallback(input, classifier, profile),
  ]);

  return {
    parseability: input.quality.features,
    structure: extractStructureFeatures(input, profile),
    formatting: extractFormattingFeatures(input),
    contact: extractContactFeatures(input, profile),
    skills,
    experience,
    impact,
  };
}

async function analyzeSkillsWithFallback(
  input: AnalysisInput,
  classifier: ResumeClassifier,
  profile: ResumeProfile,
) {
  try {
    return await extractSkillsFeaturesWithEvidence(input, classifier, profile);
  } catch {
    return extractSkillsFeatures(input, profile);
  }
}

async function analyzeExperienceWithFallback(
  _input: AnalysisInput,
  classifier: ResumeClassifier,
  profile: ResumeProfile,
) {
  const rule = extractExperienceRuleSignals(profile);
  try {
    const verdicts = await classifier.classifyExperienceBullets(
      experienceBulletsForClassification(profile),
    );
    return assembleExperienceFeatures(rule, verdicts);
  } catch {
    return assembleExperienceFeatures(rule, []);
  }
}

async function analyzeImpactWithFallback(
  _input: AnalysisInput,
  classifier: ResumeClassifier,
  profile: ResumeProfile,
) {
  const rule = extractImpactRuleSignals(profile);
  try {
    const verdicts = await classifier.classifyQuantifiedOutcomes(
      quantifiedBulletsForClassification(profile),
    );
    return assembleImpactFeatures(rule, verdicts);
  } catch {
    return assembleImpactFeatures(rule, []);
  }
}
