import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, FileText, Plus } from "lucide-react";

import { getUserAnalyses } from "@/lib/db/get-analyses";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Resume Intelligence" };

function scoreColor(score: number) {
  if (score >= 80) return "text-(--color-good)";
  if (score >= 60) return "text-(--color-warn)";
  return "text-(--color-bad)";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-(--color-good-subtle)";
  if (score >= 60) return "bg-(--color-warn-subtle)";
  return "bg-(--color-bad-subtle)";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login" as Route);

  const analyses = await getUserAnalyses();
  const completed = analyses.filter((a) => a.status === "completed");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your analyses</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            {completed.length === 0
              ? "No analyses yet — upload your first resume to get started."
              : `${completed.length} resume${completed.length === 1 ? "" : "s"} analysed`}
          </p>
        </div>
        <Link
          href="/analyze/upload"
          className="flex items-center gap-2 rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus size={15} />
          New analysis
        </Link>
      </div>

      {/* List */}
      {completed.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-(--color-line) py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-surface-subtle)">
            <FileText size={22} className="text-(--color-ink-muted)" />
          </div>
          <p className="mt-4 font-medium">No analyses yet</p>
          <p className="mt-1 text-sm text-(--color-ink-muted)">Upload a PDF or DOCX to get your first score.</p>
          <Link
            href="/analyze/upload"
            className="mt-6 rounded-lg bg-(--color-accent) px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Upload resume
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {completed.map((analysis) => (
            <li key={analysis.id}>
              <Link
                href={`/results/${analysis.id}` as Route}
                className="group flex items-center gap-4 rounded-xl border border-(--color-line) bg-(--color-surface-raised) px-5 py-4 transition-shadow hover:shadow-sm"
              >
                {/* Score badge */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${scoreBg(analysis.totalScore)}`}>
                  <span className={`text-lg font-bold tabular-nums ${scoreColor(analysis.totalScore)}`}>
                    {analysis.totalScore}
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{analysis.fileName}</p>
                  <p className="mt-0.5 text-sm text-(--color-ink-muted)">{formatDate(analysis.createdAt)}</p>
                </div>

                <ArrowRight
                  size={16}
                  className="shrink-0 text-(--color-ink-muted) transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
