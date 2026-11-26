"use client";

import { SectorIcon } from "@/components/directory/sector-icon";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { INCIDENT_STATUS_TONE, SEVERITY } from "@/lib/civic";
import { CATEGORY_COLORS } from "@/lib/news";
import type { IncidentSeverity, IncidentStatus, IncidentTypeRef } from "@cendol/api-client";
import { MessageCircleReply, Radio } from "lucide-react";

/** Status in the API's plain words ("Waiting for reporter"), coloured the same everywhere. */
export function IncidentStatusBadge({ status, label }: { status: IncidentStatus; label: string }) {
  return <StatusBadge tone={INCIDENT_STATUS_TONE[status]}>{label}</StatusBadge>;
}

const severityClass: Record<IncidentSeverity, string> = {
  low: "is-low bg-santan-100 text-santan-700 dark:bg-santan-800 dark:text-santan-200",
  medium: "is-medium bg-marigold-100 text-marigold-800 dark:bg-marigold-900 dark:text-marigold-200",
  high: "is-high bg-satay-500 text-white dark:bg-satay-700",
  critical: "is-critical bg-red-600 text-white dark:bg-red-700",
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <Badge variant="secondary" className={`severity-badge border-transparent ${severityClass[severity]}`} title={SEVERITY[severity].hint}>
      {SEVERITY[severity].label}
    </Badge>
  );
}

export function ReporterRepliedBadge() {
  return (
    <Badge variant="secondary" className="reporter-replied-badge border-transparent bg-pandan-600 text-white">
      <MessageCircleReply />
      Reporter replied
    </Badge>
  );
}

export function LiveAlertBadge({ resolved }: { resolved?: boolean }) {
  return resolved ? (
    <StatusBadge tone="neutral">Alert resolved</StatusBadge>
  ) : (
    <Badge variant="secondary" className="live-alert-badge border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">
      <Radio />
      Live alert
    </Badge>
  );
}

/** The type's icon in its colour, with or without its name. */
export function IncidentTypeIcon({ type, size = "md" }: { type: Pick<IncidentTypeRef, "icon" | "color" | "name"> | null; size?: "sm" | "md" }) {
  const swatch = CATEGORY_COLORS.find((c) => c.value === type?.color)?.swatch ?? "bg-santan-500";
  const box = size === "sm" ? "size-7" : "size-9";
  const icon = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span className={`incident-type-icon grid ${box} shrink-0 place-items-center rounded-full text-white ${swatch}`} title={type?.name ?? "No type"} aria-hidden>
      <SectorIcon name={type?.icon ?? "circle-help"} className={icon} />
    </span>
  );
}
