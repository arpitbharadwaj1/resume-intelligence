import { describe, expect, it } from "vitest";

/**
 * Unit tests for the rewriter input contract.
 *
 * The Gemini call itself is not tested here (it's an integration concern).
 * These tests verify the input validation and the data shapes the route/component
 * expect.
 */

// ---------------------------------------------------------------------------
// Input validation logic (mirrors the BodySchema in the API route)
// ---------------------------------------------------------------------------

import { z } from "zod";

const BodySchema = z.object({
  text: z.string().min(10).max(2000),
  type: z.enum(["bullet", "summary"]),
});

describe("rewrite API input schema", () => {
  it("accepts valid bullet input", () => {
    const r = BodySchema.safeParse({ text: "Worked on the checkout feature for the e-commerce platform.", type: "bullet" });
    expect(r.success).toBe(true);
  });

  it("accepts valid summary input", () => {
    const r = BodySchema.safeParse({ text: "Frontend developer with 5 years of experience building web applications.", type: "summary" });
    expect(r.success).toBe(true);
  });

  it("rejects text shorter than 10 chars", () => {
    const r = BodySchema.safeParse({ text: "Too short", type: "bullet" });
    expect(r.success).toBe(false);
  });

  it("rejects text longer than 2000 chars", () => {
    const r = BodySchema.safeParse({ text: "x".repeat(2001), type: "bullet" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown type", () => {
    const r = BodySchema.safeParse({ text: "Valid text length for input", type: "unknown" });
    expect(r.success).toBe(false);
  });

  it("rejects missing type", () => {
    const r = BodySchema.safeParse({ text: "Valid text length for input" });
    expect(r.success).toBe(false);
  });

  it("rejects empty text", () => {
    const r = BodySchema.safeParse({ text: "", type: "bullet" });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RewriteResult shape
// ---------------------------------------------------------------------------

import { z as zz } from "zod";

const RewriteResultShape = zz.object({
  rewritten: zz.string().min(5),
  explanation: zz.string(),
  addedClaims: zz.array(zz.string()),
});

describe("RewriteResult shape", () => {
  it("valid result passes", () => {
    const r = RewriteResultShape.safeParse({
      rewritten: "Delivered a customer-facing dashboard reducing load time by improving component architecture.",
      explanation: "Strengthened the opening verb and restructured for clarity.",
      addedClaims: [],
    });
    expect(r.success).toBe(true);
  });

  it("result with added claims passes (claims are surfaced, not blocked)", () => {
    const r = RewriteResultShape.safeParse({
      rewritten: "Built a React dashboard reducing load time by 40%.",
      explanation: "Added outcome framing.",
      addedClaims: ["40% load time reduction"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.addedClaims).toHaveLength(1);
    }
  });

  it("addedClaims empty array is the clean state", () => {
    const r = RewriteResultShape.safeParse({
      rewritten: "Led development of internal tooling used by the operations team.",
      explanation: "Replaced passive voice with active verb.",
      addedClaims: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.addedClaims).toHaveLength(0);
    }
  });
});
