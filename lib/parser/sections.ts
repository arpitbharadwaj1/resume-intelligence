/**
 * Section detection.
 *
 * Spec section 89 is explicit that this must be flexible rather than
 * keyword-exact: real resumes label the same section "Experience",
 * "Professional Experience", "Work History", "Career Summary" or "Employment",
 * and a parser that only recognises one of those reports a missing section that
 * is plainly present -- which then shows up as a structure penalty the candidate
 * cannot act on.
 *
 * Detection is therefore two-stage: decide whether a line *looks* like a heading
 * at all, then match it loosely against the known section vocabularies.
 */

export const SECTION_KINDS = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "awards",
  "publications",
  "languages",
  "interests",
  "other",
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

/** The four sections Parseability treats as "core" when scoring detection. */
export const CORE_SECTIONS: readonly SectionKind[] = ["experience", "education", "skills", "contact"];

/**
 * Vocabularies, matched as substrings of a normalised heading. Order matters:
 * the first kind whose vocabulary matches wins, so more specific vocabularies
 * come first ("technical skills" must not be claimed by "technical").
 */
const SECTION_VOCABULARY: ReadonlyArray<readonly [SectionKind, readonly string[]]> = [
  [
    "summary",
    ["summary", "profile", "objective", "about me", "overview", "professional statement", "career goal"],
  ],
  [
    "experience",
    [
      "experience",
      "employment",
      "work history",
      "career history",
      "professional background",
      "positions held",
      "career",
    ],
  ],
  ["education", ["education", "academic", "qualification", "degree", "schooling", "training"]],
  [
    "skills",
    ["skill", "technical proficien", "technologies", "tech stack", "competenc", "expertise", "toolkit"],
  ],
  ["projects", ["project", "portfolio", "selected work", "case stud"]],
  ["certifications", ["certification", "certificate", "licence", "license", "accreditation"]],
  ["awards", ["award", "honor", "honour", "achievement", "recognition"]],
  ["publications", ["publication", "paper", "patent", "talk", "conference"]],
  ["languages", ["language"]],
  ["interests", ["interest", "hobb", "volunteer", "activities", "extracurricular"]],
  ["contact", ["contact", "personal details", "personal information"]],
];

export interface DetectedSection {
  readonly kind: SectionKind;
  readonly heading: string;
  /** Index into the line array where the heading appeared. */
  readonly lineIndex: number;
  /** Lines belonging to this section, excluding the heading itself. */
  readonly lines: readonly string[];
}

/**
 * Whether a line plausibly is a heading, independent of what it says.
 *
 * Headings are short, are not sentences, and are not bullets. Checking shape
 * before vocabulary is what stops a bullet that happens to contain the word
 * "experience" from being read as a section break.
 */
export function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;

  // Bullets are content, never headings.
  if (/^[•\-*]\s+/.test(trimmed)) return false;

  // Sentences are content. A trailing period is the giveaway; a trailing colon
  // is common on headings, so it is allowed.
  if (/[.!?]$/.test(trimmed)) return false;

  // Contact lines carry an email, a phone number or a URL.
  if (/@|https?:\/\/|\d{3}[\s.-]?\d{3}/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length > 5) return false;

  const withoutPunctuation = trimmed.replace(/[:\-–—]/g, "").trim();
  if (withoutPunctuation.length === 0) return false;

  // All caps, or Title Case, or a short line ending in a colon.
  const isUpper = withoutPunctuation === withoutPunctuation.toUpperCase();
  const isTitleCase = words.every((word) => /^[^a-z]/.test(word) || word.length <= 3);
  const endsWithColon = trimmed.endsWith(":");

  return isUpper || isTitleCase || endsWithColon;
}

/** Match a heading against the vocabularies. Returns null if nothing matches. */
export function classifyHeading(heading: string): SectionKind | null {
  const normalized = heading
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) return null;

  for (const [kind, vocabulary] of SECTION_VOCABULARY) {
    for (const term of vocabulary) {
      if (normalized.includes(term)) return kind;
    }
  }
  return null;
}

/**
 * Split lines into sections.
 *
 * Lines before the first recognised heading become an implicit contact block --
 * which is where the name, email and phone almost always live, whether or not
 * the document labels them.
 */
export function detectSections(lines: readonly string[]): readonly DetectedSection[] {
  interface OpenSection {
    kind: SectionKind;
    heading: string;
    lineIndex: number;
    lines: string[];
  }

  const sections: DetectedSection[] = [];
  const preamble: string[] = [];
  let open: OpenSection | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;

    const kind = looksLikeHeading(line) ? classifyHeading(line) : null;

    if (kind !== null) {
      if (open !== undefined) sections.push(open);
      open = { kind, heading: line.trim(), lineIndex: index, lines: [] };
      continue;
    }

    if (open === undefined) preamble.push(line);
    else open.lines.push(line);
  }

  if (open !== undefined) sections.push(open);

  // The unlabelled block at the top of a resume is the contact block in
  // practice, whether or not the document gives it a heading.
  if (preamble.length > 0 && !sections.some((section) => section.kind === "contact")) {
    sections.unshift({ kind: "contact", heading: "", lineIndex: 0, lines: preamble });
  }

  return sections;
}

/** Which core sections were found. */
export function detectedCoreSections(
  sections: readonly DetectedSection[],
): ReadonlySet<SectionKind> {
  const found = new Set<SectionKind>();
  for (const section of sections) {
    if (CORE_SECTIONS.includes(section.kind) && section.lines.length > 0) found.add(section.kind);
  }
  return found;
}

/** The first section of a given kind, if present. */
export function findSection(
  sections: readonly DetectedSection[],
  kind: SectionKind,
): DetectedSection | undefined {
  return sections.find((section) => section.kind === kind);
}
