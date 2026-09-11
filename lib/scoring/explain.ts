/**
 * Deterministic score explanations (spec section 27).
 *
 * Every reason is generated from the feature values by code. No model is
 * involved, for three reasons: the UI must answer "why is my score 72?" without
 * a second model call; the same feature vector must always produce the same
 * words; and a generated sentence cannot contradict the number it explains if it
 * is derived from the same source.
 */
import type { FeatureVector, ScoreCategory } from "@/types/scoring";

const pct = (value: number): string => `${Math.round(value * 100)}%`;

function parseabilityReason(f: FeatureVector["parseability"]): string {
  if (f.isImageOnly) {
    return "Almost no machine-readable text could be extracted. The document appears to be an image or scan, which means most automated systems will read it as effectively empty.";
  }

  const problems: string[] = [];
  if (f.readingOrderCoherence < 0.8) {
    problems.push("reading order breaks up in places, so some lines are recovered out of sequence");
  }
  if (f.sectionsDetectedRatio < 1) {
    problems.push("not every standard section was detectable");
  }
  if (f.glyphAnomalyRatio > 0.01) {
    problems.push("some characters did not survive extraction cleanly");
  }
  if (f.repeatedLineRatio > 0.05) {
    problems.push("several lines were extracted more than once");
  }

  if (problems.length === 0) {
    return "Text extracted cleanly and every standard section was detected. Automated systems should read this document accurately.";
  }
  return `Text extracted, but ${problems.join("; ")}.`;
}

function structureReason(f: FeatureVector["structure"]): string {
  const missing: string[] = [];
  if (!f.hasExperience) missing.push("Experience");
  if (!f.hasSkills) missing.push("Skills");
  if (!f.hasEducation) missing.push("Education");
  if (f.summaryExpected && !f.hasSummary) missing.push("Summary");

  const notes: string[] = [];
  if (missing.length > 0) notes.push(`no ${missing.join(" or ")} section was detected`);
  if (!f.chronologyConsistent) notes.push("roles are not in reverse-chronological order");
  if (f.datedEntryRatio < 1) {
    notes.push(`${pct(1 - f.datedEntryRatio)} of roles are missing a parseable date range`);
  }

  if (notes.length === 0) {
    return "All expected sections are present, ordered conventionally, and every role carries a date range.";
  }
  return `Sections are largely in place, but ${notes.join(", and ")}.`;
}

function skillsReason(f: FeatureVector["skills"]): string {
  const weakShare = 1 - f.strongEvidenceRatio;
  const notes: string[] = [];

  if (weakShare > 0.2) {
    notes.push(
      `${pct(weakShare)} of listed skills appear only in the Skills section and are not demonstrated anywhere in experience`,
    );
  }
  if (f.keywordRepetitionIndex > 0.06) {
    notes.push("some terms are repeated more often than natural writing would explain");
  }
  if (!f.skillGroupingPresent && f.totalSkills > 8) {
    notes.push("skills are presented as a flat list rather than grouped");
  }
  if (f.canonicalizedRatio < 0.8) {
    notes.push("several skill names are non-standard variants");
  }

  if (notes.length === 0) {
    return "Skills are well organised, use standard names, and are demonstrated in experience rather than only listed.";
  }
  return `${notes[0]!.charAt(0).toUpperCase()}${notes[0]!.slice(1)}${notes.length > 1 ? `. Also, ${notes.slice(1).join(", and ")}` : ""}.`;
}

function experienceReason(f: FeatureVector["experience"]): string {
  const notes: string[] = [];
  if (f.bulletCompletenessRatio < 0.85) {
    notes.push(
      "several bullets state a responsibility without saying what it was for or what came of it",
    );
  }
  if (f.bulletsInLengthBand < 0.8) {
    notes.push("some bullets are noticeably shorter or longer than is comfortable to scan");
  }
  if (f.firstPersonRatio > 0.1) {
    notes.push("some bullets use first-person phrasing, which is unconventional on a resume");
  }
  if (f.bulletsPerRoleMedian < 3) {
    notes.push("roles carry few bullets, leaving limited room to show scope");
  }

  if (notes.length === 0) {
    return "Bullets are consistently action-led, specific about technology and context, and state what the work produced.";
  }
  return `Experience is described clearly overall, but ${notes.join(", and ")}.`;
}

