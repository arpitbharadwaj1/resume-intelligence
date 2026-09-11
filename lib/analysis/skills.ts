/**
 * Skills feature extraction — weight 15, rule + bounded LLM (docs/MEASUREMENT.md §3.3).
 *
 * Four of the five features are pure rule: how many skills are listed, how many
 * resolve to the taxonomy, whether they are grouped under labels, and the §35
 * keyword-stuffing signal. The fifth — `strongEvidenceRatio` — is where the
 * category earns its weight: a skill in a Skills list is not proof a candidate can
 * use it (CLAUDE.md §1). Evidence is graded:
 *
 *   - **strong** — the skill (or an alias) appears in an experience bullet, *or* a
 *     bounded LLM call confirms a bullet demonstrates it. 0.55 of the rubric.
 *   - **weak** — listed only, never demonstrated.
 *
 * The literal-match half is computed here and is enough on its own; the LLM half
 * can only *promote* a weak skill to strong, never demote, so the rule value is a
 * floor. That keeps keyword presence from driving the score (§35, Principle 2).
 */
import type { SkillsFeatures } from "@/types/scoring";

import skillSynonyms from "@/lib/taxonomy/skill-synonyms.json" with { type: "json" };
import skillEntries from "@/lib/taxonomy/skills.json" with { type: "json" };

import { collectRoleBullets } from "./bullets";
import {
  ternaryScore,
  type ClassifiableSkillBullet,
  type ResumeClassifier,
} from "./classifier";
import type { AnalysisInput } from "./input";
import { inferProfile, type ResumeProfile } from "./profile";
import { findSection } from "@/lib/parser/sections";

const SYNONYMS: Record<string, string> = skillSynonyms;
const CANONICAL_SET = new Set(skillEntries.map((entry) => entry.canonical.toLowerCase()));

/** A skill as listed on the resume, with its resolution and evidence grade. */
export interface SkillEvidence {
  /** The text exactly as the candidate listed it. */
  readonly listed: string;
  /** The taxonomy canonical it resolved to, or null if unrecognised. */
  readonly canonical: string | null;
  /** True once evidence is found in an experience bullet (literal or semantic). */
  readonly strong: boolean;
}

/** Tokens that appear as group labels or list glue, never as skills. */
const NON_SKILL_TOKEN = /^(and|or|with|the|of|using|e\.?g\.?|etc)$/i;

/**
 * Pull the listed skills out of the Skills section, and note whether they were
 * grouped under labels ("Languages: …") rather than dumped as one flat list.
 */
function parseListedSkills(input: AnalysisInput): { skills: readonly string[]; grouped: boolean } {
  const section = findSection(input.sections, "skills");
  if (section === undefined || section.lines.length === 0) return { skills: [], grouped: false };

  const skills: string[] = [];
  const seen = new Set<string>();
  let groupedLines = 0;

  for (const raw of section.lines) {
    const line = raw.replace(/^[•\-*]\s+/, "").trim();
    if (line.length === 0) continue;

    // "Languages: JavaScript, TypeScript" — a label, then the skills. The colon
    // must not swallow a skill that legitimately contains one, so split once.
    const colon = line.indexOf(":");
    const hasLabel = colon > 0 && colon < 40 && /^[A-Za-z][A-Za-z /&+]*$/.test(line.slice(0, colon));
    const items = hasLabel ? line.slice(colon + 1) : line;
    if (hasLabel) groupedLines += 1;

    for (const piece of items.split(/[,;•]|\s{2,}/)) {
      const skill = piece.trim();
      if (skill.length === 0 || NON_SKILL_TOKEN.test(skill)) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push(skill);
    }
  }

  // Grouping counts only when most of the section uses it — one stray label on an
  // otherwise flat dump is not a grouped section.
  const grouped = groupedLines >= Math.max(1, Math.ceil(section.lines.length / 2));
  return { skills, grouped };
}

/** Resolve a listed skill to its taxonomy canonical, or null. */
function canonicalize(skill: string): string | null {
  const key = skill.toLowerCase();
  if (SYNONYMS[key] !== undefined) return SYNONYMS[key];
  if (CANONICAL_SET.has(key)) return skill;
  return null;
}

/** Whole-word, case-insensitive presence of a term in a body of text. */
function mentions(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i").test(text);
}

/**
 * The §35 stuffing signal: the most-repeated single skill token as a share of all
 * document tokens. A resume that pastes "React React React" to game a keyword
 * filter spikes here; an honestly-written one sits near zero.
 */
