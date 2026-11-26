"use client";

import { DataListing, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/billing";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry, Query } from "@cendol/api-client";
import { useMemo } from "react";

const AREAS = [
  { value: "users", label: "Users" },
  { value: "roles", label: "Roles" },
  { value: "settings", label: "Settings" },
  { value: "auth", label: "Sign-in & security" },
  { value: "billing", label: "Billing" },
  { value: "news", label: "Newsroom" },
  { value: "directory", label: "Places" },
];

/** Field names as people say them. */
const FIELD_LABELS: Record<string, string> = {
  email_verified_at: "Email confirmed",
  phone_verified_at: "Phone confirmed",
  two_factor_confirmed_at: "Two-step sign-in",
  status: "Status",
  name: "Name",
  email: "Email",
  phone: "Phone",
  roles: "Roles",
  permissions: "Permissions",
  label: "Name",
  description: "Description",
  number: "Number",
  receipt_number: "Receipt no.",
  issue_date: "Invoice date",
  due_date: "Due date",
  total_sen: "Total",
  paid_sen: "Paid",
  credited_sen: "Credited",
  refunded_sen: "Refunded",
  amount_sen: "Amount",
  tax_sen: "Tax",
  void_reason: "Void reason",
  rejected_reason: "Reject reason",
};

function show(value: unknown, key = ""): string {
  if (key.endsWith("_sen") && typeof value === "number") return formatMoney(value);
  if (value === null || value === undefined || value === "") return "empty";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Changes({ entry }: { entry: AuditEntry }) {
  const keys = Array.from(new Set([...Object.keys(entry.old ?? {}), ...Object.keys(entry.new ?? {})]));
  if (!keys.length) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="audit-changes flex flex-col gap-0.5 text-xs">
      {keys.map((key) => (
        <li key={key} className="audit-change">
          <span className="audit-change-field font-medium">{FIELD_LABELS[key] ?? key.replaceAll("_", " ")}</span>:{" "}
          {entry.old && key in entry.old ? <span className="audit-change-old text-muted-foreground line-through">{show(entry.old[key], key)}</span> : null}
          {entry.old && key in entry.old ? " → " : null}
          <span className="audit-change-new">{show(entry.new?.[key], key)}</span>
        </li>
      ))}
    </ul>
  );
}

interface AuditListingProps {
  name?: string;
  extraQuery?: Query;
  showAreaFilter?: boolean;
}

/** Read-only list of who changed what. */
export function AuditListing({ name = "audit", extraQuery, showAreaFilter = true }: AuditListingProps) {
  const filters = useMemo<ListingFilter[]>(
    () => [
      ...(showAreaFilter ? [{ key: "log_name", label: "Area", type: "select" as const, options: AREAS }] : []),
      { key: "date_from", label: "From", type: "date" },
      { key: "date_to", label: "To", type: "date" },
    ],
    [showAreaFilter],
  );

  const columns = useMemo<ListingColumn<AuditEntry>[]>(
    () => [
      { id: "created_at", header: "When", sortKey: "created_at", hideable: false, cell: (e) => <span className="text-sm whitespace-nowrap">{formatDateTime(e.created_at)}</span> },
      { id: "by", header: "Who", cell: (e) => <span className="text-sm font-medium">{e.by.name}</span> },
      {
        id: "description",
        header: "What happened",
        cell: (e) => (
          <span className="flex flex-col gap-1">
            <span className="text-sm">{e.description}</span>
            {e.subject ? <span className="text-xs text-muted-foreground">{e.subject.type}: {e.subject.label}</span> : null}
          </span>
        ),
      },
      {
        id: "area",
        header: "Area",
        cell: (e) => <StatusBadge tone="neutral">{AREAS.find((a) => a.value === e.area)?.label ?? e.area}</StatusBadge>,
      },
      { id: "changes", header: "Changes", cell: (e) => <Changes entry={e} /> },
    ],
    [],
  );

  return (
    <DataListing<AuditEntry>
      name={name}
      endpoint="admin/audit-logs"
      responseShape="plain"
      columns={columns}
      filters={filters}
      extraQuery={extraQuery}
      getRowId={(e) => String(e.id)}
      searchPlaceholder="Search what happened"
      defaultSort="-created_at"
      empty={{ title: "Nothing recorded yet", description: "Changes to users, roles and settings appear here." }}
    />
  );
}
