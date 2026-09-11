/**
 * Resume profile inference — seniority and field.
 *
 * Two rule features need to know something about *who* the resume belongs to,
 * not just what it contains:
 *
 *   - `summaryExpected` and `sectionOrderScore` (Structure) depend on seniority:
 *     an entry-level candidate is not penalised for omitting a summary, and the
 *     conventional section order differs (education leads for a fresher).
 *   - `optionalPresent` (Contact) counts a GitHub link only for engineering
 *     resumes (docs/MEASUREMENT.md §3.7) — a GitHub profile is a portfolio signal
 *     for a developer and noise for an operations analyst.
 *
 * Both are inferred once, here, so the two extractors cannot disagree about it.
 *
 * Determinism note: seniority is derived from title keywords and the span between
 * *concrete* dates only. It never reads the current date — a resume must score
 * identically today and next year, and "months of experience up to now" would
 * quietly break that (docs/MEASUREMENT.md §6: rule features show σ = 0 exactly).
 */
import { endpointOrdinal } from "./dates";
import type { AnalysisInput } from "./input";
import { segmentEntries, type ExperienceEntry } from "./segment";
import { findSection } from "@/lib/parser/sections";

export type Seniority = "entry" | "mid" | "senior" | "executive";

export interface ResumeProfile {
  readonly seniority: Seniority;
  readonly isEngineering: boolean;
  /** Experience entries, parsed once and reused by Structure. */
  readonly experienceEntries: readonly ExperienceEntry[];
  /** Whether a populated Experience section exists at all. */
  readonly hasExperienceSection: boolean;
}

const EXECUTIVE_TITLE =
  /\b(chief|c[te]o|coo|cio|ciso|vp|vice president|president|head of|director|partner)\b/i;
const SENIOR_TITLE = /\b(senior|lead|principal|staff|manager|architect)\b/i;
const ENTRY_TITLE = /\b(intern|internship|graduate|trainee|junior|apprentice|placement)\b/i;

const ENGINEERING_SIGNAL =
  /\b(developer|engineer(?:ing)?|programmer|software|full[- ]?stack|front[- ]?end|back[- ]?end|devops|sre|data scientist|web developer)\b/i;

/** Months between the earliest and latest concrete (non-"Present") endpoint. */
function experienceSpanMonths(entries: readonly ExperienceEntry[]): number {
  const ordinals: number[] = [];
  for (const entry of entries) {
    const range = entry.dateRange;
    if (range === null) continue;
    ordinals.push(endpointOrdinal(range.start));
    if (range.end !== null) ordinals.push(endpointOrdinal(range.end));
  }
  if (ordinals.length < 2) return 0;
  return Math.max(...ordinals) - Math.min(...ordinals);
}

function inferSeniority(
  entries: readonly ExperienceEntry[],
  hasExperienceSection: boolean,
): Seniority {
  const titles = entries.map((entry) => entry.headerLines[0] ?? "").join(" | ");

  if (EXECUTIVE_TITLE.test(titles)) return "executive";

  // A resume whose only work history is internships/placements — or which has no
  // Experience section at all, leaning on projects and education — reads as entry
  // level regardless of how the bullets are written.
  const everyEntryIsEntry =
    entries.length > 0 && entries.every((entry) => ENTRY_TITLE.test(entry.headerLines[0] ?? ""));
  if (!hasExperienceSection || everyEntryIsEntry) return "entry";

  const span = experienceSpanMonths(entries);
  if (SENIOR_TITLE.test(titles) || span >= 72) return "senior";
  if (span < 18 && entries.length <= 1) return "entry";
  return "mid";
}

export function inferProfile(input: AnalysisInput): ResumeProfile {
  const experienceSection = findSection(input.sections, "experience");
  const hasExperienceSection =
    experienceSection !== undefined && experienceSection.lines.length > 0;

  const experienceEntries = experienceSection ? segmentEntries(experienceSection.lines) : [];

  // A role or skill word anywhere in the document. Engineering resumes carry one
  // in a title ("Frontend Developer") or the skills block; an operations or
  // teaching resume does not, which is what keeps a GitHub link from counting for
  // them (docs/MEASUREMENT.md §3.7).
  const isEngineering = ENGINEERING_SIGNAL.test(input.text);

  return {
    seniority: inferSeniority(experienceEntries, hasExperienceSection),
    isEngineering,
    experienceEntries,
    hasExperienceSection,
  };
}
