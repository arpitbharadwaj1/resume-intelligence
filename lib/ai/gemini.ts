/**
 * Gemini-backed ResumeClassifier (ADR-009).
 *
 * Implements the ResumeClassifier interface from lib/analysis/classifier.ts using
 * Google Gemini Flash 2.0 — free tier, structured JSON output, no billing required
 * for a personal project.
 *
 * Each of the three call types is one batched request returning an array of
 * per-item verdicts (MEASUREMENT.md §5). The model never returns a score or a
 * rating; it answers only "yes / no / unclear" or "outcome / scope / unclear"
 * per item. A successful prompt injection can at most corrupt one verdict — it
 * cannot move a category score.
 *
 * Verdicts that fail Zod validation are dropped (never defaulted to zero), which
 * is what keeps a bad response from silently penalising a bullet (§5: "a verdict
 * without [an evidence ID] is dropped, not defaulted").
 *
 * Safe logging: the log lines emitted here carry model, latency, and token counts
 * only — never the resume text or the prompt content (AI.md §1, §46).
 */
import { GoogleGenerativeAI, SchemaType, type GenerationConfig, type Schema } from "@google/generative-ai";
import { z } from "zod";

import type {
  ClassifiableBullet,
  ClassifiableSkillBullet,
  ExperienceVerdict,
  OutcomeClassification,
  ResumeClassifier,
  SkillEvidenceVerdict,
} from "@/lib/analysis/classifier";

import {
  EXPERIENCE_CLASSIFICATION_PROMPT,
  OUTCOME_CLASSIFICATION_PROMPT,
  PROMPT_VERSION,
  SKILL_EVIDENCE_PROMPT,
  SYSTEM_CONTEXT,
} from "./prompts";

const MODEL_ID = "gemini-2.0-flash";

// ---------------------------------------------------------------------------
// Zod schemas — validate every model response before the callers see it
// ---------------------------------------------------------------------------

const Ternary = z.enum(["yes", "no", "unclear"]);
const OutcomeVerdict = z.enum(["outcome", "scope", "unclear"]);

const ExperienceVerdictSchema = z.array(
  z.object({
    evidenceId: z.string(),
    statesContext: Ternary,
    statesOutcome: Ternary,
  }),
);

const OutcomeVerdictSchema = z.array(
  z.object({
    evidenceId: z.string(),
    verdict: OutcomeVerdict,
  }),
);

const SkillEvidenceSchema = z.array(
  z.object({
    skill: z.string(),
    evidenceId: z.string(),
    demonstratesSkill: Ternary,
  }),
);

// ---------------------------------------------------------------------------
// Shared generation config — structured JSON output, low temperature
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Typed response schemas
// ---------------------------------------------------------------------------

const TERNARY_ENUM: Schema = { type: SchemaType.STRING, format: "enum", enum: ["yes", "no", "unclear"] };
const OUTCOME_ENUM: Schema = { type: SchemaType.STRING, format: "enum", enum: ["outcome", "scope", "unclear"] };

const EXPERIENCE_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      evidenceId: { type: SchemaType.STRING },
      statesContext: TERNARY_ENUM,
      statesOutcome: TERNARY_ENUM,
    },
    required: ["evidenceId", "statesContext", "statesOutcome"],
  },
};

const OUTCOME_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      evidenceId: { type: SchemaType.STRING },
      verdict: OUTCOME_ENUM,
    },
    required: ["evidenceId", "verdict"],
  },
};

const SKILL_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      skill: { type: SchemaType.STRING },
      evidenceId: { type: SchemaType.STRING },
      demonstratesSkill: TERNARY_ENUM,
    },
    required: ["skill", "evidenceId", "demonstratesSkill"],
  },
};

function jsonConfig(schema: Schema): GenerationConfig {
  return {
    temperature: 0,
    responseMimeType: "application/json",
    responseSchema: schema,
  };
}

// ---------------------------------------------------------------------------
// Bullet serialisation — untrusted text inside delimited blocks (AI.md §5)
// ---------------------------------------------------------------------------

