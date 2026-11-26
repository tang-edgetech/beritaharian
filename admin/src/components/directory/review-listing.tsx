"use client";

import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { RouteTabs } from "@/components/route-tabs";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { FLAG_LABEL, PROOF_LABEL } from "@/lib/directory";
import { formatRelative } from "@/lib/format";
import type { AdminReview, MessageResponse, Query } from "@cendol/api-client";
import { CircleCheck, EyeOff, Flag, MapPinCheck, Receipt, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ReviewStatusBadge, Stars } from "./directory-badges";

export function ReviewTabs() {
  return (
    <RouteTabs
      label="Review queues"
      tabs={[
        { href: "/reviews", label: "To check" },
        { href: "/reviews/reported", label: "Reported" },
        { href: "/reviews/all", label: "All reviews" },
      ]}
    />
  );
}

const bulk = (action: string, note?: string) => (ids: string[]) => api.post<MessageResponse>("admin/directory/reviews/bulk", { action, ids, note });

interface ReviewListingProps {
  name: string;
  extraQuery?: Query;
  /** hide the place column when the list is for one place */
  showPlace?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
}

/** Reviews for moderators: receipts to check, flagged text, reports. */
export function ReviewListing({ name, extraQuery, showPlace = true, emptyTitle, emptyDescription }: ReviewListingProps) {
  const filters = useMemo<ListingFilter[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "pending", label: "Receipt to check" },
          { value: "held", label: "Held for a read" },
          { value: "visible", label: "Shown" },
          { value: "returned", label: "Sent back" },
          { value: "removed", label: "Taken down" },
        ],
      },
      { key: "proof", label: "Proof", type: "select", options: [{ value: "receipt", label: "Receipt photo" }, { value: "checkin", label: "Check-in" }] },
      { key: "rating", label: "Stars", type: "select", options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` })) },
      { key: "trashed", label: "Deleted", type: "select", options: [{ value: "with", label: "Include deleted by writers" }] },
    ],
    [],
  );

  const columns = useMemo<ListingColumn<AdminReview>[]>(
    () => [
      {
        id: "review",
        header: "Review",
        hideable: false,
        cell: (r) => (
          <Link href={`/reviews/${r.id}`} className="review-cell flex min-w-0 flex-col gap-1">
            <Stars rating={r.rating} />
            <span className="review-cell-text line-clamp-2 text-sm hover:underline">
              {r.title ? <strong className="font-semibold">{r.title} · </strong> : null}
              {r.body}
            </span>
          </Link>
        ),
      },
      ...(showPlace
        ? [{ id: "place", header: "Place", cell: (r: AdminReview) => (r.place ? <Link href={`/directory/businesses/${r.place.id}/details`} className="text-sm hover:underline">{r.place.name}</Link> : "—") }]
        : []),
      {
        id: "writer",
        header: "Writer",
        cell: (r) => (
          <span className="flex flex-col text-sm">
            {r.writer?.name ?? "—"}
            {r.is_anonymous ? <span className="text-xs text-muted-foreground">Name hidden in public</span> : null}
          </span>
        ),
      },
      {
        id: "proof",
        header: "Proof",
        cell: (r) =>
          r.proof ? (
            <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
              {r.proof.kind === "receipt" ? <Receipt className="size-4 text-muted-foreground" /> : <MapPinCheck className="size-4 text-muted-foreground" />}
              {PROOF_LABEL[r.proof.kind]}
              {r.proof.status === "confirmed" ? <span className="text-xs text-pandan-700 dark:text-pandan-300">checked</span> : null}
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "flags",
        header: "Flags",
        cell: (r) => (
          <span className="flex flex-wrap gap-1">
            {r.flags.map((f) => (
              <StatusBadge key={f} tone="warning">
                {FLAG_LABEL[f] ?? f}
              </StatusBadge>
            ))}
            {r.open_reports ? (
              <StatusBadge tone="danger">
                <Flag className="size-3" />
                {r.open_reports} report{r.open_reports === 1 ? "" : "s"}
              </StatusBadge>
            ) : null}
            {!r.flags.length && !r.open_reports ? <span className="text-sm text-muted-foreground">—</span> : null}
          </span>
        ),
      },
      { id: "status", header: "Status", cell: (r) => <ReviewStatusBadge status={r.status} deleted={Boolean(r.deleted_at)} /> },
      { id: "created_at", header: "Written", sortKey: "created_at", cell: (r) => <span className="text-sm whitespace-nowrap">{formatRelative(r.created_at)}</span> },
      { id: "reports", header: "Reports", sortKey: "reports", hiddenByDefault: true, className: "text-right", cell: (r) => <span className="tabular-nums">{r.open_reports}</span> },
      { id: "helpful", header: "Helpful", sortKey: "helpful", hiddenByDefault: true, className: "text-right", cell: (r) => <span className="tabular-nums">{r.helpful_count}</span> },
    ],
    [showPlace],
  );

  const bulkActions: BulkAction[] = [
    {
      key: "approve",
      label: "Approve",
      icon: CircleCheck,
      confirm: (n) => ({
        title: `Approve ${n} ${n === 1 ? "review" : "reviews"}?`,
        description: "Only reviews waiting for a check are affected. Their receipts count as checked and the reviews go up with a “Verified visit” badge.",
        confirmLabel: "Approve",
      }),
      run: bulk("approve"),
    },
    {
      key: "remove",
      label: "Take down",
      icon: EyeOff,
      danger: true,
      confirm: (n) => ({
        title: `Take down ${n} ${n === 1 ? "review" : "reviews"}?`,
        description: "Only shown reviews are affected. Writers see the reason “This review breaks the review rules.” Open a review to give a specific reason.",
        confirmLabel: "Take down",
        danger: true,
      }),
      run: bulk("remove", "This review breaks the review rules."),
    },
  ];

  return (
    <DataListing<AdminReview>
      name={name}
      endpoint="admin/directory/reviews"
      columns={columns}
      filters={filters}
      extraQuery={extraQuery}
      getRowId={(r) => r.id}
      searchPlaceholder="Search review text, places, writers"
      defaultSort="created_at"
      bulkActions={bulkActions}
      canSelectRow={(r) => !r.deleted_at}
      empty={{ title: emptyTitle, description: emptyDescription }}
      rowActions={(r) => <IconAction icon={ScanSearch} label="Open and check" href={`/reviews/${r.id}`} />}
    />
  );
}
