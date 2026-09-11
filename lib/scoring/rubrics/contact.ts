/**
 * Contact rubric -- weight 5, entirely rule-derived.
 *
 * Anchors (docs/MEASUREMENT.md section 4.7):
 *   name, email, phone, >= 2 optional   1.00
 *   name and email only                 0.75
 *   no name extracted                   <= 0.60
 *
 * Optional fields are capped at two so that a candidate with a LinkedIn and a
 * location is not penalised against one who also lists GitHub. Absent optional
 * fields are never universally penalised (spec section 18) -- and GitHub is
 * counted into `optionalPresent` only for engineering roles, upstream of here.
 */
import type { ContactFeatures } from "@/types/scoring";

import { b, clamp, finalize } from "./utils";

/** Number of optional fields at which optional credit is full. */
const OPTIONAL_TARGET = 2;

export function scoreContact(f: ContactFeatures): number {
  return finalize(
    0.4 * b(f.hasName) +
      0.35 * b(f.hasEmail) +
      0.15 * b(f.hasPhone) +
      0.1 * clamp(f.optionalPresent / OPTIONAL_TARGET),
  );
}
