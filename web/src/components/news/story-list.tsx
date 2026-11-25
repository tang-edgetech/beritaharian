import { getArticles, type ArticleListQuery } from "@/lib/news";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { StoryCard, StoryRow } from "./article-cards";

interface StoryListProps {
  query: ArticleListQuery;
  /** Base address for page links, e.g. /news/food (page numbers are added as ?page=2). */
  basePath: string;
  /** Extra address bits kept on page links, e.g. { q: "banjir" }. */
  keep?: Record<string, string>;
  layout?: "grid" | "rows";
  empty: string;
}

/** A page of stories with Previous / Next links. The page number lives in the address. */
export async function StoryList({ query, basePath, keep = {}, layout = "grid", empty }: StoryListProps) {
  const result = await getArticles(query);

  if (!result) {
    return <p className="story-list-error rounded-card bg-marigold-50 p-5 text-sm dark:bg-gula-900">We couldn&apos;t load these stories. Please refresh in a minute.</p>;
  }
  if (!result.data.length) {
    return <p className="story-list-empty rounded-card bg-santan-100 p-6 text-santan-600 dark:bg-santan-900 dark:text-santan-300">{empty}</p>;
  }

  const page = result.meta.current_page;
  const link = (n: number) => {
    const params = new URLSearchParams(keep);
    if (n > 1) params.set("page", String(n));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <div className="story-list flex flex-col gap-8">
      {layout === "grid" ? (
        <div className="story-list-grid grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((article) => (
            <StoryCard key={article.slug} article={article} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
          ))}
        </div>
      ) : (
        <div className="story-list-rows flex flex-col">
          {result.data.map((article) => (
            <StoryRow key={article.slug} article={article} />
          ))}
        </div>
      )}
      {result.meta.last_page > 1 ? (
        <nav className="story-list-pager flex items-center justify-between gap-4 border-t border-santan-200 pt-5 dark:border-santan-800" aria-label="More stories">
          {page > 1 ? (
            <Link href={link(page - 1)} className="pager-link inline-flex h-10 items-center gap-1 rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              <ChevronLeft className="size-4" aria-hidden />
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-santan-500 tabular-nums">
            Page {page} of {result.meta.last_page}
          </span>
          {page < result.meta.last_page ? (
            <Link href={link(page + 1)} className="pager-link inline-flex h-10 items-center gap-1 rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              Older
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

export function StoryListSkeleton() {
  return (
    <div className="story-list-skeleton grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="aspect-[4/3] animate-pulse rounded-card bg-santan-200 dark:bg-santan-800" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-santan-200 dark:bg-santan-800" />
          <div className="h-5 w-5/6 animate-pulse rounded bg-santan-200 dark:bg-santan-800" />
        </div>
      ))}
    </div>
  );
}

/** Reads ?page=2 safely. */
export function pageFrom(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
