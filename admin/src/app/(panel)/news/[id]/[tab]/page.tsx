"use client";

import { AuditListing } from "@/components/logs/audit-listing";
import { ArticleForm } from "@/components/news/article-form";
import { WorkflowPanel } from "@/components/news/workflow-panel";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { AdminArticle, ArticleRevision } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";

const TABS = ["edit", "history", "activity"] as const;

function HistoryTab({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["article-revisions", id],
    queryFn: () => api.get<{ data: ArticleRevision[] }>(`admin/news/articles/${id}/revisions`).then((r) => r.data),
  });
  if (query.isPending) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (query.isError) return <p className="panel-card">{query.error.message}</p>;

  return (
    <ol className="revision-list flex flex-col gap-3">
      {query.data.map((revision, index) => (
        <li key={revision.id} className="revision-item panel-card flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{revision.editor}</span>
            <span className="text-muted-foreground">{formatDateTime(revision.created_at)}</span>
            {revision.is_public_correction ? <StatusBadge tone="warning">Public correction</StatusBadge> : null}
            {index === 0 ? <StatusBadge tone="good">Current version</StatusBadge> : null}
          </div>
          {revision.change_note ? <p className="text-sm">{revision.change_note}</p> : null}
          <p className="revision-headline font-heading font-bold">{revision.snapshot.title}</p>
          <p className="text-xs text-muted-foreground">
            {[revision.snapshot.category, revision.snapshot.area, revision.snapshot.tags.join(", ")].filter(Boolean).join(" · ")}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function ArticleDetailPage() {
  const { id, tab } = useParams<{ id: string; tab: string }>();
  const { can } = useAuth();
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: ["article", id],
    queryFn: () => api.get<{ data: AdminArticle }>(`admin/news/articles/${id}`).then((r) => r.data),
  });

  if (!TABS.includes(tab as (typeof TABS)[number])) notFound();

  const article = query.data;
  const tabs = [
    { href: `/news/${id}/edit`, label: article?.actions?.includes("edit") === false ? "Story" : "Edit" },
    { href: `/news/${id}/history`, label: "Versions" },
    ...(can("audit.view") ? [{ href: `/news/${id}/activity`, label: "Activity" }] : []),
  ];

  return (
    <>
      <PageHeader
        back="/news"
        backLabel="Stories"
        title={article ? article.title || "Untitled draft" : <Skeleton className="h-8 w-80" />}
        description={article ? `${article.category?.name ?? "No category yet"} · ${article.reading_minutes} min read · last changed ${formatDateTime(article.updated_at)}` : null}
      />
      <RouteTabs tabs={tabs} label="Story sections" />
      {query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : article ? (
        <>
          {tab === "edit" ? (
            <div className="article-detail grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <ArticleForm key={`${article.id}-${article.updated_at}`} article={article} onSaved={() => undefined} onDirtyChange={setDirty} />
              <WorkflowPanel article={article} dirty={dirty} />
            </div>
          ) : null}
          {tab === "history" ? <HistoryTab id={article.id} /> : null}
          {tab === "activity" ? <AuditListing name={`article-activity-${article.id}`} extraQuery={{ "filter[subject_article]": article.id }} showAreaFilter={false} /> : null}
        </>
      ) : null}
    </>
  );
}
