/**
 * Impact feature extraction — weight 15, rule + bounded LLM (docs/MEASUREMENT.md §3.5).
 *
 * Impact is where the product is most tempted to reward the wrong thing. A number
 * is not an outcome: *"managed a team of 5"* is scope, *"cut load time 60%"* is a
 * result. So the rule layer only ever measures the presence of a magnitude — the
 * quantified-bullet ratio, how many of six metric families appear, and whether the
 * most recent role has any numbers at all — and a bounded LLM call decides which of
 * those magnitudes are genuine outcomes. The rubric multiplies the two, so scope
 * numbers count for little (§3.5), and a 0.12 floor means a truthful qualitative
 * resume is never scored to zero: fabricating a number must never be the rational
 * move (Principle 5).
 */
import type { ImpactFeatures } from "@/types/scoring";

import { bulletsInMostRecentRole, collectRoleBullets, type RoleBullet } from "./bullets";
import {
  outcomeScore,
  type ClassifiableBullet,
  type OutcomeClassification,
  type ResumeClassifier,
} from "./classifier";
import type { AnalysisInput } from "./input";
import { inferProfile, type ResumeProfile } from "./profile";

/**
 * The six magnitude families. A number is only impact if it belongs to one of
 * these; ordering does not matter because a bullet is tested against all six.
 * `counts` deliberately excludes unit nouns (seconds, dollars, percent) so a
 * duration or a currency is not double-counted as a headcount.
 */
const METRIC_FAMILIES: ReadonlyArray<readonly [string, RegExp]> = [
  ["percentage", /\d+(?:\.\d+)?\s*(?:%|per\s?cent(?:age)?)/i],
  ["currency", /(?:[$£€]\s?\d)|\b\d+(?:[.,]\d+)?\s?(?:dollars?|pounds?|euros?|usd|aud|gbp|eur)\b/i],
  ["duration", /\b\d+(?:\.\d+)?\s*(?:second|sec|minute|min|hour|hr|day|week|month|year|quarter)s?\b/i],
  ["multiplier", /\b\d+(?:\.\d+)?\s*(?:x\b|times\b|-?fold\b)/i],
  ["scale", /\b\d+(?:\.\d+)?\s?(?:k|m|bn|thousand|million|billion)\+?\b/i],
  [
    "count",
    /\b\d{1,3}(?:,\d{3})*\+?\s+(?!(?:second|sec|minute|min|hour|hr|day|week|month|year|quarter|percent|dollar|pound|euro|kg|km|mb|gb|tb)s?\b)(?:[a-z]+\s+){0,2}[a-z]+s\b/i,
  ],
];

/** The metric families a single bullet exhibits. */
function bulletMetricFamilies(text: string): ReadonlySet<string> {
  const families = new Set<string>();
  for (const [name, pattern] of METRIC_FAMILIES) if (pattern.test(text)) families.add(name);
  return families;
}

export interface ImpactRuleSignals {
  /** Quantified bullets, addressed for the outcome classifier. */
  readonly quantifiedBullets: readonly RoleBullet[];
  readonly quantifiedBulletRatio: number;
  readonly distinctMetricTypes: number;
  readonly metricsInRecentRole: boolean;
}

/** Compute the rule-derived Impact signals from the segmented roles. */
export function extractImpactRuleSignals(profile: ResumeProfile): ImpactRuleSignals {
  const bullets = collectRoleBullets(profile.experienceEntries);
  const families = new Set<string>();
  const quantified: RoleBullet[] = [];

  for (const bullet of bullets) {
    const hit = bulletMetricFamilies(bullet.text);
    if (hit.size === 0) continue;
    quantified.push(bullet);
    for (const family of hit) families.add(family);
  }

  const recent = new Set(bulletsInMostRecentRole(bullets).map((bullet) => bullet.evidenceId));

  return {
    quantifiedBullets: quantified,
    quantifiedBulletRatio: bullets.length === 0 ? 0 : quantified.length / bullets.length,
    distinctMetricTypes: families.size,
    metricsInRecentRole: quantified.some((bullet) => recent.has(bullet.evidenceId)),
  };
}

/**
 * Fold the outcome verdicts into the rule signals. `genuineOutcomeRatio` is the
 * mean outcome score over quantified bullets the classifier answered for; a
 * quantified bullet with no verdict is dropped, not defaulted (§5). With no
 * quantified bullets the ratio is 0 — and since the rubric multiplies it by
 * `quantifiedBulletRatio` (also 0), the two agree.
 */
export function assembleImpactFeatures(
  rule: ImpactRuleSignals,
  verdicts: readonly OutcomeClassification[],
): ImpactFeatures {
  const byId = new Map(verdicts.map((verdict) => [verdict.evidenceId, verdict]));

  let sum = 0;
  let scored = 0;
  for (const bullet of rule.quantifiedBullets) {
    const verdict = byId.get(bullet.evidenceId);
    if (verdict === undefined) continue;
    sum += outcomeScore(verdict.verdict);
    scored += 1;
  }

  return {
    quantifiedBulletRatio: rule.quantifiedBulletRatio,
    genuineOutcomeRatio: scored === 0 ? 0 : sum / scored,
    distinctMetricTypes: rule.distinctMetricTypes,
    metricsInRecentRole: rule.metricsInRecentRole,
  };
}

/** The quantified bullets to send for outcome classification (§5, batched). */
export function quantifiedBulletsForClassification(
  profile: ResumeProfile,
): readonly ClassifiableBullet[] {
  return extractImpactRuleSignals(profile).quantifiedBullets.map((bullet) => ({
    evidenceId: bullet.evidenceId,
    text: bullet.text,
  }));
}

/** Full Impact features, classifying quantified bullets for genuine outcomes. */
export async function extractImpactFeatures(
  input: AnalysisInput,
  classifier: ResumeClassifier,
  profile: ResumeProfile = inferProfile(input),
): Promise<ImpactFeatures> {
  const rule = extractImpactRuleSignals(profile);
  const verdicts = await classifier.classifyQuantifiedOutcomes(
    rule.quantifiedBullets.map((bullet) => ({ evidenceId: bullet.evidenceId, text: bullet.text })),
  );
  return assembleImpactFeatures(rule, verdicts);
}
