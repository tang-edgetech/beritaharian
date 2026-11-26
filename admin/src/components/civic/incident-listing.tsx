"use client";

import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { useReasonDialog } from "@/components/reason-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cancelled, incidentUrl, INCIDENT_STATUS_OPTIONS, SEVERITIES, SEVERITY, useAreas, useIncidentTypes } from "@/lib/civic";
import { formatRelative, formatDateTime } from "@/lib/format";
import type { AdminIncident, IncidentQueue } from "@cendol/api-client";
import { Ban, FolderOpen, Paperclip, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore, type MouseEvent } from "react";
import { IncidentStatusBadge, IncidentTypeIcon, LiveAlertBadge, ReporterRepliedBadge, SeverityBadge } from "./incident-badges";

const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(listener: () => void) {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** True on screens wide enough for the list and the preview side by side. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

interface BulkResult {
  message: string;
  done: number;
  skipped: number;
}

interface IncidentListingProps {
  queue: IncidentQueue;
  selected: string | null;
  /** Wide screens preview the report beside the list; narrow screens open its page. */
  onSelect: (ref: string) => void;
}

/** The verifier queue: one listing for every queue tab. */
export function IncidentListing({ queue, selected, onSelect }: IncidentListingProps) {
  const { can } = useAuth();
  const router = useRouter();
  const wide = useWideScreen();
  const types = useIncidentTypes();
  const areas = useAreas();
  const [askReason, reasonDialog] = useReasonDialog();

  const open = (incident: AdminIncident) => {
    if (wide) onSelect(incident.ref);
    else router.push(incidentUrl(incident.ref));
  };

  const openFromLink = (event: MouseEvent, incident: AdminIncident) => {
    // on wide screens the title link previews; a new-tab click still opens the page
    if (!wide || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    onSelect(incident.ref);
  };

  const filters = useMemo<ListingFilter[]>(
    () => [
      { key: "status", label: "Status", type: "select", options: INCIDENT_STATUS_OPTIONS },
      { key: "type", label: "Type", type: "select", options: (types.data ?? []).map((t) => ({ value: t.slug, label: t.name })) },
      {
        key: "area",
        label: "Area",
        type: "select",
        options: (areas.data ?? []).flatMap((d) => [{ value: d.slug, label: d.name }, ...d.children.map((c) => ({ value: c.slug, label: `— ${c.name}` }))]),
      },
      { key: "severity", label: "Severity", type: "select", options: SEVERITIES.map((s) => ({ value: s, label: SEVERITY[s].label })) },
      { key: "assigned", label: "Assigned", type: "select", options: [{ value: "me", label: "Assigned to me" }, { value: "none", label: "Not assigned" }] },
      { key: "alert", label: "Public alert", type: "select", options: [{ value: "1", label: "Published as an alert" }, { value: "0", label: "No alert" }] },
      { key: "from", label: "Received from", type: "date" },
      { key: "to", label: "Received until", type: "date" },
    ],
    [types.data, areas.data],
  );

  const columns = useMemo<ListingColumn<AdminIncident>[]>(
    () => [
      {
        id: "report",
        header: "Report",
        sortKey: "reference_no",
        hideable: false,
        cell: (i) => (
          <Link href={incidentUrl(i.ref)} onClick={(e) => openFromLink(e, i)} className="incident-cell flex min-w-0 items-center gap-3">
            <IncidentTypeIcon type={i.type} />
            <span className="flex min-w-0 flex-col">
              <span className="incident-cell-title line-clamp-2 font-medium hover:underline">{i.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{i.ref}</span>
                {i.type ? ` · ${i.type.name}` : ""}
                {i.area ? ` · ${i.area.name}` : ""}
              </span>
            </span>
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (i) => (
          <span className="incident-status-cell flex flex-wrap gap-1">
            <IncidentStatusBadge status={i.status} label={i.status_label} />
            {i.reporter_replied ? <ReporterRepliedBadge /> : null}
            {i.is_alert ? <LiveAlertBadge resolved={i.status === "closed"} /> : null}
          </span>
        ),
      },
      { id: "severity", header: "Severity", sortKey: "severity", cell: (i) => <SeverityBadge severity={i.severity} /> },
      {
        id: "assignee",
        header: "Assigned",
        cell: (i) => <span className="text-sm whitespace-nowrap">{i.assignee?.name ?? <span className="text-muted-foreground">Nobody</span>}</span>,
      },
      {
        id: "reporter",
        header: "Reporter",
        hiddenByDefault: true,
        cell: (i) => (
          <span className="flex flex-col text-sm">
            {i.reporter?.name ?? "—"}
            {i.is_anonymous ? <span className="text-xs text-muted-foreground">Hidden from public</span> : null}
          </span>
        ),
      },
      {
        id: "files",
        header: "Files",
        hiddenByDefault: true,
        cell: (i) => (
          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
            <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
            {i.evidence_count}
          </span>
        ),
      },
      {
        id: "occurred_at",
        header: "Happened",
        sortKey: "occurred_at",
        hiddenByDefault: true,
        cell: (i) => <span className="text-sm whitespace-nowrap">{formatDateTime(i.occurred_at)}</span>,
      },
      {
        id: "created_at",
        header: "Received",
        sortKey: "created_at",
        cell: (i) => (
          <span className="text-sm whitespace-nowrap" title={formatDateTime(i.created_at)}>
            {formatRelative(i.created_at)}
          </span>
        ),
      },
      { id: "updated_at", header: "Last change", sortKey: "updated_at", hiddenByDefault: true, cell: (i) => <span className="text-sm whitespace-nowrap">{formatRelative(i.updated_at)}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openFromLink only reads `wide`
    [wide],
  );

  const bulk = (action: string, message?: string) => (ids: string[]) => api.post<BulkResult>("admin/incidents/bulk", { action, ids, message });

  const bulkActions: BulkAction[] = can("incidents.verify")
    ? [
        { key: "assign_me", label: "Assign to me", icon: UserCheck, run: bulk("assign_me") },
        {
          key: "investigate",
          label: "Move to checking",
          icon: Search,
          confirm: (n) => ({
            title: `Move ${n} ${n === 1 ? "report" : "reports"} to “Checking”?`,
            description: "Only new reports and reports waiting for the reporter move. Reports nobody is assigned to are assigned to you.",
            confirmLabel: "Move to checking",
          }),
          run: bulk("investigate"),
        },
        {
          key: "reject",
          label: "Reject",
          icon: Ban,
          danger: true,
          run: async (ids) => {
            const reason = await askReason({
              title: `Reject ${ids.length} ${ids.length === 1 ? "report" : "reports"}?`,
              description: "Only open reports are closed; decided ones are skipped. Each reporter gets this reason by e-mail, so keep it polite and general.",
              label: "Reason (the reporters will see this)",
              placeholder: "e.g. We could not find enough detail to check these reports.",
              requiredMessage: "Please write a short reason. Each reporter will see it.",
              confirmLabel: "Reject",
              danger: true,
            });
            if (reason === null) throw cancelled();
            return bulk("reject", reason)(ids);
          },
        },
      ]
    : [];

  const extraQuery = useMemo(() => (queue === "all" ? undefined : { "filter[queue]": queue }), [queue]);

  return (
    <>
      <DataListing<AdminIncident>
        name={`incidents-${queue}`}
        endpoint="admin/incidents"
        columns={columns}
        filters={filters}
        extraQuery={extraQuery}
        getRowId={(i) => i.ref}
        searchPlaceholder="Search reference, title, place or reporter"
        defaultSort="created_at"
        bulkActions={bulkActions}
        onRowClick={open}
        isRowActive={(i) => i.ref === selected}
        empty={{ title: "Nothing in this queue", description: "Reports from readers arrive in “To check”. This list updates every time you open it." }}
        rowActions={(i) => <IconAction icon={FolderOpen} label="Open the full report" href={incidentUrl(i.ref)} />}
      />
      {reasonDialog}
    </>
  );
}
