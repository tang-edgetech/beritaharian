"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { SortableList } from "@/components/sortable-list";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { CATEGORY_COLORS, useNewsCategories } from "@/lib/news";
import type { MessageResponse, NewsCategory } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function CategoriesPage() {
  const query = useNewsCategories();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  async function reorder(items: NewsCategory[]) {
    queryClient.setQueryData(["news-categories"], items);
    try {
      notify.success((await api.put<MessageResponse>("admin/news/categories/order", { slugs: items.map((c) => c.slug) })).message);
    } catch (error) {
      notify.error(error);
      await queryClient.invalidateQueries({ queryKey: ["news-categories"] });
    }
  }

  async function remove(category: NewsCategory) {
    const ok = await confirm({ title: `Delete “${category.name}”?`, description: "Only empty categories can be deleted.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/news/categories/${category.slug}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["news-categories"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="The sections readers browse. Drag to change the order of the home page and menus."
        actions={
          <Button asChild>
            <Link href="/news/categories/create">
              <Plus />
              Add category
            </Link>
          </Button>
        }
      />
      {query.isPending ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : (
        <SortableList
          items={query.data}
          getId={(c) => c.slug}
          handleLabel={(c) => `Move ${c.name}`}
          onReorder={reorder}
          renderItem={(c) => (
            <div className="category-row flex flex-1 items-center gap-3 py-3 pr-3">
              <span className={`size-3 shrink-0 rounded-full ${CATEGORY_COLORS.find((x) => x.value === c.color)?.swatch ?? ""}`} aria-hidden />
              <Link href={`/news/categories/${c.slug}`} className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium hover:underline">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">{c.description ?? `/news/${c.slug}`}</span>
              </Link>
              {c.is_active === false ? <StatusBadge tone="neutral">Hidden</StatusBadge> : null}
              <span className="text-sm text-muted-foreground tabular-nums">{c.articles_count ?? 0} stories</span>
              <IconAction icon={Pencil} label="Edit" href={`/news/categories/${c.slug}`} />
              <IconAction icon={Trash2} label={c.articles_count ? "Has stories, can't delete" : "Delete"} danger disabled={Boolean(c.articles_count)} onClick={() => remove(c)} />
            </div>
          )}
        />
      )}
    </>
  );
}
