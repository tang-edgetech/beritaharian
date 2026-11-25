import type { ArticleStatus, AreaGroup, CategoryColor, NewsCategory, NewsSummary, SourceKind, TruthLabel } from "@cendol/api-client";
import type { StatusTone } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const ARTICLE_STATUS: Record<ArticleStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  in_review: { label: "Waiting for fact-check", tone: "warning" },
  verified: { label: "Verified, ready to publish", tone: "good" },
  scheduled: { label: "Scheduled", tone: "warning" },
  published: { label: "Live", tone: "good" },
  archived: { label: "Archived", tone: "danger" },
};

export const TRUTH_LABEL: Record<TruthLabel, { label: string; tone: StatusTone }> = {
  verified: { label: "Verified", tone: "good" },
  developing: { label: "Developing", tone: "warning" },
  corrected: { label: "Corrected", tone: "neutral" },
};

export const SOURCE_KINDS: { value: SourceKind; label: string }[] = [
  { value: "official", label: "Official statement" },
  { value: "witness", label: "Witness" },
  { value: "document", label: "Document" },
  { value: "media", label: "Other media" },
];

export const CATEGORY_COLORS: { value: CategoryColor; label: string; swatch: string }[] = [
  { value: "pandan", label: "Pandan green", swatch: "bg-pandan-600" },
  { value: "marigold", label: "Marigold", swatch: "bg-marigold-400" },
  { value: "gula", label: "Gula melaka", swatch: "bg-gula-700" },
  { value: "satay", label: "Satay orange", swatch: "bg-satay-500" },
  { value: "santan", label: "Santan grey", swatch: "bg-santan-500" },
];

/** The public site's address for a story, for "View on site" links. */
export function publicArticleUrl(category: string | undefined | null, slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/news/${category ?? "local"}/${slug}`;
}

export function useNewsCategories() {
  return useQuery({
    queryKey: ["news-categories"],
    queryFn: () => api.get<{ data: NewsCategory[] }>("admin/news/categories").then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: () => api.get<{ data: AreaGroup[] }>("admin/news/areas").then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

export function useNewsSummary(enabled = true) {
  return useQuery({
    queryKey: ["news-summary"],
    queryFn: () => api.get<{ data: NewsSummary }>("admin/news/summary").then((r) => r.data),
    enabled,
    refetchInterval: 60_000,
  });
}
