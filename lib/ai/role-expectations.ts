/**
 * Generates role expectations for a given job title via a bounded Gemini call.
 *
 * This is structured extraction, not scoring — the model lists what the role
 * typically requires; deterministic code in lib/scoring/role-readiness.ts then
 * compares those requirements against the resume. The model never returns a
 * numeric score (R2, MEASUREMENT.md).
 *
 * Safe logging: only model ID, latency, and token counts are logged — never
 * the resume text or any part of the role context string (AI.md §1).
 */
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";

import type { RoleContext, RoleExpectations } from "@/types/role";

const MODEL_ID = "gemini-2.0-flash";

// ---------------------------------------------------------------------------
// Zod schema — validates every model response before callers see it
// ---------------------------------------------------------------------------

const RoleExpectationsSchema = z.object({
  requiredSkills: z.array(z.string()).min(3).max(20),
  preferredSkills: z.array(z.string()).max(15),
  typicalResponsibilities: z.array(z.string()).min(3).max(15),
  seniorityRange: z.object({ min: z.number().int().nonnegative(), max: z.number().int().positive() }),
  keyTerminology: z.array(z.string()).min(3).max(30),
});

// ---------------------------------------------------------------------------
// Gemini response schema
// ---------------------------------------------------------------------------

const SENIORITY_RANGE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    min: { type: SchemaType.NUMBER },
    max: { type: SchemaType.NUMBER },
  },
  required: ["min", "max"],
};

const ROLE_EXPECTATIONS_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    requiredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    preferredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    typicalResponsibilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    seniorityRange: SENIORITY_RANGE_SCHEMA,
    keyTerminology: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["requiredSkills", "preferredSkills", "typicalResponsibilities", "seniorityRange", "keyTerminology"],
};

// ---------------------------------------------------------------------------
// Prompt — bounded extraction, no scoring
// ---------------------------------------------------------------------------

const SYSTEM = `You are a career taxonomy expert. Your task is to describe the typical requirements
of a given job role. You do NOT evaluate any person's resume or skills.
Answer strictly with the JSON schema provided.`;

function buildPrompt(context: RoleContext): string {
  const parts = [
    `Job title: ${context.jobTitle}`,
    `Experience level of the person: ${context.experienceYears} year(s)`,
  ];
  if (context.industry) parts.push(`Industry: ${context.industry}`);
  if (context.specialization) parts.push(`Specialization: ${context.specialization}`);

  return [
    "List the typical requirements for the following role.",
    "",
    ...parts,
    "",
    "Return:",
    "- requiredSkills: 8–15 role-specific technical and professional skills (be concrete, not generic)",
    "- preferredSkills: 5–10 additional nice-to-have skills",
    "- typicalResponsibilities: 8–12 short phrases describing typical duties",
    "- seniorityRange: { min, max } years of experience typically expected for this exact seniority",
    "- keyTerminology: 15–25 industry/role-specific terms a recruiter would look for",
    "",
    'Do not include generic soft skills like "communication" in requiredSkills unless they are genuinely role-critical.',
    "Focus on concrete, observable skills and terminology.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateRoleExpectations(
  context: RoleContext,
  apiKey: string,
): Promise<RoleExpectations> {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: SYSTEM,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: ROLE_EXPECTATIONS_RESPONSE_SCHEMA,
    },
  });

  const t0 = Date.now();
  const response = await model.generateContent(buildPrompt(context));
  const latency = Date.now() - t0;

  const usage = response.response.usageMetadata;
  console.warn(
    `[role-expectations] model=${MODEL_ID} latency=${latency}ms` +
      ` in=${usage?.promptTokenCount ?? "?"} out=${usage?.candidatesTokenCount ?? "?"}`,
  );

  const raw = response.response.text();
  const parsed = RoleExpectationsSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    throw new Error(`Role expectations validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}
