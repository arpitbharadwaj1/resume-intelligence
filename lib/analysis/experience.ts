/**
 * Experience feature extraction — weight 20, rule + bounded LLM (docs/MEASUREMENT.md §3.4).
 *
 * The critical move is decomposition. Instead of one holistic "how good is this
 * bullet" judgment — which no model answers reproducibly — each bullet is scored
 * on four small signals, two of which never touch a model:
 *
 *   startsWithActionVerb   rule   first word is an action verb
 *   containsTaxonomyToken  rule   names a real skill, technology or domain
 *   statesContext          llm    says what was built / for whom / at what scale
 *   statesOutcome          llm    states a result, not only a duty
 *
 * `bulletCompletenessRatio` is the mean of those four over every bullet. The three
 * remaining features — length band, first-person rate, bullets per role — are pure
 * rule. This file computes the rule half and assembles the whole once verdicts are
 * supplied; the verdicts come from the injected classifier, never from here.
 */
import { wordCount } from "@/lib/parser/normalize";
import type { ExperienceFeatures } from "@/types/scoring";

import actionVerbs from "@/lib/taxonomy/action-verbs.json" with { type: "json" };
import skillSynonyms from "@/lib/taxonomy/skill-synonyms.json" with { type: "json" };
import skillEntries from "@/lib/taxonomy/skills.json" with { type: "json" };

import { collectRoleBullets, type RoleBullet } from "./bullets";
import {
  ternaryScore,
  type ClassifiableBullet,
  type ExperienceVerdict,
  type ResumeClassifier,
} from "./classifier";
import type { AnalysisInput } from "./input";
import { inferProfile, type ResumeProfile } from "./profile";

const ACTION_VERBS = new Set(actionVerbs.verbs.map((verb) => verb.toLowerCase()));

/** Lowercased skill phrases (canonicals + aliases) for unigram/bigram lookup. */
const TAXONOMY_PHRASES = new Set<string>([
  ...Object.keys(skillSynonyms as Record<string, string>),
  ...skillEntries.map((entry) => entry.canonical.toLowerCase()),
]);

/** A word is a first-person pronoun; a bullet carrying one is self-referential. */
const FIRST_PERSON = /\b(?:i|me|my|mine|we|us|our|ours)\b/i;

const LENGTH_BAND_MIN = 8;
const LENGTH_BAND_MAX = 40;

/** Per-bullet rule signals, before any model involvement. */
export interface ExperienceRuleSignal {
  readonly evidenceId: string;
  readonly text: string;
  readonly startsWithActionVerb: boolean;
  readonly containsTaxonomyToken: boolean;
}

export interface ExperienceRuleSignals {
  readonly bullets: readonly ExperienceRuleSignal[];
  readonly bulletsInLengthBand: number;
  readonly firstPersonRatio: number;
  readonly bulletsPerRoleMedian: number;
}

function startsWithActionVerb(text: string): boolean {
  const first = text.match(/[A-Za-z']+/);
  return first !== null && ACTION_VERBS.has(first[0].toLowerCase());
}

function containsTaxonomyToken(text: string): boolean {
  // A dot is kept mid-token ("next.js", "node.js", ".net") but a trailing one is
  // a sentence period — stripping it is what lets "…to Next.js." match "next.js".
  const tokens = (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map((token) =>
    token.replace(/\.+$/, ""),
  );
  for (let i = 0; i < tokens.length; i += 1) {
    if (TAXONOMY_PHRASES.has(tokens[i]!)) return true;
    if (i + 1 < tokens.length && TAXONOMY_PHRASES.has(`${tokens[i]} ${tokens[i + 1]}`)) return true;
  }
  return false;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Compute every rule-derived Experience signal from the segmented roles. */
export function extractExperienceRuleSignals(
  profile: ResumeProfile,
): ExperienceRuleSignals {
  const entries = profile.experienceEntries;
  const bullets = collectRoleBullets(entries);

  const signals = bullets.map((bullet) => ({
    evidenceId: bullet.evidenceId,
    text: bullet.text,
    startsWithActionVerb: startsWithActionVerb(bullet.text),
    containsTaxonomyToken: containsTaxonomyToken(bullet.text),
  }));

  const total = bullets.length;
  const inBand = bullets.filter((bullet) => {
    const words = wordCount(bullet.text);
    return words >= LENGTH_BAND_MIN && words <= LENGTH_BAND_MAX;
  }).length;
  const firstPerson = bullets.filter((bullet) => FIRST_PERSON.test(bullet.text)).length;
  const perRole = entries.map((entry) => entry.bullets.length).filter((count) => count > 0);

  return {
    bullets: signals,
    bulletsInLengthBand: total === 0 ? 0 : inBand / total,
    firstPersonRatio: total === 0 ? 0 : firstPerson / total,
    bulletsPerRoleMedian: median(perRole),
  };
}

/**
 * Fold the two LLM verdicts into the rule signals to produce the full feature
 * vector. Completeness is averaged only over bullets the classifier actually
 * returned a verdict for — a bullet with no verdict is dropped, never defaulted
 * (§5), so a dropped classification cannot silently score as zero.
 */
export function assembleExperienceFeatures(
  rule: ExperienceRuleSignals,
  verdicts: readonly ExperienceVerdict[],
): ExperienceFeatures {
  const byId = new Map(verdicts.map((verdict) => [verdict.evidenceId, verdict]));

  let sum = 0;
  let scored = 0;
  for (const bullet of rule.bullets) {
    const verdict = byId.get(bullet.evidenceId);
    if (verdict === undefined) continue;
    const perBullet =
      (Number(bullet.startsWithActionVerb) +
        Number(bullet.containsTaxonomyToken) +
        ternaryScore(verdict.statesContext) +
        ternaryScore(verdict.statesOutcome)) /
      4;
    sum += perBullet;
    scored += 1;
  }

  return {
    bulletCompletenessRatio: scored === 0 ? 0 : sum / scored,
    bulletsInLengthBand: rule.bulletsInLengthBand,
    firstPersonRatio: rule.firstPersonRatio,
    bulletsPerRoleMedian: rule.bulletsPerRoleMedian,
  };
}

/** The bullets to send for classification, addressed by evidence ID (§5, batched). */
export function experienceBulletsForClassification(
  profile: ResumeProfile,
): readonly ClassifiableBullet[] {
  return collectRoleBullets(profile.experienceEntries).map((bullet: RoleBullet) => ({
    evidenceId: bullet.evidenceId,
    text: bullet.text,
  }));
}

/** Full Experience features, calling the classifier once for the two LLM signals. */
export async function extractExperienceFeatures(
  input: AnalysisInput,
  classifier: ResumeClassifier,
  profile: ResumeProfile = inferProfile(input),
): Promise<ExperienceFeatures> {
  const rule = extractExperienceRuleSignals(profile);
  const verdicts = await classifier.classifyExperienceBullets(
    experienceBulletsForClassification(profile),
  );
  return assembleExperienceFeatures(rule, verdicts);
}