function keywordRepetitionIndex(input: AnalysisInput, listed: readonly string[]): number {
  const tokens = input.text.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]*/g) ?? [];
  if (tokens.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  // Only tokens that are actually skill words count — a repeated "the" is prose,
  // not stuffing. Multi-word skills contribute each of their tokens.
  const skillTokens = new Set<string>();
  for (const skill of listed) {
    for (const token of skill.toLowerCase().split(/\s+/)) {
      if (token.length > 2 && !NON_SKILL_TOKEN.test(token)) skillTokens.add(token);
    }
  }

  let max = 0;
  for (const token of skillTokens) max = Math.max(max, counts.get(token) ?? 0);
  return max / tokens.length;
}

/**
 * Grade every listed skill by literal evidence: strong if it (or its canonical)
 * is mentioned in an experience bullet, weak otherwise. This is the rule floor for
 * `strongEvidenceRatio`; a classifier can later promote weak skills it can show
 * are demonstrated, but never the reverse.
 */
function gradeSkills(
  listed: readonly string[],
  bulletText: string,
): readonly SkillEvidence[] {
  return listed.map((skill) => {
    const canonical = canonicalize(skill);
    const strong = mentions(bulletText, skill) || (canonical !== null && mentions(bulletText, canonical));
    return { listed: skill, canonical, strong };
  });
}

function assembleFeatures(
  input: AnalysisInput,
  listed: readonly string[],
  grouped: boolean,
  graded: readonly SkillEvidence[],
): SkillsFeatures {
  const total = listed.length;
  const canonicalized = graded.filter((skill) => skill.canonical !== null).length;
  const strong = graded.filter((skill) => skill.strong).length;

  return {
    totalSkills: total,
    canonicalizedRatio: total === 0 ? 0 : canonicalized / total,
    skillGroupingPresent: grouped,
    keywordRepetitionIndex: keywordRepetitionIndex(input, listed),
    strongEvidenceRatio: total === 0 ? 0 : strong / total,
  };
}

/** All experience-bullet text, joined — the corpus skill evidence is searched in. */
function experienceCorpus(profile: ResumeProfile): string {
  return collectRoleBullets(profile.experienceEntries)
    .map((bullet) => bullet.text)
    .join("\n");
}

/**
 * Rule-only Skills features. `strongEvidenceRatio` here counts literal mentions;
 * for the LLM-refined value use {@link extractSkillsFeaturesWithEvidence}.
 */
export function extractSkillsFeatures(
  input: AnalysisInput,
  profile: ResumeProfile = inferProfile(input),
): SkillsFeatures {
  const { skills, grouped } = parseListedSkills(input);
  const graded = gradeSkills(skills, experienceCorpus(profile));
  return assembleFeatures(input, skills, grouped, graded);
}

/**
 * Skills features with semantic evidence. Weak skills are paired with every
 * experience bullet, the classifier is asked (once, batched) whether any bullet
 * demonstrates the skill, and a `yes`/`unclear` promotes it to strong. The literal
 * grade is the floor — this call can only raise `strongEvidenceRatio`.
 */
export async function extractSkillsFeaturesWithEvidence(
  input: AnalysisInput,
  classifier: ResumeClassifier,
  profile: ResumeProfile = inferProfile(input),
): Promise<SkillsFeatures> {
  const { skills, grouped } = parseListedSkills(input);
  const bullets = collectRoleBullets(profile.experienceEntries);
  const corpus = bullets.map((bullet) => bullet.text).join("\n");
  const graded = gradeSkills(skills, corpus);

  const pairs: ClassifiableSkillBullet[] = [];
  for (const skill of graded) {
    if (skill.strong) continue;
    for (const bullet of bullets) {
      pairs.push({ skill: skill.listed, evidenceId: bullet.evidenceId, text: bullet.text });
    }
  }

  if (pairs.length === 0) return assembleFeatures(input, skills, grouped, graded);

  const verdicts = await classifier.classifySkillEvidence(pairs);
  const demonstrated = new Set<string>();
  for (const verdict of verdicts) {
    if (ternaryScore(verdict.demonstratesSkill) > 0) demonstrated.add(verdict.skill);
  }

  const promoted = graded.map((skill) =>
    skill.strong || demonstrated.has(skill.listed) ? { ...skill, strong: true } : skill,
  );
  return assembleFeatures(input, skills, grouped, promoted);
}
