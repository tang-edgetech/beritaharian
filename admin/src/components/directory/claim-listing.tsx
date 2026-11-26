"use client";

import { DataListing, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { RouteTabs } from "@/components/route-tabs";
import { formatRelative } from "@/lib/format";
import type { BusinessClaim, Query } from "@cendol/api-client";
import { FileCheck2, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ClaimStatusBadge } from "./directory-badges";

export function ClaimTabs() {
  return (
    <RouteTabs
      label="Claims"
      tabs={[
        { href: "/directory/claims", label: "Waiting" },
        { href: "/directory/claims/decided", label: "Decided" },
      ]}
    />
  );
}

/** Ownership claims. "Waiting" shows pending ones; "Decided" shows approved and turned-down ones. */
export function ClaimListing({ decided }: { decided?: boolean }) {
  const extraQuery = useMemo<Query>(() => (decided ? { "filter[status]": "approved,rejected" } : { "filter[status]": "pending" }), [decided]);
  const filters = useMemo<ListingFilter[]>(
    () =>
      decided
        ? [
            {
              key: "status",
              label: "Decision",
              type: "select",
              options: [
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Turned down" },
              ],
            },
          ]
        : [],
    [decided],
  );

  const columns = useMemo<ListingColumn<BusinessClaim>[]>(
    () => [
      {
        id: "place",
        header: "Place",
        hideable: false,
        cell: (c) => (
          <Link href={`/directory/claims/${c.id}`} className="claim-cell flex min-w-0 flex-col">
            <span className="font-medium hover:underline">{c.place?.name ?? "Deleted place"}</span>
            <span className="text-xs text-muted-foreground">{c.place?.is_claimed ? "Already has an owner" : "No owner yet"}</span>
          </Link>
        ),
      },
      {
        id: "user",
        header: "Claimed by",
        cell: (c) => (
          <span className="flex min-w-0 flex-col text-sm">
            {c.user?.name ?? "—"}
            <span className="truncate text-xs text-muted-foreground">{c.role === "manager" ? "Manager" : "Owner"}</span>
          </span>
        ),
      },
      {
        id: "proof",
        header: "Proof",
        cell: (c) => (
          <span className="inline-flex items-center gap-1.5 text-sm">
            {c.has_document ? <FileCheck2 className="size-4 text-muted-foreground" /> : null}
            {[c.ssm_number ? `SSM ${c.ssm_number}` : null, c.has_document ? "Document" : null].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      },
      { id: "status", header: "Status", cell: (c) => <ClaimStatusBadge status={c.status} /> },
      { id: "created_at", header: "Sent", sortKey: "created_at", cell: (c) => <span className="text-sm whitespace-nowrap">{formatRelative(c.created_at)}</span> },
      ...(decided ? [{ id: "decided_at", header: "Decided", sortKey: "decided_at", cell: (c: BusinessClaim) => <span className="text-sm whitespace-nowrap">{formatRelative(c.decided_at)}</span> }] : []),
    ],
    [decided],
  );

  return (
    <DataListing<BusinessClaim>
      name={decided ? "claims-decided" : "claims-waiting"}
      endpoint="admin/directory/claims"
      columns={columns}
      filters={filters}
      extraQuery={extraQuery}
      getRowId={(c) => c.id}
      searchPlaceholder="Search places, people, SSM numbers"
      defaultSort={decided ? "-decided_at" : "created_at"}
      empty={decided ? { title: "No decided claims" } : { title: "No claims waiting", description: "When an owner claims their place from the site, it shows up here." }}
      rowActions={(c) => <IconAction icon={ScanSearch} label="Open and decide" href={`/directory/claims/${c.id}`} />}
    />
  );
}
