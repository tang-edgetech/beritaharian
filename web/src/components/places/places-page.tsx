import { getAreas } from "@/lib/news";
import { filtersFromSearch } from "@/lib/place-links";
import { getPins, getPlaces, getSectors } from "@/lib/places";
import type { SearchParams } from "@/types/routes";
import { notFound } from "next/navigation";
import { PlacesExplorer } from "./places-explorer";
import { FlashMessage } from "../site/flash-message";

/** The Peta Melaka list page, shared by /places and /places/[sector]. The first page is rendered here for search engines. */
export async function PlacesPageBody({ sectorSlug, searchParams }: { sectorSlug: string | null; searchParams: SearchParams }) {
  const [sectors, areas, search] = await Promise.all([getSectors(), getAreas(), searchParams]);
  const sector = sectorSlug ? (sectors.find((s) => s.slug === sectorSlug) ?? null) : null;
  if (sectorSlug && !sector) notFound();

  const filters = filtersFromSearch(search, sector);
  const [page, pins] = await Promise.all([getPlaces(filters), getPins(filters)]);

  return (
    <div className="places-page site-container flex flex-col gap-5 pt-6">
      <FlashMessage />
      <header className="places-header flex flex-col gap-1">
        <h1 className="page-heading">{sector ? sector.name : "Places in Melaka"}</h1>
        <p className="page-lead">
          {sector?.description ?? "Hawker stalls, cafés, stays and services across Melaka. Reviews come only from people who really visited."}
        </p>
      </header>
      <PlacesExplorer sectors={sectors} areas={areas} sector={sector} filters={filters} page={page} pins={pins} />
    </div>
  );
}

export function PlacesSkeleton() {
  return (
    <div className="places-page site-container flex flex-col gap-5 pt-6" aria-busy>
      <div className="h-10 w-64 animate-pulse rounded-xl bg-santan-200 dark:bg-santan-800" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
          ))}
        </div>
        <div className="order-first h-[42vh] animate-pulse rounded-card bg-santan-100 lg:order-last lg:h-[70vh] dark:bg-santan-900" />
      </div>
    </div>
  );
}
