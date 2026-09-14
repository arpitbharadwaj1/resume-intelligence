"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Stage =
  | { kind: "idle" }
  | { kind: "selected"; file: File }
  | { kind: "uploading"; file: File; progress: string }
  | { kind: "error"; message: string };

const ACCEPTED = ".pdf,.docx";
const MAX_MB = 5;

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setStage({ kind: "error", message: `File exceeds ${MAX_MB} MB limit.` });
      return;
    }
    setStage({ kind: "selected", file });
  }

  async function upload(file: File) {
    setStage({ kind: "uploading", file, progress: "Uploading…" });

    const form = new FormData();
    form.append("file", file);

    let res: Response;
    try {
      res = await fetch("/api/upload", { method: "POST", body: form });
    } catch {
      setStage({ kind: "error", message: "Network error. Please try again." });
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setStage({ kind: "error", message: body.error ?? "Upload failed. Please try again." });
      return;
    }

    const { analysisId } = await res.json() as { analysisId: string };
    router.push(`/results/${analysisId}`);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }

  const isUploading = stage.kind === "uploading";

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={isUploading}
        className={[
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors",
          dragging
            ? "border-(--color-accent) bg-(--color-accent)/5"
            : "border-(--color-line) hover:border-(--color-accent)/50",
          isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <Upload size={28} className="text-(--color-ink-muted)" />
        {stage.kind === "idle" && (
          <>
            <p className="text-sm font-medium">Drop your resume here or click to browse</p>
            <p className="text-xs text-(--color-ink-muted)">PDF or DOCX · max 5 MB</p>
          </>
        )}
        {stage.kind === "selected" && (
          <>
            <p className="text-sm font-medium">{stage.file.name}</p>
            <p className="text-xs text-(--color-ink-muted)">
              {(stage.file.size / 1024).toFixed(0)} KB · click to change
            </p>
          </>
        )}
        {stage.kind === "uploading" && (
          <>
            <p className="text-sm font-medium">{stage.file.name}</p>
            <p className="text-xs text-(--color-ink-muted)">{stage.progress}</p>
          </>
        )}
        {stage.kind === "error" && (
          <>
            <p className="text-sm font-medium">Choose a file</p>
            <p className="text-xs text-(--color-ink-muted)">PDF or DOCX · max 5 MB</p>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {stage.kind === "error" && (
        <p className="rounded-md bg-(--color-bad)/10 px-4 py-3 text-sm text-(--color-bad)">
          {stage.message}
        </p>
      )}

      {(stage.kind === "selected" || stage.kind === "uploading") && (
        <button
          type="button"
          onClick={() => stage.kind === "selected" && upload(stage.file)}
          disabled={isUploading}
          className="w-full rounded-lg bg-(--color-accent) px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isUploading ? "Analysing…" : "Analyse resume"}
        </button>
      )}
    </div>
  );
}
