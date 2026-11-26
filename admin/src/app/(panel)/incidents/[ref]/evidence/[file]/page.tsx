"use client";

import { CameraDetails, checkEvidence, downloadEvidence, KIND_LABEL } from "@/components/civic/incident-evidence";
import { CopyHash } from "@/components/civic/copy-text";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { fileSize, incidentUrl, useIncident } from "@/lib/civic";
import { formatDateTime } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";

/** One original file, shown in the browser. Opening this page is written to the audit log. */
export default function EvidenceViewerPage() {
  const { ref, file: fileId } = useParams<{ ref: string; file: string }>();
  const incident = useIncident(ref);
  const file = incident.data?.evidence.find((e) => e.id === fileId);
  const viewable = Boolean(file && file.kept && file.kind !== "document");

  // fetched once per visit: every fetch is logged, so no refetching on focus or retries
  const original = useQuery({
    queryKey: ["incident-evidence-view", ref, fileId],
    queryFn: async () => {
      const { blob } = await api.download(`admin/incidents/${ref}/evidence/${fileId}`, { inline: 1 });
      return URL.createObjectURL(blob);
    },
    enabled: viewable,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const objectUrl = original.data;
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  return (
    <>
      <PageHeader
        back={incidentUrl(ref, "evidence")}
        backLabel="Files"
        title={file ? file.name : incident.isPending ? <Skeleton className="h-8 w-72" /> : "File not found"}
        description={file ? `${KIND_LABEL[file.kind]} · ${fileSize(file.size)} · ${ref}` : null}
        actions={
          file?.kept ? (
            <>
              <Button variant="outline" onClick={() => checkEvidence(ref, file)}>
                <ShieldCheck />
                Check file
              </Button>
              <Button onClick={() => downloadEvidence(ref, file)}>
                <Download />
                Download
              </Button>
            </>
          ) : null
        }
      />
      <p className="evidence-viewer-note flex items-center gap-2 text-sm text-muted-foreground">
        <LockKeyhole className="size-4 shrink-0" aria-hidden />
        Opening this file was written to the audit log. The original is never changed.
      </p>
      {incident.isError ? <p className="panel-card">{incident.error.message}</p> : null}
      {file ? (
        <div className="evidence-viewer grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="evidence-viewer-stage grid min-h-64 place-items-center overflow-hidden rounded-xl border bg-santan-900 p-2">
            {!file.kept ? (
              <p className="text-sm text-santan-100">This file is no longer kept.</p>
            ) : file.kind === "document" ? (
              <p className="text-sm text-santan-100">Documents can&apos;t be shown here. Use Download.</p>
            ) : original.isPending ? (
              <Skeleton className="h-80 w-full" />
            ) : original.isError ? (
              <p className="text-sm text-santan-100">{original.error.message}</p>
            ) : file.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a private file from a blob, not a public image
              <img src={original.data} alt={`Evidence: ${file.name}`} className="evidence-viewer-image max-h-[75vh] max-w-full object-contain" />
            ) : file.kind === "video" ? (
              <video src={original.data} controls className="evidence-viewer-video max-h-[75vh] max-w-full" />
            ) : (
              <audio src={original.data} controls className="evidence-viewer-audio w-full max-w-md" />
            )}
          </div>
          <dl className="evidence-viewer-facts panel-card grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
            <dt className="text-muted-foreground">Received</dt>
            <dd>{formatDateTime(file.received_at)}</dd>
            <dt className="mt-2 text-muted-foreground">From</dt>
            <dd>
              {file.source === "staff" ? "Staff" : "Reporter"}
              {file.uploader ? ` · ${file.uploader.name}` : ""}
              {file.uploader_ip ? <span className="block font-mono text-xs text-muted-foreground">{file.uploader_ip}</span> : null}
            </dd>
            <dt className="mt-2 text-muted-foreground">SHA-256</dt>
            <dd>
              <CopyHash value={file.sha256} />
            </dd>
            <dt className="mt-2 text-muted-foreground">Camera</dt>
            <dd>{incident.data ? <CameraDetails file={file} pin={incident.data} /> : null}</dd>
          </dl>
        </div>
      ) : null}
    </>
  );
}
