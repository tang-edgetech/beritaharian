"use client";

import { Camera, FileText, Film, Mic, Paperclip, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { fileSize } from "@/lib/alert-links";

/* Photos, videos, voice notes and PDFs for a report, with previews and friendly checks before anything is sent. */

export const EVIDENCE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "mp4", "mov", "webm", "3gp", "m4a", "mp3", "aac", "wav", "ogg", "pdf"];
const ACCEPT = ["image/*", "video/*", "audio/*", "application/pdf", ...EVIDENCE_EXTENSIONS.map((e) => `.${e}`)].join(",");

type Kind = "image" | "video" | "audio" | "document";

function kindOf(file: File): Kind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) return "image";
  if (file.type.startsWith("video/") || ["mp4", "mov", "webm", "3gp"].includes(ext)) return "video";
  if (file.type.startsWith("audio/") || ["m4a", "mp3", "aac", "wav", "ogg"].includes(ext)) return "audio";
  return "document";
}

const KIND_ICON = { image: Camera, video: Film, audio: Mic, document: FileText } as const;

/** Checks the files against the limits and returns the ones to keep plus a plain message about any left out. */
export function checkEvidence(current: File[], picked: File[], maxFiles: number, maxFileMb: number): { files: File[]; problem: string | null } {
  const kept = [...current];
  const problems: string[] = [];
  for (const file of picked) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EVIDENCE_EXTENSIONS.includes(ext)) {
      problems.push(`“${file.name}” isn't a photo, video, voice recording or PDF, so we left it out.`);
    } else if (file.size > maxFileMb * 1024 * 1024) {
      problems.push(`“${file.name}” is ${fileSize(file.size)}. Each file can be up to ${maxFileMb} MB.`);
    } else if (kept.length >= maxFiles) {
      problems.push(`You can add up to ${maxFiles} files, so “${file.name}” was left out.`);
    } else if (!kept.some((k) => k.name === file.name && k.size === file.size)) {
      kept.push(file);
    }
  }
  return { files: kept, problem: problems.length ? problems.join(" ") : null };
}

export function EvidencePicker({
  label,
  files,
  onChange,
  maxFiles,
  maxFileMb,
  error,
}: {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles: number;
  maxFileMb: number;
  error?: string;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const hintId = useId();

  // small previews for photos and videos; the browser frees them when the list changes
  const previews = useMemo(() => files.map((f) => (kindOf(f) === "image" || kindOf(f) === "video" ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  function add(list: FileList | null) {
    const result = checkEvidence(files, Array.from(list ?? []), maxFiles, maxFileMb);
    setProblem(result.problem);
    onChange(result.files);
  }

  const full = files.length >= maxFiles;
  const button =
    "evidence-picker-button inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-santan-300 px-4 text-sm font-bold focus-within:ring-2 focus-within:ring-pandan-400 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800";

  return (
    <fieldset className="evidence-picker flex flex-col gap-2" aria-describedby={hintId}>
      <legend className="mb-1 text-sm font-semibold text-gula-900 dark:text-coconut">{label}</legend>
      {full ? null : (
        <div className="evidence-picker-buttons flex flex-wrap gap-2">
          {/* inputs sit inside their labels (no ids): Next keeps hidden copies of visited pages */}
          <label className={`${button} is-camera`}>
            <Camera className="size-4" aria-hidden />
            Take a photo or video
            <input type="file" accept="image/*,video/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          <label className={`${button} is-files`}>
            <Paperclip className="size-4" aria-hidden />
            Choose files
            <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      )}
      <p id={hintId} className="evidence-picker-hint text-xs text-santan-500">
        Photos, videos, voice recordings or PDF. Up to {maxFiles} files, {maxFileMb} MB each.
        {files.length ? ` ${files.length} of ${maxFiles} added.` : ""}
      </p>

      {files.length ? (
        <ul className="evidence-picker-list grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file, i) => {
            const kind = kindOf(file);
            const Icon = KIND_ICON[kind];
            const url = previews[i];
            return (
              <li key={`${file.name}-${file.size}-${i}`} className={`evidence-item is-${kind} relative flex flex-col overflow-hidden rounded-xl border border-santan-200 bg-santan-50 dark:border-santan-800 dark:bg-santan-950`}>
                <div className="evidence-item-preview flex aspect-video items-center justify-center bg-santan-100 text-santan-500 dark:bg-santan-900">
                  {kind === "image" && url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local preview of the reader's own file
                    <img src={url} alt="" className="size-full object-cover" />
                  ) : kind === "video" && url ? (
                    <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
                  ) : (
                    <Icon className="size-8" aria-hidden />
                  )}
                </div>
                <div className="evidence-item-name flex items-center gap-1.5 px-2 py-1.5 text-xs">
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-semibold" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-santan-500">{fileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProblem(null);
                    onChange(files.filter((_, j) => j !== i));
                  }}
                  className="evidence-item-remove absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-full bg-gula-900/80 text-coconut hover:bg-gula-900"
                  aria-label={`Remove ${file.name}`}
                  title="Remove this file"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {problem || error ? (
        <p className="evidence-picker-error text-sm text-red-700 dark:text-red-400" role="alert">
          {problem ?? error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** The first error the API gave for any of the files (files, files.0, files.1…). */
export function filesError(errors: Record<string, string>): string | undefined {
  return errors.files ?? Object.entries(errors).find(([k]) => k.startsWith("files."))?.[1];
}
