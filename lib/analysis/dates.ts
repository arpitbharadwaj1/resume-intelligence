/**
 * Date-range parsing for the analysis layer.
 *
 * Two categories depend on reading dates out of resume text, and they must read
 * them the same way or the score contradicts itself:
 *
 *   - Structure needs each experience entry's *start* date, to decide whether the
 *     entry is dated at all (`datedEntryRatio`) and whether the entries run in
 *     non-increasing order (`chronologyConsistent`).
 *   - Formatting needs the *format* each date is written in, to count how many
 *     distinct conventions the document mixes (`dateFormatVariants`).
 *
 * Both come from one parser here rather than a regex in each extractor, so a date
 * the two disagree about cannot exist (CLAUDE.md §4 — no duplicated business
 * logic).
 *
 * What this is deliberately not: a general date library. It recognises the
 * handful of forms resumes actually use for employment ranges, and treats
 * anything else as "not a date range" rather than guessing.
 */

/** The date-writing conventions a resume realistically mixes. */
export type DateFormatSignature =
  | "month-name-year" // Jan 2022, September 2018
  | "numeric-month-year" // 03/2020
  | "numeric-dmy" // 03/04/2021
  | "year-only"; // 2020

const MONTH_INDEX: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_NAMES = Object.keys(MONTH_INDEX).join("|");

/**
 * One end of a range, resolved to a comparable point in time.
 * `month` is null for a year-only endpoint, which we treat as mid-year when
 * ordering so a bare "2020" does not sort before "Jan 2020".
 */
export interface DateEndpoint {
  readonly year: number;
  readonly month: number | null;
  readonly signature: DateFormatSignature;
}

export interface DateRange {
  /** The earlier-written endpoint — the one an entry is anchored to. */
  readonly start: DateEndpoint;
  /** Null when the range ends in "Present"/"Current", which has no format. */
  readonly end: DateEndpoint | null;
  /** Distinct format signatures the concrete endpoints are written in. */
  readonly signatures: readonly DateFormatSignature[];
}

// A single endpoint. Order inside the alternation matters: the month-name form
// is tried before the numeric ones, and the two-slash D/M/Y form before the
// one-slash M/Y form, so "03/2020" is never mis-read as a day-month fragment.
const ENDPOINT_SOURCE =
  `(?:${MONTH_NAMES})[a-z]*\\.?\\s+(?:19|20)\\d{2}` + // Jan 2022
  `|\\d{1,2}/\\d{1,2}/\\d{2,4}` + // 03/04/2021
  `|\\d{1,2}/(?:19|20)\\d{2}` + // 03/2020
  `|(?:19|20)\\d{2}`; // 2020

const ENDPOINT_RE_GLOBAL = new RegExp(ENDPOINT_SOURCE, "gi");

const RANGE_SEPARATOR = `\\s*(?:[-\\u2013\\u2014]|to)\\s*`;
const PRESENT = `present|current|now|ongoing|date`;

// A range is an endpoint, a separator, then either another endpoint or a
// "present" token. Anchored so we read the *start* endpoint, not a stray year
// that happens to sit later on the line (a metric such as "2020 users").
const RANGE_RE = new RegExp(
  `(${ENDPOINT_SOURCE})${RANGE_SEPARATOR}((?:${ENDPOINT_SOURCE})|${PRESENT})`,
  "i",
);

function classifyEndpoint(raw: string): DateEndpoint | null {
  const token = raw.trim().toLowerCase();

  const monthName = new RegExp(`^(${MONTH_NAMES})[a-z]*\\.?\\s+((?:19|20)\\d{2})$`, "i").exec(token);
  if (monthName) {
    // The alternation captures the three-letter stem ("sep" even for
    // "September"), so the first three characters always key the month.
    const month = MONTH_INDEX[monthName[1]!.slice(0, 3)] ?? null;
    return { year: Number(monthName[2]), month, signature: "month-name-year" };
  }

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(token);
  if (dmy) {
    const rawYear = Number(dmy[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return { year, month: Number(dmy[2]), signature: "numeric-dmy" };
  }

  const monthYear = /^(\d{1,2})\/((?:19|20)\d{2})$/.exec(token);
  if (monthYear) {
    return { year: Number(monthYear[2]), month: Number(monthYear[1]), signature: "numeric-month-year" };
  }

  const yearOnly = /^(19|20)\d{2}$/.exec(token);
  if (yearOnly) {
    return { year: Number(token), month: null, signature: "year-only" };
  }

  return null;
}

/**
 * Parse an employment date range from a line, or null if the line does not carry
 * one. Only a genuine range (two endpoints, or an endpoint through "Present")
 * counts — a lone year is left alone, because on a resume it is far more often a
 * graduation year or a metric than an employment span.
 */
export function parseDateRange(line: string): DateRange | null {
  const match = RANGE_RE.exec(line);
  if (!match) return null;

  const start = classifyEndpoint(match[1]!);
  if (start === null) return null;

  const endRaw = match[2]!;
  const end = new RegExp(`^(?:${PRESENT})$`, "i").test(endRaw.trim())
    ? null
    : classifyEndpoint(endRaw);

  const signatures = [start.signature, ...(end ? [end.signature] : [])].filter(
    (sig, index, all) => all.indexOf(sig) === index,
  );

  return { start, end, signatures };
}

/** Whether a line contains an employment date range at all. */
export function hasDateRange(line: string): boolean {
  return parseDateRange(line) !== null;
}

/**
 * Every date-format signature used anywhere in a block of lines.
 *
 * This counts each *endpoint's* format, not each line's, because a document that
 * writes "Jan 2022 - 03/2024" has genuinely mixed two conventions in a single
 * range and should be scored as inconsistent.
 */
export function collectDateFormats(lines: readonly string[]): ReadonlySet<DateFormatSignature> {
  const found = new Set<DateFormatSignature>();
  for (const line of lines) {
    // A line is only date-format evidence if it actually parses as a range;
    // this keeps stray four-digit numbers (counts, IDs) out of the tally.
    if (!hasDateRange(line)) continue;
    for (const token of line.match(ENDPOINT_RE_GLOBAL) ?? []) {
      const endpoint = classifyEndpoint(token);
      if (endpoint) found.add(endpoint.signature);
    }
  }
  return found;
}

/** A single comparable ordinal for an endpoint: months since year 0, mid-year for year-only. */
export function endpointOrdinal(endpoint: DateEndpoint): number {
  return endpoint.year * 12 + (endpoint.month ?? 6);
}
