"use client";

import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { incidentUrl, useIncident, useIsMe } from "@/lib/civic";
import { formatDateTime, formatRelative } from "@/lib/format";
import { EyeOff, FolderOpen, Loader2, Paperclip, Search, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { IncidentStatusBadge, IncidentTypeIcon, LiveAlertBadge, ReporterRepliedBadge, SeverityBadge } from "./incident-badges";
import { IncidentMap } from "./incident-map";
import { useIncidentMutation } from "./use-incident-action";

/** The right-hand panel of the queue: enough to triage a report without leaving the list. */
export function IncidentPreview({ reference, onClose }: { reference: string; onClose: () => void }) {
  const { can } = useAuth();
  const isMe = useIsMe();
  const query = useIncident(reference);
  const { act, busy } = useIncidentMutation(reference);
  const i = query.data;

  return (
    <aside className="incident-preview panel-card flex flex-col gap-4 xl:sticky xl:top-20" aria-label="Report preview">
      <div className="incident-preview-head flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{reference}</p>
          <h2 className="incident-preview-title font-heading text-base leading-snug font-bold">{i ? i.title : <Skeleton className="h-5 w-48" />}</h2>
        </div>
        <IconAction icon={X} label="Close the preview" onClick={onClose} />
      </div>

      {query.isPending ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : query.isError ? (
        <p className="text-sm">{query.error.message}</p>
      ) : i ? (
        <>
          <div className="incident-preview-badges flex flex-wrap items-center gap-1.5">
            <IncidentStatusBadge status={i.status} label={i.status_label} />
            <SeverityBadge severity={i.severity} />
            {i.reporter_replied ? <ReporterRepliedBadge /> : null}
            {i.is_alert ? <LiveAlertBadge resolved={i.status === "closed"} /> : null}
          </div>

          <IncidentMap incident={i} nearby={i.nearby} className="incident-preview-map h-48" />

          <dl className="incident-preview-facts grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="flex items-center gap-2">
              <IncidentTypeIcon type={i.type} size="sm" />
              {i.type?.name ?? "Not set"}
            </dd>
            <dt className="text-muted-foreground">Where</dt>
            <dd>{[i.address, i.area?.name].filter(Boolean).join(" · ") || "Pin only"}</dd>
            <dt className="text-muted-foreground">Happened</dt>
            <dd>{formatDateTime(i.occurred_at)}</dd>
            <dt className="text-muted-foreground">Received</dt>
            <dd>{formatRelative(i.created_at)}</dd>
            <dt className="text-muted-foreground">Reporter</dt>
            <dd>
              {i.reporter?.name ?? "Deleted account"}
              {i.is_anonymous ? (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <EyeOff className="size-3" aria-hidden />
                  Hidden from public. Only staff see the name.
                </span>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Assigned</dt>
            <dd>{i.assignee?.name ?? "Nobody"}</dd>
            <dt className="text-muted-foreground">Files</dt>
            <dd className="flex items-center gap-1">
              <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
              {i.evidence.length} file{i.evidence.length === 1 ? "" : "s"}
            </dd>
            {i.nearby.length ? (
              <>
                <dt className="text-muted-foreground">Nearby</dt>
                <dd>
                  {i.nearby.length} other report{i.nearby.length === 1 ? "" : "s"} within the area and a few days
                </dd>
              </>
            ) : null}
          </dl>

          <div className="incident-preview-description">
            <h3 className="text-sm font-medium">What the reporter wrote</h3>
            <p className="mt-1 line-clamp-6 text-sm whitespace-pre-line text-muted-foreground">{i.description}</p>
          </div>

          <div className="incident-preview-actions flex flex-wrap gap-2 border-t pt-3">
            {can("incidents.verify") && !isMe(i.assignee) ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act({ action: "assign" })}>
                {busy === "assign" ? <Loader2 className="animate-spin" /> : <UserCheck />}
                Assign to me
              </Button>
            ) : null}
            {can("incidents.verify") && (i.status === "new" || i.status === "needs_info") ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act({ action: "investigate" })}>
                {busy === "investigate" ? <Loader2 className="animate-spin" /> : <Search />}
                Move to checking
              </Button>
            ) : null}
            <Button size="sm" asChild className="ml-auto">
              <Link href={incidentUrl(i.ref)}>
                <FolderOpen />
                Open
              </Link>
            </Button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
