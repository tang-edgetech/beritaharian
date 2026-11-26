"use client";

import { IconAction } from "@/components/icon-action";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { distanceMetres, fileSize, incidentUrl, metresText, saveBlob, uploadFiles } from "@/lib/civic";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { AdminIncidentDetail, EvidenceKind, IncidentEvidence } from "@cendol/api-client";
import { Camera, Download, Eye, FileAudio, FileImage, FileText, FileVideo, Loader2, LockKeyhole, ShieldCheck, Upload, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { CopyHash } from "./copy-text";
import { useIncidentMutation } from "./use-incident-action";

export const KIND_ICON: Record<EvidenceKind, LucideIcon> = { image: FileImage, video: FileVideo, audio: FileAudio, document: FileText };
export const KIND_LABEL: Record<EvidenceKind, string> = { image: "Photo", video: "Video", audio: "Voice recording", document: "Document" };

/** Downloads the original file (logged by the server). */
export async function downloadEvidence(ref: string, file: IncidentEvidence) {
  try {
    const { blob, filename } = await api.download(`admin/incidents/${ref}/evidence/${file.id}`);
    saveBlob(blob, filename === "download" ? file.name : filename);
  } catch (error) {
    notify.error(error, "We couldn't download that file. Please try again.");
  }
}

/** Re-hashes the stored file and says whether it still matches. */
export async function checkEvidence(ref: string, file: IncidentEvidence) {
  try {
    const result = await api.get<{ intact: boolean | null; message: string }>(`admin/incidents/${ref}/evidence/${file.id}/check`);
    if (result.intact === true) notify.success(result.message);
    else if (result.intact === null) notify.info(result.message);
    else notify.error(new Error(result.message), result.message);
  } catch (error) {
    notify.error(error);
  }
}

/** Camera details from the file, and how far its GPS is from the reported pin. */
export function CameraDetails({ file, pin }: { file: IncidentEvidence; pin: { latitude: number; longitude: number } }) {
  const e = file.exif ?? {};
  const camera = [e.make, e.model].filter(Boolean).join(" ");
  const gps = e.latitude !== undefined && e.longitude !== undefined ? { latitude: e.latitude, longitude: e.longitude } : null;
  const taken = e.taken_at ?? file.captured_at;
  if (!camera && !taken && !gps && !e.width) return <span className="text-muted-foreground">No camera details in the file.</span>;
  return (
    <span className="evidence-camera flex flex-col gap-0.5">
      {camera ? (
        <span className="flex items-center gap-1">
          <Camera className="size-3.5 text-muted-foreground" aria-hidden />
          {camera}
          {e.software ? <span className="text-muted-foreground"> · {e.software}</span> : null}
        </span>
      ) : null}
      {taken ? <span>Taken {formatDateTime(taken)}</span> : null}
      {e.width && e.height ? (
        <span className="text-muted-foreground">
          {e.width} × {e.height}
        </span>
      ) : null}
      {gps ? (
        <span>
          Photo GPS {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
          <span className="text-muted-foreground"> · {metresText(distanceMetres(gps, pin))} from the reported pin</span>
        </span>
      ) : null}
    </span>
  );
}

export function IncidentEvidenceTab({ incident: i }: { incident: AdminIncidentDetail }) {
  const { can } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const { run, busy } = useIncidentMutation(i.ref);
  const [working, setWorking] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    await run("upload", () => uploadFiles(`admin/incidents/${i.ref}/evidence`, Array.from(files)));
    if (input.current) input.current.value = "";
  }

  async function step(key: string, task: () => Promise<void>) {
    setWorking(key);
    await task();
    setWorking(null);
  }

  return (
    <div className="incident-evidence flex flex-col gap-4">
      <section className="incident-evidence-intro panel-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Originals are kept exactly as they arrived.</p>
            <p className="text-muted-foreground">
              Each file has a SHA-256 fingerprint taken on arrival; “Check file” proves it hasn&apos;t changed. Every view or download is written to the audit log with your name,
              so only open files you need. Files are private and never shown on the site.
            </p>
          </div>
        </div>
        {can("incidents.verify") ? (
          <>
            <Button type="button" variant="outline" className="shrink-0" disabled={busy !== null} onClick={() => input.current?.click()}>
              {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />}
              Add files
            </Button>
            <input
              ref={input}
              id="incident-evidence-input"
              type="file"
              multiple
              accept="image/*,video/*,audio/*,application/pdf"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose files to add"
              onChange={(e) => add(e.target.files)}
            />
          </>
        ) : null}
      </section>

      {i.evidence.length ? (
        <ul className="incident-evidence-list flex flex-col gap-3" aria-label="Files">
          {i.evidence.map((file) => {
            const Icon = KIND_ICON[file.kind];
            const viewable = file.kind !== "document";
            return (
              <li key={file.id} className={["evidence-item panel-card flex flex-col gap-3", file.kept ? "" : "is-purged opacity-75"].join(" ")}>
                <div className="evidence-item-head flex flex-wrap items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="evidence-name font-medium break-all">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {KIND_LABEL[file.kind]} · {fileSize(file.size)} · received {formatDateTime(file.received_at)}
                    </span>
                  </div>
                  {file.kept ? (
                    <div className="evidence-actions flex gap-0.5">
                      <IconAction
                        icon={Eye}
                        label={viewable ? "View (logged)" : "Download to view (logged)"}
                        href={viewable ? `${incidentUrl(i.ref, "evidence")}/${file.id}` : undefined}
                        onClick={viewable ? undefined : () => step(`dl-${file.id}`, () => downloadEvidence(i.ref, file))}
                      />
                      <IconAction icon={ShieldCheck} label="Check the file is unchanged" disabled={working !== null} onClick={() => step(`check-${file.id}`, () => checkEvidence(i.ref, file))} />
                      <IconAction icon={Download} label="Download the original (logged)" disabled={working !== null} onClick={() => step(`dl-${file.id}`, () => downloadEvidence(i.ref, file))} />
                    </div>
                  ) : (
                    <StatusBadge tone="neutral">Deleted {file.purged_at ? formatDateTime(file.purged_at) : ""}</StatusBadge>
                  )}
                </div>
                <dl className="evidence-facts grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">From</dt>
                  <dd>
                    {file.source === "staff" ? "Staff" : "Reporter"}
                    {file.uploader ? ` · ${file.uploader.name}` : ""}
                    {file.uploader_ip ? <span className="font-mono text-xs text-muted-foreground"> · {file.uploader_ip}</span> : null}
                  </dd>
                  <dt className="text-muted-foreground">SHA-256</dt>
                  <dd>
                    <CopyHash value={file.sha256} />
                  </dd>
                  <dt className="text-muted-foreground">Camera</dt>
                  <dd>
                    <CameraDetails file={file} pin={i} />
                  </dd>
                </dl>
                {working === `check-${file.id}` || working === `dl-${file.id}` ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Working…
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="panel-card text-sm text-muted-foreground">No files were sent with this report.</p>
      )}
    </div>
  );
}