function impactReason(f: FeatureVector["impact"]): string {
  const unquantified = 1 - f.quantifiedBulletRatio;
  const notes: string[] = [];

  if (unquantified > 0.3) {
    notes.push(`${pct(unquantified)} of bullets contain no measurable outcome`);
  }
  if (f.genuineOutcomeRatio < 0.8 && f.quantifiedBulletRatio > 0) {
    notes.push(
      "some of the numbers present describe scope, such as team size, rather than a result the work produced",
    );
  }
  if (!f.metricsInRecentRole) {
    notes.push("the most recent role carries no quantified outcome, which is where it matters most");
  }
  if (f.distinctMetricTypes < 2 && f.quantifiedBulletRatio > 0) {
    notes.push("the outcomes shown are all of a similar kind");
  }

  if (notes.length === 0) {
    return "Outcomes are quantified consistently and across several different kinds of measure.";
  }
  return `${notes[0]!.charAt(0).toUpperCase()}${notes[0]!.slice(1)}${notes.length > 1 ? `, and ${notes.slice(1).join(", and ")}` : ""}. Add measures only where you can substantiate them.`;
}

function formattingReason(f: FeatureVector["formatting"]): string {
  const notes: string[] = [];
  if (f.dateFormatVariants > 1) {
    notes.push(`${f.dateFormatVariants} different date formats are used`);
  }
  if (f.punctuationConsistency < 0.9) notes.push("bullet punctuation is inconsistent");
  if (f.headingCaseConsistency < 0.9) notes.push("heading capitalisation varies");
  if (f.unusualGlyphRatio > 0.02) notes.push("some unusual symbols appear in the text");
  if (f.lineLengthOutlierRatio > 0.15) notes.push("line lengths vary widely enough to affect scanning");

  if (notes.length === 0) {
    return "Dates, punctuation and headings follow a single consistent convention throughout.";
  }
  return `Presentation is mostly consistent, but ${notes.join(", ")}.`;
}

function contactReason(f: FeatureVector["contact"]): string {
  const missing: string[] = [];
  if (!f.hasName) missing.push("name");
  if (!f.hasEmail) missing.push("email address");
  if (!f.hasPhone) missing.push("phone number");

  if (missing.length > 0) {
    return `Could not detect a ${missing.join(" or ")}. If these are present in the document, they are not being extracted reliably, which is itself worth fixing.`;
  }
  if (f.optionalPresent === 0) {
    return "Core contact details are present. Adding a location or a professional profile link would give a reader more to work with.";
  }
  return "Contact details are complete and extract cleanly.";
}

const REASON_BUILDERS: {
  readonly [K in ScoreCategory]: (features: FeatureVector[K]) => string;
} = {
  parseability: parseabilityReason,
  structure: structureReason,
  skills: skillsReason,
  experience: experienceReason,
  impact: impactReason,
  formatting: formattingReason,
  contact: contactReason,
};

export function explainCategory(category: ScoreCategory, features: FeatureVector): string {
  switch (category) {
    case "parseability":
      return REASON_BUILDERS.parseability(features.parseability);
    case "structure":
      return REASON_BUILDERS.structure(features.structure);
    case "skills":
      return REASON_BUILDERS.skills(features.skills);
    case "experience":
      return REASON_BUILDERS.experience(features.experience);
    case "impact":
      return REASON_BUILDERS.impact(features.impact);
    case "formatting":
      return REASON_BUILDERS.formatting(features.formatting);
    case "contact":
      return REASON_BUILDERS.contact(features.contact);
  }
}
