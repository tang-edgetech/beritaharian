"use client";

import type { Query } from "@cendol/api-client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export interface ListingParams {
  q: string;
  filters: Record<string, string>;
  sort: string;
  page: number;
  perPage: number;
}

const RESERVED = new Set(["q", "sort", "page", "per_page"]);

/**
 * Listing state lives in the address bar (?q=ali&status=active&sort=-name&page=2&per_page=50),
 * so a filtered list can be bookmarked, shared, and survives the back button.
 */
export function useListingParams(filterKeys: string[], defaults: { sort: string; perPage: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const params = useMemo<ListingParams>(() => {
    const filters: Record<string, string> = {};
    for (const key of filterKeys) {
      const value = search.get(key);
      if (value) filters[key] = value;
    }
    const perPage = Number(search.get("per_page"));
    return {
      q: search.get("q") ?? "",
      filters,
      sort: search.get("sort") ?? defaults.sort,
      page: Math.max(1, Number(search.get("page")) || 1),
      perPage: (PER_PAGE_OPTIONS as readonly number[]).includes(perPage) ? perPage : defaults.perPage,
    };
  }, [search, filterKeys, defaults.sort, defaults.perPage]);

  const update = useCallback(
    (changes: Partial<{ q: string; sort: string; page: number; perPage: number; filters: Record<string, string | null> }>) => {
      const next = new URLSearchParams(search.toString());
      const set = (key: string, value: string | number | null | undefined) => {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      };

      if (changes.q !== undefined) set("q", changes.q);
      if (changes.sort !== undefined) set("sort", changes.sort === defaults.sort ? null : changes.sort);
      if (changes.perPage !== undefined) set("per_page", changes.perPage === defaults.perPage ? null : changes.perPage);
      if (changes.filters) {
        for (const [key, value] of Object.entries(changes.filters)) set(key, value);
      }
      // any change other than moving between pages starts again from page 1
      set("page", changes.page !== undefined && changes.page > 1 ? changes.page : null);

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [search, router, pathname, defaults.sort, defaults.perPage],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    for (const [key, value] of search.entries()) {
      if (!filterKeys.includes(key) && !RESERVED.has(key)) next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [search, filterKeys, router, pathname]);

  return { params, update, clearAll };
}

/** Turns listing params into the API's query format: filter[q], filter[status], sort, page, per_page. */
export function toApiQuery(params: ListingParams, extra: Query = {}): Query {
  const query: Query = { ...extra, sort: params.sort, page: params.page, per_page: params.perPage };
  if (params.q) query["filter[q]"] = params.q;
  for (const [key, value] of Object.entries(params.filters)) query[`filter[${key}]`] = value;
  return query;
}
