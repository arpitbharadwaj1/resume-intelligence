import { createServerClient } from "@/lib/supabase/server";

export interface AnalysisSummary {
  id: string;
  totalScore: number;
  status: string;
  createdAt: string;
  fileName: string;
}

export async function getUserAnalyses(limit = 20): Promise<AnalysisSummary[]> {
  const db = await createServerClient();

  const { data } = await db
    .from("analyses")
    .select("id, total_score, status, created_at, resumes(file_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    totalScore: (row.total_score as number) ?? 0,
    status: row.status as string,
    createdAt: row.created_at as string,
    fileName: ((row.resumes as unknown as { file_name: string } | null)?.file_name) ?? "Resume",
  }));
}
