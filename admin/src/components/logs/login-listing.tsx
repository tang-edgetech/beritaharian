"use client";

import { DataListing, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import type { LoginEntry } from "@cendol/api-client";
import Link from "next/link";
import { useMemo } from "react";

/** Plain description of a browser string: "Chrome on Windows". */
function describeDevice(agent: string | null): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "A browser";
  const system = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iPhone/iPad" : /Mac OS/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : "an unknown system";
  return `${browser} on ${system}`;
}

const filters: ListingFilter[] = [
  { key: "succeeded", label: "Result", type: "select", options: [{ value: "yes", label: "Signed in" }, { value: "no", label: "Failed" }] },
  { key: "date_from", label: "From", type: "date" },
  { key: "date_to", label: "To", type: "date" },
];

export function LoginListing() {
  const columns = useMemo<ListingColumn<LoginEntry>[]>(
    () => [
      { id: "created_at", header: "When", sortKey: "created_at", hideable: false, cell: (e) => <span className="text-sm whitespace-nowrap">{formatDateTime(e.created_at)}</span> },
      {
        id: "identifier",
        header: "Account",
        sortKey: "identifier",
        cell: (e) =>
          e.user ? (
            <Link href={`/users/${e.user.id}/security`} className="flex flex-col hover:underline">
              <span className="text-sm font-medium">{e.user.name}</span>
              <span className="text-xs text-muted-foreground">{e.identifier}</span>
            </Link>
          ) : (
            <span className="text-sm">{e.identifier}</span>
          ),
      },
      {
        id: "result",
        header: "Result",
        cell: (e) => (e.succeeded ? <StatusBadge tone="good">Signed in</StatusBadge> : <StatusBadge tone="danger">{e.reason ?? "Failed"}</StatusBadge>),
      },
      { id: "device", header: "Device", cell: (e) => <span className="text-sm">{describeDevice(e.user_agent)}</span> },
      { id: "ip", header: "IP address", cell: (e) => <span className="font-mono text-xs">{e.ip ?? "—"}</span> },
    ],
    [],
  );

  return (
    <DataListing<LoginEntry>
      name="login-history"
      endpoint="admin/login-history"
      responseShape="plain"
      columns={columns}
      filters={filters}
      getRowId={(e) => String(e.id)}
      searchPlaceholder="Search by email, phone or IP address"
      defaultSort="-created_at"
      empty={{ title: "No sign-ins yet" }}
    />
  );
}
