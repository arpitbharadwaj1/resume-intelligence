/**
 * Environment validation.
 *
 * Parsed once, at module load, with Zod. A missing or malformed variable fails
 * the process immediately rather than surfacing as a confusing runtime error
 * three layers deep.
 *
 * The client/server split is a security boundary, not organisation:
 * `serverEnv` holds the Supabase service-role key and the Anthropic API key,
 * either of which is a full compromise if it reaches a browser bundle
 * (spec section 47). Accessing it from client code throws.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Client — inlined into the browser bundle at build time.
//
// These must be referenced as literal `process.env.NEXT_PUBLIC_*` properties.
// Next.js performs a static text substitution, so dynamic lookup returns
// undefined in the browser.
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "must be a valid URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ClientEnv = z.infer<typeof clientSchema>;

function readClientEnv(): ClientEnv {
  return parseOrThrow(clientSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

// ---------------------------------------------------------------------------
// Server — never sent to the browser.
// ---------------------------------------------------------------------------

/** Positive integer read from a string env var. */
const positiveInt = z.coerce.number().int().positive();

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),

  // Model routing — see docs/AI.md section 4.
  MODEL_EXTRACTION: z.string().min(1).default("claude-opus-5"),
  MODEL_CLASSIFICATION: z.string().min(1).default("claude-haiku-4-5"),

  // Limits and cost protection (spec section 48). Configuration, never
  // hardcoded at call sites.
  MAX_RESUME_SIZE_BYTES: positiveInt.default(5_242_880),
  MAX_JD_LENGTH: positiveInt.default(20_000),
  /** Token budget, measured with countTokens() — not String.length. */
  MAX_TEXT_TOKENS: positiveInt.default(12_000),
  MAX_OUTPUT_TOKENS: positiveInt.default(8_000),
  MAX_AI_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  MAX_ANALYSES_PER_DAY_ANONYMOUS: positiveInt.default(2),
  MAX_ANALYSES_PER_DAY_AUTHENTICATED: positiveInt.default(20),

  // Retention (spec section 45).
  RETENTION_DAYS: positiveInt.default(7),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Server-side configuration. Throws if called from the browser — that would
 * mean a server module leaked into a client bundle, which is a build error
 * worth failing loudly rather than degrading quietly.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() was called in the browser. This module holds the Supabase " +
        "service-role key and the Anthropic API key; reaching it from client " +
        "code means a server-only import crossed into a client bundle.",
    );
  }
  cachedServerEnv ??= parseOrThrow(serverSchema, process.env);
  return cachedServerEnv;
}

let cachedClientEnv: ClientEnv | undefined;

/** Public configuration, safe in the browser. */
export function clientEnv(): ClientEnv {
  cachedClientEnv ??= readClientEnv();
  return cachedClientEnv;
}

// ---------------------------------------------------------------------------

/**
 * Parse and throw with every failing variable named at once, so a fresh
 * checkout reports all missing configuration in a single run instead of one
 * variable per attempt.
 *
 * Only variable *names* appear in the message — never values, which would put
 * secrets into logs and stack traces.
 */
function parseOrThrow<T extends z.ZodType>(schema: T, source: unknown): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${problems}\n\nSee .env.example.`);
}

/** Exported for tests only. */
export const __testing = { clientSchema, serverSchema, parseOrThrow };
