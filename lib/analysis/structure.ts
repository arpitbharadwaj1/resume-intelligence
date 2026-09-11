/**
 * Structure feature extraction — weight 15, entirely rule-derived
 * (docs/MEASUREMENT.md §3.2).
 *
 * Structure asks whether the expected parts of a resume are present, ordered and
 * internally consistent — not whether they are well written, which is
 * Experience's job. Two of its features are seniority-aware:
 *
 *   - `summaryExpected` is false for an entry-level candidate, so a fresher is not
 *     marked down for omitting a summary (the exemption, not a penalty).
 *   - `sectionOrderScore` compares the actual section order to the conventional
 *     order *for that seniority* — education leads for a fresher, experience for
 *     everyone else.
 *
 * §18 restraint: only Experience, Skills, Education and Summary are considered.
 * Projects, certifications and awards are contextual, and requiring them would
 * penalise a perfectly ordinary resume for a section it had no reason to include.
 */
import { findSection, type SectionKind } from "@/lib/parser/sections";
import type { StructureFeatures } from "@/types/scoring";

import { endpointOrdinal } from "./dates";
import type { AnalysisInput } from "./input";
import { inferProfile, type ResumeProfile } from "./profile";
import type { ExperienceEntry } from "./segment";

/** The sections whose relative order Structure judges. */
const ORDERED_KINDS: readonly SectionKind[] = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
];

/** Conventional order for a non-entry resume: experience leads. */
const ORDER_STANDARD: readonly SectionKind[] = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
];

/** Conventional order for an entry-level resume: education leads. */
const ORDER_ENTRY: readonly SectionKind[] = [
  "contact",
  "summary",
  "education",
  "experience",
  "skills",
];

function hasPopulatedSection(input: AnalysisInput, kind: SectionKind): boolean {
  const section = findSection(input.sections, kind);
  return section !== undefined && section.lines.length > 0;
}

/**
 * Kendall-tau similarity of the actual section order to the expected order,
 * mapped from [-1, 1] to [0, 1]. Only sections present in both orderings count,
 * so a resume is never penalised for the position of a section it does not have.
 * One or zero shared sections is trivially in order and scores 1.
 */
function sectionOrderScore(
  input: AnalysisInput,
  expectedOrder: readonly SectionKind[],
): number {
  const actualOrder = firstOccurrenceOrder(input);
  const shared = expectedOrder.filter((kind) => actualOrder.includes(kind));
  if (shared.length <= 1) return 1;

  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < shared.length; i += 1) {
    for (let j = i + 1; j < shared.length; j += 1) {
      // In the expected order shared[i] precedes shared[j]; concordant when the
      // actual order agrees.
      const inActualOrder =
        actualOrder.indexOf(shared[i]!) < actualOrder.indexOf(shared[j]!);
      if (inActualOrder) concordant += 1;
      else discordant += 1;
    }
  }

  const tau = (concordant - discordant) / (concordant + discordant);
  return (tau + 1) / 2;
}

/** The ordered kinds in the order they first appear in the document. */
function firstOccurrenceOrder(input: AnalysisInput): readonly SectionKind[] {
  const seen: SectionKind[] = [];
  for (const section of input.sections) {
    if (
      ORDERED_KINDS.includes(section.kind) &&
      section.lines.length > 0 &&
      !seen.includes(section.kind)
    ) {
      seen.push(section.kind);
    }
  }
  return seen;
}

/**
 * Whether dated entries run newest-first. Undated entries are skipped rather than
 * treated as a break, and zero or one dated entry is trivially consistent.
 */
function chronologyConsistent(entries: readonly ExperienceEntry[]): boolean {
  const starts = entries
    .map((entry) => entry.dateRange)
    .filter((range): range is NonNullable<typeof range> => range !== null)
    .map((range) => endpointOrdinal(range.start));

  for (let i = 1; i < starts.length; i += 1) {
    // Reverse-chronological: each start no later than the one before it.
    if (starts[i]! > starts[i - 1]!) return false;
  }
  return true;
}

export function extractStructureFeatures(
  input: AnalysisInput,
  profile: ResumeProfile = inferProfile(input),
): StructureFeatures {
  const entries = profile.experienceEntries;
  const datedEntries = entries.filter((entry) => entry.dateRange !== null).length;

  const expectedOrder = profile.seniority === "entry" ? ORDER_ENTRY : ORDER_STANDARD;

  return {
    hasExperience: profile.hasExperienceSection,
    hasSkills: hasPopulatedSection(input, "skills"),
    hasEducation: hasPopulatedSection(input, "education"),
    hasSummary: hasPopulatedSection(input, "summary"),
    summaryExpected: profile.seniority !== "entry",
    sectionOrderScore: sectionOrderScore(input, expectedOrder),
    chronologyConsistent: chronologyConsistent(entries),
    // No entries means no dated entries to credit; 0 rather than a divide-by-zero.
    datedEntryRatio: entries.length === 0 ? 0 : datedEntries / entries.length,
  };
}
