import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildAnalysisInput, type AnalysisInput } from "@/lib/analysis";

/** Read a synthetic resume fixture as a parser would emit its text. */
export function loadResume(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../fixtures/resumes/${name}`, import.meta.url)),
    "utf8",
  );
}

/** Build the shared analysis input for a fixture. Page count is immaterial to the
 * rule categories tested here, so 1 is fine. */
export function inputFor(name: string): AnalysisInput {
  return buildAnalysisInput(loadResume(name), 1);
}
