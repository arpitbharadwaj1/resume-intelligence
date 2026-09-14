"use client";

import { ChevronDown, ChevronUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { RoleContext } from "@/types/role";

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

  // Role context state
  const [showRole, setShowRole] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [expYears, setExpYears] = useState("");
  const [industry, setIndustry] = useState("");
  const [specialization, setSpecialization] = useState("");

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setStage({ kind: "error", message: `File exceeds ${MAX_MB} MB limit.` });
      return;
    }
    setStage({ kind: "selected", file });
  }

  function buildRoleContext(): RoleContext | undefined {
    if (!showRole || !jobTitle.trim()) return undefined;
    const years = parseInt(expYears, 10);
    if (isNaN(years) || years < 0) return undefined;
    return {
      jobTitle: jobTitle.trim(),
      experienceYears: years,
      ...(industry.trim() ? { industry: industry.trim() } : {}),
      ...(specialization.trim() ? { specialization: specialization.trim() } : {}),
    };
  }

  async function upload(file: File) {
    setStage({ kind: "uploading", file, progress: "Uploading…" });

    const form = new FormData();
    form.append("file", file);

    const roleContext = buildRoleContext();
    if (roleContext) {
      form.append("roleContext", JSON.stringify(roleContext));
    }

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
    <div className="space-y-5">
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

      {/* Role context section */}
      <div className="rounded-xl border border-(--color-line)">
        <button
          type="button"
          onClick={() => setShowRole((v) => !v)}
          disabled={isUploading}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-(--color-surface-subtle) rounded-xl transition-colors"
        >
          <span>
            Add target role{" "}
            <span className="font-normal text-(--color-ink-muted)">(optional — enables Role Readiness score)</span>
          </span>
          {showRole ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showRole && (
          <div className="border-t border-(--color-line) px-4 pb-4 pt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-(--color-ink-muted) mb-1">
                  Job title <span className="text-(--color-bad)">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Developer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-muted)/50 focus:border-(--color-accent) focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-(--color-ink-muted) mb-1">
                  Your years of experience <span className="text-(--color-bad)">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  min={0}
                  max={40}
                  value={expYears}
                  onChange={(e) => setExpYears(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-muted)/50 focus:border-(--color-accent) focus:outline-none"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-(--color-ink-muted) mb-1">
                  Industry <span className="text-(--color-ink-muted) font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. FinTech, Healthcare"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-muted)/50 focus:border-(--color-accent) focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-(--color-ink-muted) mb-1">
                  Specialization <span className="text-(--color-ink-muted) font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. React, Machine Learning"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-muted)/50 focus:border-(--color-accent) focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

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
