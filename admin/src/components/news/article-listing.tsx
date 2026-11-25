"use client";

import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/format";
import { publicArticleUrl, useAreas, useNewsCategories } from "@/lib/news";
import type { AdminArticle, MessageResponse, Query } from "@cendol/api-client";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ArticleBadges } from "./news-badges";

const bulk = (action: string) => (ids: string[]) => api.post<MessageResponse>("admin/news/articles/bulk", { action, ids });

/** The story list, used for All stories and the review queue. */
export function ArticleListing({ name, extraQuery, emptyTitle, emptyDescription }: { name: string; extraQuery?: Query; emptyTitle: string; emptyDescription?: string }) {
  const { can } = useAuth();
  const categories = useNewsCategories();
  const areas = useAreas();

  const filters = useMemo<ListingFilter[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "live", label: "Live on the site" },
          { value: "draft", label: "Draft" },
          { value: "in_review", label: "Waiting for fact-check" },
          { value: "verified", label: "Verified, ready to publish" },
          { value: "scheduled", label: "Scheduled" },
          { value: "archived", label: "Archived" },
        ],
      },
      { key: "category", label: "Category", type: "select", options: (categories.data ?? []).map((c) => ({ value: c.slug, label: c.name })) },
      {
        key: "area",
        label: "Area",
        type: "select",
        options: (areas.data ?? []).flatMap((d) => [{ value: d.slug, label: d.name }, ...d.children.map((c) => ({ value: c.slug, label: `— ${c.name}` }))]),
      },
      { key: "mine", label: "Writer", type: "select", options: [{ value: "yes", label: "Only my stories" }] },
      { key: "label", label: "Label", type: "select", options: [{ value: "developing", label: "Developing" }, { value: "corrected", label: "Corrected" }] },
      { key: "breaking", label: "Breaking", type: "select", options: [{ value: "yes", label: "Breaking only" }] },
    ],
    [categories.data, areas.data],
  );

  const columns = useMemo<ListingColumn<AdminArticle>[]>(
    () => [
      {
        id: "title",
        header: "Story",
        hideable: false,
        cell: (a) => (
          <Link href={`/news/${a.id}/edit`} className="article-cell flex min-w-0 items-center gap-3">
            {a.cover?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from the API's media folder
              <img src={a.cover.thumb} alt="" className="article-cell-thumb size-12 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="article-cell-thumb size-12 shrink-0 rounded-md bg-muted" aria-hidden />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="article-cell-title line-clamp-2 font-medium hover:underline">{a.title || "Untitled draft"}</span>
              <span className="text-xs text-muted-foreground">
                {a.category?.name ?? "No category"}
                {a.area ? ` · ${a.area.name}` : ""}
              </span>
            </span>
          </Link>
        ),
      },
      { id: "status", header: "Status", cell: (a) => <ArticleBadges article={a} /> },
      { id: "author", header: "Writer", cell: (a) => <span className="text-sm">{a.author?.name ?? "—"}</span> },
      {
        id: "published_at",
        header: "Published",
        sortKey: "published_at",
        cell: (a) => <span className="text-sm whitespace-nowrap">{a.published_at ? formatDate(a.published_at) : "—"}</span>,
      },
      { id: "views", header: "Reads", sortKey: "views", className: "text-right", cell: (a) => <span className="tabular-nums">{a.view_count.toLocaleString("en-MY")}</span> },
      { id: "updated_at", header: "Last change", sortKey: "updated_at", cell: (a) => <span className="text-sm whitespace-nowrap">{formatRelative(a.updated_at)}</span> },
    ],
    [],
  );

  const bulkActions: BulkAction[] = [
    ...(can("news.publish")
      ? [
          {
            key: "archive",
            label: "Take off the site",
            icon: Archive,
            danger: true,
            confirm: (n: number) => ({ title: `Take ${n} ${n === 1 ? "story" : "stories"} off the site?`, description: "Only live stories are affected. You can restore them later.", confirmLabel: "Take down", danger: true }),
            run: bulk("archive"),
          },
          { key: "restore", label: "Restore to drafts", icon: ArchiveRestore, run: bulk("restore") },
        ]
      : []),
    ...(can("news.delete")
      ? [
          {
            key: "delete",
            label: "Delete",
            icon: Trash2,
            danger: true,
            confirm: (n: number) => ({ title: `Delete ${n} ${n === 1 ? "story" : "stories"}?`, description: "Only drafts and archived stories are deleted.", confirmLabel: "Delete", danger: true }),
            run: bulk("delete"),
          },
        ]
      : []),
  ];

  return (
    <DataListing<AdminArticle>
      name={name}
      endpoint="admin/news/articles"
      columns={columns}
      filters={filters}
      extraQuery={extraQuery}
      getRowId={(a) => a.id}
      searchPlaceholder="Search headlines"
      defaultSort="-updated_at"
      bulkActions={bulkActions}
      empty={{
        title: emptyTitle,
        description: emptyDescription,
        action: can("news.write") ? (
          <Button asChild size="sm">
            <Link href="/news/create">Write a story</Link>
          </Button>
        ) : undefined,
      }}
      rowActions={(a) => (
        <>
          <IconAction icon={Pencil} label={a.actions?.includes("edit") === false ? "Open" : "Open and edit"} href={`/news/${a.id}/edit`} />
          {a.is_live ? (
            <IconAction icon={ExternalLink} label="View on the site" onClick={() => window.open(publicArticleUrl(a.category?.slug, a.slug), "_blank", "noopener")} />
          ) : null}
        </>
      )}
    />
  );
}
