/**
 * POST /api/upload — the full analysis pipeline.
 *
 * Accepts a multipart form with a `file` field. Runs in order:
 *   1. Validate the file (extension, MIME, magic bytes, size)
 *   2. Extract text (PDF via unpdf, DOCX via mammoth)
 *   3. Upload the original file to private Storage
 *   4. Create DB records (resume + analysis rows)
 *   5. Run feature extraction (rule layer + Gemini classifier)
 *   6. Score the feature vector
 *   7. Persist the score and feature rows
 *   8. Return { analysisId }
 *
 * The client is untrusted at every step: the file is validated before any
 * parsing, and raw text is never written to logs (AI.md §1, CLAUDE.md §5).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { completeAnalysis, createAnalysis, createResumeRecord, failAnalysis } from "@/lib/db/analyses";
import { analyzeFeatures } from "@/lib/analysis";
import { GeminiClassifier } from "@/lib/ai/gemini";
import { scoreResumeHealth } from "@/lib/scoring/health-score";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { extractDocument } from "@/lib/upload/extract";
import { validateUpload } from "@/lib/upload/validate";
import { serverEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  // --- Auth check ---
  const db = await createServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // --- Parse multipart ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // --- 1. Validate ---
  const validation = validateUpload({
    name: file.name,
    type: file.type,
    size: file.size,
    bytes,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 422 });
  }

  // --- 2. Extract text ---
  let extraction: Awaited<ReturnType<typeof extractDocument>>;
  try {
    extraction = await extractDocument(bytes, validation.extension);
  } catch {
    return NextResponse.json(
      { error: "Could not read the document. Please check the file is not corrupted." },
      { status: 422 },
    );
  }

  // --- 3. Upload original file to private Storage ---
  const storagePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;
  const admin = createAdminClient();
  const { error: storageError } = await admin.storage
    .from("resumes")
    .upload(storagePath, bytes, { contentType: validation.mimeType, upsert: false });

  if (storageError) {
    return NextResponse.json({ error: "File storage failed" }, { status: 500 });
  }

  // --- 4. Create DB records ---
  let resumeId: string;
  let analysisId: string;
  try {
    resumeId = await createResumeRecord({
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: validation.mimeType,
      storagePath,
    });
    analysisId = await createAnalysis({ userId: user.id, resumeId });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // --- 5. Feature extraction + 6. Scoring + 7. Persist ---
  try {
    const env = serverEnv();
    const classifier = new GeminiClassifier({ apiKey: env.GEMINI_API_KEY });
    const features = await analyzeFeatures(extraction.text, classifier, {
      pageCount: extraction.pageCount,
    });
    const result = scoreResumeHealth(features);

    await completeAnalysis(analysisId, result, features, env.MODEL_CLASSIFICATION);
  } catch (err) {
    await failAnalysis(analysisId, String(err));
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }

  // --- 8. Return ---
  return NextResponse.json({ analysisId }, { status: 200 });
}
