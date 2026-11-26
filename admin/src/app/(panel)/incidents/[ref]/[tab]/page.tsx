"use client";

import { IncidentAlert } from "@/components/civic/incident-alert";
import { IncidentStatusBadge, LiveAlertBadge, ReporterRepliedBadge, SeverityBadge } from "@/components/civic/incident-badges";
import { IncidentDecide } from "@/components/civic/incident-decide";
import { IncidentEvidenceTab } from "@/components/civic/incident-evidence";
import { IncidentHandover } from "@/components/civic/incident-handover";
import { IncidentOverview } from "@/components/civic/incident-overview";
import { IncidentTimeline } from "@/components/civic/incident-timeline";
import { AuditListing } from "@/components/logs/audit-listing";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { incidentUrl, useIncident } from "@/lib/civic";
import { formatRelative } from "@/lib/format";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";

const TABS = ["overview", "decide", "evidence", "alert", "timeline", "handover", "activity"] as const;

export default function IncidentDetailPage() {
  const { ref, tab } = useParams<{ ref: string; tab: string }>();
  const { can } = useAuth();
  const query = useIncident(ref);
  const auditQuery = useMemo(() => ({ "filter[subject_incident]": ref }), [ref]);

  if (!TABS.includes(tab as (typeof TABS)[number])) notFound();

  const i = query.data;
  const tabs = [
    { href: incidentUrl(ref, "overview"), label: "Overview" },
    ...(can("incidents.verify") ? [{ href: incidentUrl(ref, "decide"), label: "Decide" }] : []),
    { href: incidentUrl(ref, "evidence"), label: i ? `Files (${i.evidence.length})` : "Files" },
    ...(can("incidents.verify") ? [{ href: incidentUrl(ref, "alert"), label: "Alert" }] : []),
    { href: incidentUrl(ref, "timeline"), label: i ? `Timeline (${i.timeline.length})` : "Timeline" },
    ...(can("incidents.export") ? [{ href: incidentUrl(ref, "handover"), label: i?.handovers.length ? `Police handover (${i.handovers.length})` : "Police handover" }] : []),
    ...(can("audit.view") ? [{ href: incidentUrl(ref, "activity"), label: "Activity" }] : []),
  ];
  const allowed = tab === "decide" || tab === "alert" ? can("incidents.verify") : tab === "handover" ? can("incidents.export") : tab === "activity" ? can("audit.view") : true;

  return (
    <>
      <PageHeader
        back="/incidents/queue/check"
        backLabel="Report queue"
        title={i ? i.title : query.isError ? "Report" : <Skeleton className="h-8 w-72" />}
        description={
          i ? (
            <span className="incident-header-meta flex flex-wrap items-center gap-2">
              <span className="font-mono">{i.ref}</span>
              <IncidentStatusBadge status={i.status} label={i.status_label} />
              <SeverityBadge severity={i.severity} />
              {i.reporter_replied ? <ReporterRepliedBadge /> : null}
              {i.is_alert ? <LiveAlertBadge resolved={i.status === "closed"} /> : null}
              <span>
                {i.type?.name ?? "No type"} · received {formatRelative(i.created_at)}
              </span>
            </span>
          ) : null
        }
      />
      <RouteTabs tabs={tabs} label="Report sections" />
      {!allowed ? (
        <p className="panel-card">You don&apos;t have permission to see this section.</p>
      ) : query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : i ? (
        <>
          {tab === "overview" ? <IncidentOverview incident={i} /> : null}
          {tab === "decide" ? <IncidentDecide key={i.updated_at} incident={i} /> : null}
          {tab === "evidence" ? <IncidentEvidenceTab incident={i} /> : null}
          {tab === "alert" ? <IncidentAlert key={i.updated_at} incident={i} /> : null}
          {tab === "timeline" ? <IncidentTimeline incident={i} /> : null}
          {tab === "handover" ? <IncidentHandover incident={i} /> : null}
          {tab === "activity" ? <AuditListing name={`incident-activity-${i.ref}`} extraQuery={auditQuery} showAreaFilter={false} /> : null}
        </>
      ) : null}
    </>
  );
}
