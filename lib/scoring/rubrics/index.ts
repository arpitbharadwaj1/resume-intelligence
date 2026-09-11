import type { FeatureVector, ScoreCategory } from "@/types/scoring";

import { scoreContact } from "./contact";
import { scoreExperience } from "./experience";
import { scoreFormatting } from "./formatting";
import { scoreImpact } from "./impact";
import { scoreParseability } from "./parseability";
import { scoreSkills } from "./skills";
import { scoreStructure } from "./structure";

export { scoreContact, scoreExperience, scoreFormatting, scoreImpact };
export { scoreParseability, scoreSkills, scoreStructure };
export { clamp } from "./utils";

/**
 * Every rubric, keyed by category. Typed so that adding a category to
 * ScoreCategory without adding its rubric is a compile error rather than a
 * silently missing score.
 */
export const RUBRICS: {
  readonly [K in ScoreCategory]: (features: FeatureVector[K]) => number;
} = {
  parseability: scoreParseability,
  structure: scoreStructure,
  skills: scoreSkills,
  experience: scoreExperience,
  impact: scoreImpact,
  formatting: scoreFormatting,
  contact: scoreContact,
};