function serializeBulletsForExperience(bullets: readonly ClassifiableBullet[]): string {
  return bullets
    .map((b) => `<bullet id="${b.evidenceId}">${b.text}</bullet>`)
    .join("\n");
}

function serializeBulletsForOutcome(bullets: readonly ClassifiableBullet[]): string {
  return bullets
    .map((b) => `<bullet id="${b.evidenceId}">${b.text}</bullet>`)
    .join("\n");
}

function serializePairsForSkills(pairs: readonly ClassifiableSkillBullet[]): string {
  return pairs
    .map((p) => `<pair skill="${p.skill}" id="${p.evidenceId}">${p.text}</pair>`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// GeminiClassifier
// ---------------------------------------------------------------------------

export interface GeminiClassifierOptions {
  /** Gemini API key from Google AI Studio. Falls back to GEMINI_API_KEY env var. */
  readonly apiKey?: string;
  /** Override the model ID — useful for testing with a specific version. */
  readonly modelId?: string;
}

export class GeminiClassifier implements ResumeClassifier {
  private readonly client: GoogleGenerativeAI;
  private readonly modelId: string;

  constructor(options: GeminiClassifierOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey",
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelId = options.modelId ?? MODEL_ID;
  }

  async classifyExperienceBullets(
    bullets: readonly ClassifiableBullet[],
  ): Promise<readonly ExperienceVerdict[]> {
    if (bullets.length === 0) return [];

    const model = this.client.getGenerativeModel({
      model: this.modelId,
      systemInstruction: SYSTEM_CONTEXT,
      generationConfig: jsonConfig(EXPERIENCE_SCHEMA),
    });

    const userMessage = [
      EXPERIENCE_CLASSIFICATION_PROMPT,
      "",
      serializeBulletsForExperience(bullets),
      "",
      `Return one JSON object per bullet, in the same order. prompt_version: ${PROMPT_VERSION}`,
    ].join("\n");

    const response = await model.generateContent(userMessage);
    const raw = response.response.text();
    const parsed = ExperienceVerdictSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) return [];
    return parsed.data;
  }

  async classifyQuantifiedOutcomes(
    bullets: readonly ClassifiableBullet[],
  ): Promise<readonly OutcomeClassification[]> {
    if (bullets.length === 0) return [];

    const model = this.client.getGenerativeModel({
      model: this.modelId,
      systemInstruction: SYSTEM_CONTEXT,
      generationConfig: jsonConfig(OUTCOME_SCHEMA),
    });

    const userMessage = [
      OUTCOME_CLASSIFICATION_PROMPT,
      "",
      serializeBulletsForOutcome(bullets),
      "",
      `Return one JSON object per bullet, in the same order. prompt_version: ${PROMPT_VERSION}`,
    ].join("\n");

    const response = await model.generateContent(userMessage);
    const raw = response.response.text();
    const parsed = OutcomeVerdictSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) return [];
    return parsed.data;
  }

  async classifySkillEvidence(
    pairs: readonly ClassifiableSkillBullet[],
  ): Promise<readonly SkillEvidenceVerdict[]> {
    if (pairs.length === 0) return [];

    const model = this.client.getGenerativeModel({
      model: this.modelId,
      systemInstruction: SYSTEM_CONTEXT,
      generationConfig: jsonConfig(SKILL_SCHEMA),
    });

    const userMessage = [
      SKILL_EVIDENCE_PROMPT,
      "",
      serializePairsForSkills(pairs),
      "",
      `Return one JSON object per pair, in the same order. prompt_version: ${PROMPT_VERSION}`,
    ].join("\n");

    const response = await model.generateContent(userMessage);
    const raw = response.response.text();
    const parsed = SkillEvidenceSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) return [];
    return parsed.data;
  }
}

/**
 * A singleton factory for server-side use. Call once at module load; the client
 * is stateless and safe to share across requests.
 */
let _classifier: GeminiClassifier | undefined;

export function getClassifier(): GeminiClassifier {
  _classifier ??= new GeminiClassifier();
  return _classifier;
}
