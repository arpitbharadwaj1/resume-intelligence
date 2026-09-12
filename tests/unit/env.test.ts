import { describe, expect, it } from "vitest";

import { __testing } from "@/lib/env";

const { clientSchema, serverSchema, parseOrThrow } = __testing;

const validServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GEMINI_API_KEY: "AIza-test",
};

describe("clientSchema", () => {
  it("accepts a valid public configuration", () => {
    const result = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-URL Supabase URL", () => {
    const result = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty anon key rather than treating it as absent", () => {
    const result = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("serverSchema", () => {
  it("requires the secrets that have no safe default", () => {
    const result = serverSchema.safeParse({});
    expect(result.success).toBe(false);

    const missing = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(missing).toContain("GEMINI_API_KEY");
  });

  it("applies documented defaults for every limit", () => {
    const parsed = serverSchema.parse(validServerEnv);

    expect(parsed.MAX_RESUME_SIZE_BYTES).toBe(5_242_880);
    expect(parsed.MAX_JD_LENGTH).toBe(20_000);
    expect(parsed.MAX_TEXT_TOKENS).toBe(12_000);
    expect(parsed.MAX_OUTPUT_TOKENS).toBe(8_000);
    expect(parsed.MAX_AI_RETRIES).toBe(2);
    expect(parsed.RETENTION_DAYS).toBe(7);
  });

  it("defaults model routing to the tiers documented in docs/AI.md", () => {
    const parsed = serverSchema.parse(validServerEnv);
    expect(parsed.MODEL_CLASSIFICATION).toBe("gemini-2.0-flash");
  });

  it("coerces numeric limits from strings, since every env var arrives as a string", () => {
    const parsed = serverSchema.parse({
      ...validServerEnv,
      MAX_RESUME_SIZE_BYTES: "1048576",
      RETENTION_DAYS: "30",
    });

    expect(parsed.MAX_RESUME_SIZE_BYTES).toBe(1_048_576);
    expect(typeof parsed.MAX_RESUME_SIZE_BYTES).toBe("number");
    expect(parsed.RETENTION_DAYS).toBe(30);
  });

  it("rejects a zero or negative size limit", () => {
    for (const value of ["0", "-1"]) {
      const result = serverSchema.safeParse({ ...validServerEnv, MAX_RESUME_SIZE_BYTES: value });
      expect(result.success, `MAX_RESUME_SIZE_BYTES=${value} should be rejected`).toBe(false);
    }
  });

  it("rejects a non-numeric limit instead of silently falling back to the default", () => {
    const result = serverSchema.safeParse({ ...validServerEnv, RETENTION_DAYS: "seven" });
    expect(result.success).toBe(false);
  });

  it("caps AI retries, so a misconfiguration cannot multiply spend without bound", () => {
    expect(serverSchema.safeParse({ ...validServerEnv, MAX_AI_RETRIES: "6" }).success).toBe(false);
    expect(serverSchema.safeParse({ ...validServerEnv, MAX_AI_RETRIES: "0" }).success).toBe(true);
  });
});

describe("parseOrThrow", () => {
  it("names every failing variable in one message, not just the first", () => {
    let message = "";
    try {
      parseOrThrow(serverSchema, { MAX_AI_RETRIES: "99" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(message).toContain("GEMINI_API_KEY");
    expect(message).toContain("MAX_AI_RETRIES");
    expect(message).toContain(".env.example");
  });

  it("never puts a configured value into the error message", () => {
    // A secret that fails validation must not be echoed into logs or stack traces.
    const secret = "sk-ant-super-secret-value";
    let message = "";
    try {
      parseOrThrow(serverSchema, {
        SUPABASE_SERVICE_ROLE_KEY: secret,
        GEMINI_API_KEY: secret,
        RETENTION_DAYS: "not-a-number",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("RETENTION_DAYS");
    expect(message).not.toContain(secret);
  });

  it("returns parsed data on success", () => {
    const parsed = parseOrThrow(serverSchema, validServerEnv);
    expect(parsed.GEMINI_API_KEY).toBe("AIza-test");
  });
});
