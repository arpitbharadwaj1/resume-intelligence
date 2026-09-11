import type {
  ClassifiableBullet,
  ClassifiableSkillBullet,
  ExperienceVerdict,
  OutcomeClassification,
  OutcomeVerdict,
  ResumeClassifier,
  SkillEvidenceVerdict,
  Ternary,
} from "@/lib/analysis";

interface FakeConfig {
  /** Per-bullet-ID context/outcome verdicts; unspecified bullets default to `no`. */
  readonly context?: Record<string, Ternary>;
  readonly outcome?: Record<string, Ternary>;
  /** Uniform verdict for every experience bullet, overridden by the maps above. */
  readonly everyBullet?: { context: Ternary; outcome: Ternary };
  /** Per-quantified-bullet-ID outcome verdicts; unspecified default to `scope`. */
  readonly quantifiedOutcome?: Record<string, OutcomeVerdict>;
  /** Decides skill evidence for a (skill, bullet) pair; default `no`. */
  readonly skillEvidence?: (skill: string, evidenceId: string, text: string) => Ternary;
}

/**
 * A deterministic stand-in for the bounded LLM. Every verdict it returns is one
 * the test dictated, so the seam can be exercised end to end with no key and no
 * network — and a scoring test stays reproducible (docs/MEASUREMENT.md §6).
 */
export function fakeClassifier(config: FakeConfig = {}): ResumeClassifier {
  return {
    classifyExperienceBullets(
      bullets: readonly ClassifiableBullet[],
    ): Promise<readonly ExperienceVerdict[]> {
      return Promise.resolve(
        bullets.map((bullet) => ({
          evidenceId: bullet.evidenceId,
          statesContext:
            config.context?.[bullet.evidenceId] ?? config.everyBullet?.context ?? "no",
          statesOutcome:
            config.outcome?.[bullet.evidenceId] ?? config.everyBullet?.outcome ?? "no",
        })),
      );
    },
    classifyQuantifiedOutcomes(
      bullets: readonly ClassifiableBullet[],
    ): Promise<readonly OutcomeClassification[]> {
      return Promise.resolve(
        bullets.map((bullet) => ({
          evidenceId: bullet.evidenceId,
          verdict: config.quantifiedOutcome?.[bullet.evidenceId] ?? "scope",
        })),
      );
    },
    classifySkillEvidence(
      pairs: readonly ClassifiableSkillBullet[],
    ): Promise<readonly SkillEvidenceVerdict[]> {
      return Promise.resolve(
        pairs.map((pair) => ({
          skill: pair.skill,
          evidenceId: pair.evidenceId,
          demonstratesSkill:
            config.skillEvidence?.(pair.skill, pair.evidenceId, pair.text) ?? "no",
        })),
      );
    },
  };
}
