"use client";

import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { publicPlaceUrl, ratingText, useDirectoryAreas, useSectors } from "@/lib/directory";
import { formatRelative } from "@/lib/format";
import type { BusinessListItem, MessageResponse } from "@cendol/api-client";
import { BadgeCheck, CircleCheck, ExternalLink, EyeOff, MapPin, Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BusinessStatusBadge } from "./directory-badges";

const bulk = (action: string, note?: string) => (ids: string[]) => api.post<MessageResponse>("admin/directory/businesses/bulk", { action, ids, note });

export function BusinessListing() {
  const { can } = useAuth();
  const sectors = useSectors();
  const areas = useDirectoryAreas();

  const filters = useMemo<ListingFilter[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "active", label: "On the map" },
          { value: "pending", label: "Waiting for approval" },
          { value: "suspended", label: "Taken off the map" },
        ],
      },
      { key: "sector", label: "Sector", type: "select", options: (sectors.data ?? []).map((s) => ({ value: s.slug, label: s.name })) },
      {
        key: "area",
        label: "Area",
        type: "select",
        options: (areas.data ?? []).flatMap((d) => [{ value: d.slug, label: d.name }, ...d.children.map((c) => ({ value: c.slug, label: `— ${c.name}` }))]),
      },
      { key: "claimed", label: "Owner", type: "select", options: [{ value: "yes", label: "Run by its owner" }, { value: "no", label: "Not claimed yet" }] },
      { key: "trashed", label: "Deleted", type: "select", options: [{ value: "only", label: "Only deleted places" }, { value: "with", label: "Include deleted" }] },
    ],
    [sectors.data, areas.data],
  );

  const columns = useMemo<ListingColumn<BusinessListItem>[]>(
    () => [
      {
        id: "name",
        header: "Place",
        sortKey: "name",
        hideable: false,
        cell: (b) => (
          <Link href={`/directory/businesses/${b.id}/details`} className="place-cell flex min-w-0 items-center gap-3">
            {b.logo?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- logos come from the API's media folder
              <img src={b.logo.thumb} alt="" className="place-cell-logo size-11 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="place-cell-logo grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden>
                <MapPin className="size-5" />
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="place-cell-name line-clamp-2 font-medium hover:underline">{b.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {b.sector?.name ?? "No sector"}
                {b.area ? ` · ${b.area.name}` : ""}
                {b.branch_count > 1 ? ` · ${b.branch_count} branches` : ""}
              </span>
            </span>
          </Link>
        ),
      },
      { id: "status", header: "Status", cell: (b) => <BusinessStatusBadge status={b.status} deleted={Boolean(b.deleted_at)} /> },
      {
        id: "claimed",
        header: "Owner",
        cell: (b) =>
          b.is_claimed ? (
            <span className="inline-flex items-center gap-1 text-sm text-pandan-700 dark:text-pandan-300">
              <BadgeCheck className="size-4" /> Claimed
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Not claimed</span>
          ),
      },
      {
        id: "rating",
        header: "Stars",
        sortKey: "rating",
        cell: (b) => (
          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
            <Star className="size-3.5 fill-marigold-400 text-marigold-500" aria-hidden />
            {ratingText(b.rating_avg, b.rating_count)}
            <span className="text-muted-foreground">({b.rating_count})</span>
          </span>
        ),
      },
      { id: "reviews", header: "Reviews", sortKey: "reviews", hiddenByDefault: true, className: "text-right", cell: (b) => <span className="tabular-nums">{b.rating_count}</span> },
      { id: "created_by", header: "Added by", hiddenByDefault: true, cell: (b) => <span className="text-sm">{b.created_by?.name ?? "—"}</span> },
      { id: "updated_at", header: "Last change", sortKey: "updated_at", cell: (b) => <span className="text-sm whitespace-nowrap">{formatRelative(b.updated_at)}</span> },
    ],
    [],
  );

  const bulkActions: BulkAction[] = [
    ...(can("directory.claims")
      ? [{ key: "approve", label: "Approve", icon: CircleCheck, confirm: (n: number) => ({ title: `Approve ${n} ${n === 1 ? "place" : "places"}?`, description: "Only places waiting for approval are affected. They appear on the map straight away.", confirmLabel: "Approve" }), run: bulk("approve") }]
      : []),
    ...(can("directory.manage")
      ? [
          {
            key: "suspend",
            label: "Take off the map",
            icon: EyeOff,
            danger: true,
            confirm: (n: number) => ({
              title: `Take ${n} ${n === 1 ? "place" : "places"} off the map?`,
              description: "Their pages disappear from the site until you put them back. The reason saved is “Taken off the map by a moderator”; open a place to write a specific reason.",
              confirmLabel: "Take off",
              danger: true,
            }),
            run: bulk("suspend", "Taken off the map by a moderator."),
          },
          {
            key: "delete",
            label: "Delete",
            icon: Trash2,
            danger: true,
            confirm: (n: number) => ({ title: `Delete ${n} ${n === 1 ? "place" : "places"}?`, description: "They go to the deleted list, where you can restore them.", confirmLabel: "Delete", danger: true }),
            run: bulk("delete"),
          },
        ]
      : []),
  ];

  return (
    <DataListing<BusinessListItem>
      name="places"
      endpoint="admin/directory/businesses"
      columns={columns}
      filters={filters}
      getRowId={(b) => b.id}
      searchPlaceholder="Search names, addresses, SSM numbers"
      defaultSort="-updated_at"
      bulkActions={bulkActions}
      canSelectRow={(b) => !b.deleted_at}
      empty={{
        title: "No places found",
        description: "Try another search, or add the first place.",
        action: can("directory.manage") ? (
          <Button asChild size="sm">
            <Link href="/directory/businesses/create">Add a place</Link>
          </Button>
        ) : undefined,
      }}
      rowActions={(b) => (
        <>
          <IconAction icon={Pencil} label="Open and edit" href={`/directory/businesses/${b.id}/details`} />
          {b.status === "active" && !b.deleted_at ? (
            <IconAction icon={ExternalLink} label="View on the site" onClick={() => window.open(publicPlaceUrl(b.sector?.slug, b.slug), "_blank", "noopener")} />
          ) : null}
        </>
      )}
    />
  );
}
