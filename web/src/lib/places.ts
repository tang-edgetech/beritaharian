import type { PlaceCard, PlaceDetail, PlacePin, PublicReview, Sector, SimplePage } from "@cendol/api-client";
import { cacheLife, cacheTag } from "next/cache";
import { placeQuery, type PlaceFilters } from "./place-links";

/*
  Places for the public site, fetched on the server and cached for a minute.
  The API asks the site to drop "places" / "place-{slug}" as soon as a listing or review changes.
  "Near me" and other per-reader lists are fetched in the browser instead (see places-explorer).
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

function lifetime(ok: boolean) {
  if (ok) cacheLife("minutes");
  else cacheLife("seconds");
}

export async function getSectors(): Promise<Sector[]> {
  "use cache";
  cacheTag("places", "sectors");
  const result = await getJson<{ data: Sector[] }>("public/sectors");
  lifetime(result.ok);
  return result.ok ? result.data.data : [];
}

export async function getPlaces(filters: PlaceFilters): Promise<SimplePage<PlaceCard> | null> {
  "use cache";
  cacheTag("places");
  const result = await getJson<SimplePage<PlaceCard>>(`public/places?${placeQuery(filters, { per_page: 20 })}`);
  lifetime(result.ok);
  return result.ok ? result.data : null;
}

export async function getPins(filters: PlaceFilters): Promise<PlacePin[]> {
  "use cache";
  cacheTag("places");
  const result = await getJson<{ data: PlacePin[] }>(`public/places/pins?${placeQuery({ ...filters, page: undefined })}`);
  lifetime(result.ok);
  return result.ok ? result.data.data : [];
}

export async function getPlace(slug: string): Promise<PlaceDetail | "not-found" | null> {
  "use cache";
  cacheTag("places", `place-${slug}`);
  const result = await getJson<{ data: PlaceDetail }>(`public/places/${encodeURIComponent(slug)}`);
  lifetime(result.ok || (!result.ok && result.status === 404));
  if (result.ok) return result.data.data;
  return result.status === 404 ? "not-found" : null;
}

export type ReviewSort = "newest" | "helpful" | "highest" | "lowest";

export async function getPlaceReviews(slug: string, sort: ReviewSort, rating: number, page: number): Promise<SimplePage<PublicReview> | null> {
  "use cache";
  cacheTag("places", `place-${slug}`);
  const params = new URLSearchParams({ sort });
  if (rating) params.set("rating", String(rating));
  if (page > 1) params.set("page", String(page));
  const result = await getJson<SimplePage<PublicReview>>(`public/places/${encodeURIComponent(slug)}/reviews?${params.toString()}`);
  lifetime(result.ok);
  return result.ok ? result.data : null;
}
