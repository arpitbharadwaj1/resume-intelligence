"use client";

import { Check, Copy, RotateCcw, Wand2 } from "lucide-react";
import { useState } from "react";

import type { RewriteType } from "@/lib/ai/rewriter";

interface RewriteResult {
  rewritten: string;
  explanation: string;
  addedClaims: string[];
}

type Stage =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; result: RewriteResult }
  | { kind: "error"; message: string };

export function RewriteTool() {
  const [text, setText] = useState("");
  const [type, setType] = useState<RewriteType>("bullet");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  async function rewrite() {
    if (!text.trim() || text.trim().length < 10) return;
    setStage({ kind: "loading" });

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), type }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setStage({ kind: "error", message: body.error ?? "Rewrite failed. Please try again." });
        return;
      }

      const result = await res.json() as RewriteResult;
      setStage({ kind: "result", result });
    } catch {
      setStage({ kind: "error", message: "Network error. Please try again." });
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isLoading = stage.kind === "loading";

  return (
    <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-(--color-line) px-5 py-3.5">
        <Wand2 size={15} className="text-(--color-accent)" />
        <span className="text-sm font-semibold">Rewrite assistant</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          {(["bullet", "summary"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                type === t
                  ? "bg-(--color-accent) text-white"
                  : "bg-(--color-surface-subtle) text-(--color-ink-muted) hover:text-(--color-ink)",
              ].join(" ")}
            >
              {t === "bullet" ? "Experience bullet" : "Summary"}
            </button>
          ))}
        </div>

        {/* Input */}
        <div>
          <label className="block text-xs font-medium text-(--color-ink-muted) mb-1.5">
            Paste your {type === "bullet" ? "bullet" : "summary"} here
          </label>
          <textarea
            rows={type === "bullet" ? 3 : 5}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (stage.kind === "result" || stage.kind === "error") setStage({ kind: "idle" });
            }}
            placeholder={
              type === "bullet"
                ? "e.g. Worked on a dashboard project with the team."
                : "e.g. Experienced developer with 5 years in software engineering."
            }
            disabled={isLoading}
            className="w-full rounded-lg border border-(--color-line) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-muted)/50 focus:border-(--color-accent) focus:outline-none resize-none disabled:opacity-60"
          />
        </div>

        <button
          onClick={rewrite}
          disabled={isLoading || text.trim().length < 10}
          className="flex items-center gap-2 rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Wand2 size={14} />
          {isLoading ? "Rewriting…" : "Rewrite"}
        </button>

        {stage.kind === "error" && (
          <p className="rounded-lg bg-(--color-bad-subtle) px-4 py-3 text-sm text-(--color-bad)">
            {stage.message}
          </p>
        )}

        {stage.kind === "result" && (
          <div className="space-y-4">
            {/* Truth warning if claims were added */}
            {stage.result.addedClaims.length > 0 && (
              <div className="rounded-lg border border-(--color-bad)/30 bg-(--color-bad-subtle) px-4 py-3">
                <p className="text-sm font-semibold text-(--color-bad)">
                  ⚠ Review required — new claims detected
                </p>
                <p className="mt-1 text-xs text-(--color-bad)">
                  The rewrite introduced the following items not in your original. Only keep them if you can
                  truthfully substantiate each one:
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {stage.result.addedClaims.map((c, i) => (
                    <li key={i} className="rounded-md border border-(--color-bad)/30 px-2 py-0.5 text-xs font-medium text-(--color-bad)">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Before / After */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-(--color-surface-subtle) p-3">
                <p className="mb-2 text-xs font-semibold text-(--color-ink-muted) uppercase tracking-wide">Original</p>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>

              <div className="rounded-xl border border-(--color-accent)/20 bg-(--color-accent-subtle) p-3">
                <p className="mb-2 text-xs font-semibold text-(--color-accent) uppercase tracking-wide">Suggested</p>
                <p className="text-sm leading-relaxed">{stage.result.rewritten}</p>
              </div>
            </div>

            {/* Explanation */}
            <p className="text-xs text-(--color-ink-muted)">
              <span className="font-medium">Why this is better: </span>
              {stage.result.explanation}
            </p>

            {/* Truth reminder */}
            {stage.result.addedClaims.length === 0 && (
              <p className="text-xs text-(--color-warn)">
                ⚠ Verify this accurately represents your experience before using it.
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => copy(stage.result.rewritten)}
                className="flex items-center gap-1.5 rounded-lg border border-(--color-line) px-3 py-1.5 text-xs font-medium hover:bg-(--color-surface-subtle)"
              >
                {copied ? <Check size={13} className="text-(--color-good)" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy suggestion"}
              </button>
              <button
                onClick={() => setStage({ kind: "idle" })}
                className="flex items-center gap-1.5 rounded-lg border border-(--color-line) px-3 py-1.5 text-xs font-medium hover:bg-(--color-surface-subtle) text-(--color-ink-muted)"
              >
                <RotateCcw size={13} />
                Try another
              </button>
            </div>
          </div>
        )}

        {stage.kind === "idle" && !text && (
          <p className="text-xs text-(--color-ink-muted)">
            Paste a weak bullet or your summary above. The rewriter will improve structure and clarity
            without inventing any claims.
          </p>
        )}
      </div>
    </div>
  );
}
