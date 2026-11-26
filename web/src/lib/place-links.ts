import type { CategoryColor, PlaceCard, Sector } from "@cendol/api-client";

/*
  Helpers for places that work on the server and in the browser.
  Filters that belong in a shareable link live in the address; the reader's location never does.
*/

export function placeHref(sector: string | null | undefined, slug: string): string {
  return `/places/${sector ?? "all"}/${slug}`;
}

export type PlaceSort = "recommended" | "rating" | "distance" | "newest" | "name";

export const SORTS: { value: PlaceSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "A to Z" },
];

export interface PlaceFilters {
  sector?: string;
  area?: string;
  q?: string;
  open_now?: boolean;
  sort?: PlaceSort;
  page?: number;
  /** filterable sector details, e.g. { halal: "1", cuisine: "Nyonya" } */
  details?: Record<string, string>;
}

/** Turns filters into the API's query string (details[halal]=1 style). Location is added separately. */
export function placeQuery(filters: PlaceFilters, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  if (filters.sector) params.set("sector", filters.sector);
  if (filters.area) params.set("area", filters.area);
  if (filters.q) params.set("q", filters.q);
  if (filters.open_now) params.set("open_now", "1");
  if (filters.sort && filters.sort !== "recommended") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  for (const [key, value] of Object.entries(filters.details ?? {})) {
    if (value !== "") params.set(`details[${key}]`, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

/** Reads filters from a page address (?q=&area=&open=1&sort=&page=&halal=1). Detail keys come from the sector's fields. */
export function filtersFromSearch(search: Record<string, string | string[] | undefined>, sector: Sector | null): PlaceFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const details: Record<string, string> = {};
  for (const field of sector?.fields ?? []) {
    if (field.filterable && one(search[field.key])) details[field.key] = one(search[field.key]);
  }
  const sort = one(search.sort) as PlaceSort;
  return {
    sector: sector?.slug,
    area: one(search.area) || undefined,
    q: one(search.q) || undefined,
    open_now: one(search.open) === "1",
    sort: SORTS.some((s) => s.value === sort) ? sort : "recommended",
    page: Math.max(1, Number(one(search.page)) || 1),
    details,
  };
}

/** The page address for a set of filters (what goes in the browser's address bar). */
export function pageAddress(filters: PlaceFilters): string {
  const base = filters.sector ? `/places/${filters.sector}` : "/places";
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.area) params.set("area", filters.area);
  if (filters.open_now) params.set("open", "1");
  for (const [key, value] of Object.entries(filters.details ?? {})) if (value) params.set(key, value);
  if (filters.sort && filters.sort !== "recommended" && filters.sort !== "distance") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

export const ratingText = (avg: number, count: number) => (count ? `${avg.toFixed(1)} from ${count} ${count === 1 ? "review" : "reviews"}` : "No reviews yet");

export function cardTone(card: Pick<PlaceCard, "sector">): CategoryColor {
  return card.sector?.color ?? "marigold";
}

/** Directions from wherever the reader is, in the map app on their phone. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

/** WhatsApp link from a Malaysian number like 012-345 6789. */
export function whatsappUrl(number: string): string {
  let digits = number.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `6${digits}`;
  return `https://wa.me/${digits}`;
}

export function telUrl(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export function webUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export const REVIEW_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  visible: { label: "Live", tone: "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100" },
  pending: { label: "Checking your receipt", tone: "bg-marigold-100 text-marigold-800 dark:bg-gula-800 dark:text-marigold-100" },
  held: { label: "Waiting for a moderator", tone: "bg-marigold-100 text-marigold-800 dark:bg-gula-800 dark:text-marigold-100" },
  returned: { label: "Sent back", tone: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  removed: { label: "Taken down", tone: "bg-santan-200 text-santan-800 dark:bg-santan-800 dark:text-santan-100" },
};

export const CLAIM_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "Being checked", tone: "bg-marigold-100 text-marigold-800 dark:bg-gula-800 dark:text-marigold-100" },
  approved: { label: "Approved", tone: "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100" },
  rejected: { label: "Not approved", tone: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

export const REPORT_REASONS = [
  { value: "fake", label: "Fake or not a real visit" },
  { value: "offensive", label: "Rude or hateful" },
  { value: "personal", label: "Shares personal information" },
  { value: "unrelated", label: "Not about this place" },
  { value: "other", label: "Something else" },
] as const;
