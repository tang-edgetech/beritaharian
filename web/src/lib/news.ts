import type { AreaGroup, HomeData, NewsCategory, Paginated, PublicArticle } from "@cendol/api-client";
import { cacheLife, cacheTag } from "next/cache";

/*
  News for the public site, fetched on the server and cached.
  Stories are refreshed every minute (and straight away when the API tells us something changed),
  so a busy news day doesn't send every reader's request to Laravel.
*/

const API = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

type Result<T> = { ok: true; data: T } | { ok: false; status: number };

async function getJson<T>(path: string): Promise<Result<T>> {
  try {
    const response = await fetch(`${API}/${path}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** On failure, cache only for seconds so the page recovers as soon as the API is back. */
function lifetime(ok: boolean) {
  if (ok) cacheLife("minutes");
  else cacheLife("seconds");
}

export async function getHome(): Promise<HomeData | null> {
  "use cache";
  cacheTag("news");
  const result = await getJson<{ data: HomeData }>("public/home");
  lifetime(result.ok);
  return result.ok ? result.data.data : null;
}

export async function getCategories(): Promise<NewsCategory[]> {
  "use cache";
  cacheTag("news", "categories");
  const result = await getJson<{ data: NewsCategory[] }>("public/categories");
  lifetime(result.ok);
  return result.ok ? result.data.data : [];
}

export async function getAreas(): Promise<AreaGroup[]> {
  "use cache";
  cacheTag("areas");
  const result = await getJson<{ data: AreaGroup[] }>("public/areas");
  if (result.ok) cacheLife("days");
  else cacheLife("seconds");
  return result.ok ? result.data.data : [];
}

export interface ArticleListQuery {
  category?: string;
  area?: string;
  tag?: string;
  q?: string;
  page?: number;
}

export async function getArticles(query: ArticleListQuery): Promise<Paginated<PublicArticle> | null> {
  "use cache";
  cacheTag("news");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && value !== null) params.set(key, String(value));
  }
  const result = await getJson<Paginated<PublicArticle>>(`public/articles?${params.toString()}`);
  lifetime(result.ok);
  return result.ok ? result.data : null;
}

export type ArticlePage = { article: PublicArticle; related: PublicArticle[] } | "not-found" | null;

export async function getArticle(slug: string): Promise<ArticlePage> {
  "use cache";
  cacheTag("news", `article-${slug}`);
  const result = await getJson<{ data: PublicArticle; related: PublicArticle[] }>(`public/articles/${encodeURIComponent(slug)}`);
  lifetime(result.ok || (!result.ok && result.status === 404));
  if (result.ok) return { article: result.data.data, related: result.data.related };
  return result.status === 404 ? "not-found" : null;
}

export async function getTag(slug: string): Promise<{ name: string; slug: string } | null> {
  "use cache";
  cacheTag("news");
  const result = await getJson<{ data: { name: string; slug: string } }>(`public/tags/${encodeURIComponent(slug)}`);
  lifetime(result.ok);
  return result.ok ? result.data.data : null;
}

export function articleHref(article: Pick<PublicArticle, "slug" | "category">): string {
  return `/news/${article.category?.slug ?? "local"}/${article.slug}`;
}
