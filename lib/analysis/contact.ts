/**
 * Contact feature extraction — weight 5, entirely rule-derived
 * (docs/MEASUREMENT.md §3.7).
 *
 * The contact block is the unlabelled run of lines at the top of almost every
 * resume; section detection already hands it back as an implicit `contact`
 * section. Name, email and phone are the load-bearing fields — an email that did
 * not extract is usually a parse failure, not a candidate who omitted their
 * address, which is why the anchor for "no name extracted" is capped low rather
 * than zeroed.
 *
 * `optionalPresent` counts location, LinkedIn and GitHub — but GitHub only for
 * engineering resumes, so a portfolio link is credited where it is a signal and
 * ignored where it is not. Absent optional fields are never universally
 * penalised (§18).
 */
import { findSection } from "@/lib/parser/sections";
import type { ContactFeatures } from "@/types/scoring";

import type { AnalysisInput } from "./input";
import { inferProfile, type ResumeProfile } from "./profile";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
// Nine digits minimum, so a year or a short code is not read as a phone number.
const PHONE = /(?=(?:\D*\d){9})\+?\d[\d\s().-]{7,}\d/;
// Two to four capitalised words on their own line, no digits, allowing internal
// capitals in a hyphenated surname ("Kaczmarek-Obiora").
const NAME = /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$/;
// "Melbourne, VIC" / "Perth, WA" — a place followed by a state or country code.
const LOCATION = /^[A-Z][A-Za-z.'’ -]+,\s*[A-Z]{2,3}$/;
const LINKEDIN = /linkedin\.com/i;
const GITHUB = /github\.com/i;

/** The lines that make up the contact block. */
function contactBlock(input: AnalysisInput): readonly string[] {
  const section = findSection(input.sections, "contact");
  if (section && section.lines.length > 0) return section.lines;
  // Fall back to the head of the document if detection produced no contact block
  // (e.g. a resume that opens straight into a heading).
  return input.lines.slice(0, 15);
}

export function extractContactFeatures(
  input: AnalysisInput,
  profile: ResumeProfile = inferProfile(input),
): ContactFeatures {
  const block = contactBlock(input);
  const joined = block.join("\n");

  const hasEmail = EMAIL.test(joined);
  const hasPhone = PHONE.test(joined);
  // A name is looked for only in the first few lines; further down, capitalised
  // two-word lines are employers and section headings, not the candidate.
  const hasName = block.slice(0, 5).some((line) => NAME.test(line.trim()));

  const hasLocation = block.some((line) => LOCATION.test(line.trim()));
  const hasLinkedin = LINKEDIN.test(joined);
  const hasGithub = profile.isEngineering && GITHUB.test(joined);

  const optionalPresent = [hasLocation, hasLinkedin, hasGithub].filter(Boolean).length;

  return { hasName, hasEmail, hasPhone, optionalPresent };
}
