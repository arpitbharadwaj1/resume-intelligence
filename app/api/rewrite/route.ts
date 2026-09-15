/**
 * POST /api/rewrite — targeted resume text rewriter.
 *
 * Accepts { text, type } and returns { rewritten, explanation, addedClaims }.
 * Auth required — unauthenticated requests are rejected.
 * Raw text is never logged (CLAUDE.md §5).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { rewriteText } from "@/lib/ai/rewriter";
import { createServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

const BodySchema = z.object({
  text: z.string().min(10).max(2000),
  type: z.enum(["bullet", "summary"]),
});

export async function POST(request: NextRequest) {
  // Auth check
  const db = await createServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 422 });
  }

  const { text, type } = parsed.data;

  try {
    const env = serverEnv();
    const result = await rewriteText(text, type, env.GEMINI_API_KEY);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[rewrite] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Rewrite failed. Please try again." }, { status: 500 });
  }
}
