/**
 * Experience-entry segmentation.
 *
 * Section detection (lib/parser/sections.ts) tells us *where* the Experience
 * section is; this tells us how it is divided into roles. An entry is a header
 * block — job title, employer, usually a date line — followed by its bullets. A
 * new entry begins when a non-bullet line appears after we have already seen
 * bullets, which is exactly the shape every reverse-chronological resume takes.
 *
 * Structure reads these to measure how many entries are dated and whether they
 * run newest-first; later phases will read the same entries for the Experience
 * and Impact features. One segmentation, several consumers.
 */
import { isBulletLine, stripBulletMarker } from "@/lib/parser/normalize";
import { looksLikeHeading } from "@/lib/parser/sections";

import { parseDateRange, type DateRange } from "./dates";

export interface ExperienceEntry {
  /** Non-bullet lines above the bullets: title, employer, location, dates. */
  readonly headerLines: readonly string[];
  /** Bullet text with the marker stripped. */
  readonly bullets: readonly string[];
  /** The date range parsed from the header, or null when the entry is undated. */
  readonly dateRange: DateRange | null;
}

interface MutableEntry {
  headerLines: string[];
  bullets: string[];
}

/**
 * Split a section's lines into entries.
 *
 * The subtlety is wrapped bullets: an extractor breaks a long bullet across
 * lines, so a non-bullet line after a bullet is usually a *continuation* of it,
 * not a new role. A new entry begins only when a non-bullet line after the
 * bullets is heading-shaped — the next job title. Consecutive non-bullet lines
 * before any bullet are the one header block they visually are.
 */
export function segmentEntries(lines: readonly string[]): readonly ExperienceEntry[] {
  const entries: MutableEntry[] = [];
  let current: MutableEntry | null = null;

  const startEntry = (): MutableEntry => {
    const entry: MutableEntry = { headerLines: [], bullets: [] };
    entries.push(entry);
    return entry;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (isBulletLine(line)) {
      if (current === null) current = startEntry();
      current.bullets.push(stripBulletMarker(line));
      continue;
    }

    if (current === null || current.bullets.length === 0) {
      // Still gathering the header block of the current (or first) entry.
      current = current ?? startEntry();
      current.headerLines.push(line);
      continue;
    }

    // A non-bullet line after bullets: a new role if it is heading-shaped,
    // otherwise the wrapped tail of the last bullet.
    if (looksLikeHeading(line)) {
      current = startEntry();
      current.headerLines.push(line);
    } else {
      const last = current.bullets.length - 1;
      current.bullets[last] = `${current.bullets[last]} ${line}`;
    }
  }

  return entries.map((entry) => ({
    headerLines: entry.headerLines,
    bullets: entry.bullets,
    dateRange: firstDateRange(entry.headerLines),
  }));
}

function firstDateRange(headerLines: readonly string[]): DateRange | null {
  for (const line of headerLines) {
    const range = parseDateRange(line);
    if (range !== null) return range;
  }
  return null;
}
