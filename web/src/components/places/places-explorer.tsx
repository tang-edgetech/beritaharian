"use client";

import type { AreaGroup, PlaceCard, PlacePin, Sector, SimplePage } from "@cendol/api-client";
import { MapView, type MapPin as MapPinData, type MapPoint } from "@cendol/map";
import { ChevronLeft, ChevronRight, Loader2, LocateFixed, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import { pageAddress, placeQuery, SORTS, type PlaceFilters, type PlaceSort } from "@/lib/place-links";
import { PlaceCardItem, SectorIcon } from "./place-bits";
import { toneFor } from "../news/category-tone";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

interface ExplorerProps {
  sectors: Sector[];
  areas: AreaGroup[];
  sector: Sector | null;
  filters: PlaceFilters;
  page: SimplePage<PlaceCard> | null;
  pins: PlacePin[];
}

/**
 * Peta Melaka: the list and the map side by side on a computer, the map on top and the list
 * below on a phone. Filters live in the address (shareable); "Near me" stays in this browser only.
 */
export function PlacesExplorer({ sectors, areas, sector, filters: serverFilters, page, pins }: ExplorerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // controls show the new choice at once while the page loads the matching places
  const [filters, setOptimisticFilters] = useOptimistic(serverFilters);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(filters.q ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<MapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearPageNo, setNearPageNo] = useState(1);
  const [near, setNear] = useState<{ key: string; data: SimplePage<PlaceCard> | null } | null>(null);
  const nearKey = me ? placeQuery({ ...filters, sort: "distance", page: nearPageNo }, { lat: me.latitude.toFixed(5), lng: me.longitude.toFixed(5), per_page: 20 }) : null;

  // "near me": the list comes straight from the API in this browser, sorted by distance
  useEffect(() => {
    if (!nearKey) return;
    const controller = new AbortController();
    fetch(`${API}/public/places?${nearKey}`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<SimplePage<PlaceCard>>) : null))
      .then((data) => setNear({ key: nearKey, data }))
      .catch(() => {
        if (!controller.signal.aborted) setNear({ key: nearKey, data: null });
      });
    return () => controller.abort();
  }, [nearKey]);

  const nearLoading = nearKey !== null && near?.key !== nearKey;
  const list = me ? (near?.data ?? null) : page;
  const listLoading = pending || nearLoading;

  const mapPins = useMemo<MapPinData[]>(() => pins.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude, label: p.name, tone: p.color })), [pins]);
  const selectedCard = list?.data.find((c) => c.id === selectedId) ?? null;
  const selectedPin = pins.find((p) => p.id === selectedId) ?? null;

  function go(next: Partial<PlaceFilters>) {
    const merged: PlaceFilters = { ...filters, page: 1, ...next };
    setSelectedId(null);
    setNearPageNo(1);
    startTransition(() => {
      setOptimisticFilters(merged);
      router.replace(pageAddress(merged), { scroll: false });
    });
  }

  function search(event: FormEvent) {
    event.preventDefault();
    go({ q: query.trim() || undefined });
  }

  function nearMe() {
    if (me) {
      setMe(null);
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocationError("This browser can't share your location.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setNearPageNo(1);
        setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationError("We couldn't get your location. Check that location is allowed for this site, then try again.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function choose(id: string) {
    setSelectedId(id);
    rootRef.current?.querySelector(`[id="place-${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const currentPage = me ? nearPageNo : (filters.page ?? 1);
  const lastPage = list?.meta.last_page ?? 1;
  const toPage = (n: number) => (me ? setNearPageNo(n) : go({ page: n }));
  const detailFields = (sector?.fields ?? []).filter((f) => f.filterable);
  const activeCount = [filters.area, filters.open_now, ...Object.values(filters.details ?? {})].filter(Boolean).length;

  return (
    <div ref={rootRef} className="places-explorer flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6">
      {/* map first on phones, beside the list on bigger screens */}
      <div className="places-map-column order-first lg:sticky lg:top-4 lg:order-last">
        <MapView
          label={sector ? `Map of ${sector.name.toLowerCase()} places` : "Map of places in Melaka"}
          pins={mapPins}
          cluster
          fitToPins
          selectedId={selectedId}
          onSelect={choose}
          userLocation={me}
          focus={me ? { ...me, zoom: 15 } : null}
          className="places-map h-[42vh] min-h-64 rounded-card border border-santan-200 lg:h-[calc(100dvh-8rem)] dark:border-santan-800"
        />
        <p className="places-map-note mt-1.5 text-xs text-santan-500">
          {pins.length === 1 ? "1 place on the map" : `${pins.length} places on the map`}. Tap a pin to see the place.
        </p>
      </div>

      <div className="places-list-column flex min-w-0 flex-col gap-4">
        <form className="places-search flex gap-2" role="search" onSubmit={search}>
          <label htmlFor="places-query" className="sr-only">
            Search places
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-santan-400" aria-hidden />
            <input
              id="places-query"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, food, street…"
              className="h-11 w-full rounded-full border border-santan-300 bg-white pr-4 pl-10 outline-none focus:border-pandan-500 focus:ring-2 focus:ring-pandan-200 dark:border-santan-700 dark:bg-santan-950"
            />
          </div>
          <button type="submit" className="inline-flex h-11 items-center rounded-full bg-gula-900 px-5 font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
            Search
          </button>
        </form>

        <nav className="sector-chips -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Kinds of places">
          <SectorLink href={pageAddress({ q: filters.q, area: filters.area, open_now: filters.open_now })} active={!sector} label="All" icon="store" />
          {sectors.map((s) => (
            <SectorLink key={s.slug} href={pageAddress({ sector: s.slug, q: filters.q, area: filters.area, open_now: filters.open_now })} active={sector?.slug === s.slug} label={s.name} icon={s.icon} tone={s.color} />
          ))}
        </nav>

        <fieldset className="places-filters flex flex-wrap items-center gap-2" disabled={pending}>
          <legend className="sr-only">Filters</legend>
          <button
            type="button"
            onClick={nearMe}
            aria-pressed={Boolean(me)}
            className={`filter-near-me inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${me ? "border-pandan-600 bg-pandan-600 text-white" : "border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"}`}
          >
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            {me ? "Near me ✓" : "Near me"}
          </button>
          <label className={`filter-open-now inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold ${filters.open_now ? "border-pandan-600 bg-pandan-50 text-pandan-800 dark:bg-pandan-950 dark:text-pandan-100" : "border-santan-300 dark:border-santan-700"}`}>
            <input type="checkbox" className="size-4 accent-pandan-600" checked={Boolean(filters.open_now)} onChange={(e) => go({ open_now: e.target.checked })} />
            Open now
          </label>
          <label htmlFor="places-area" className="sr-only">
            Area
          </label>
          <select id="places-area" value={filters.area ?? ""} onChange={(e) => go({ area: e.target.value || undefined })} className="filter-select h-9 max-w-44 rounded-full border border-santan-300 bg-white px-3 text-sm font-semibold dark:border-santan-700 dark:bg-santan-950">
            <option value="">All of Melaka</option>
            {areas.map((d) => (
              <optgroup key={d.slug} label={d.name}>
                <option value={d.slug}>All of {d.name}</option>
                {d.children.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {detailFields.map((field) =>
            field.type === "boolean" ? (
              <label key={field.key} className={`filter-detail inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold ${filters.details?.[field.key] ? "border-pandan-600 bg-pandan-50 text-pandan-800 dark:bg-pandan-950 dark:text-pandan-100" : "border-santan-300 dark:border-santan-700"}`}>
                <input
                  type="checkbox"
                  className="size-4 accent-pandan-600"
                  checked={filters.details?.[field.key] === "1"}
                  onChange={(e) => go({ details: { ...filters.details, [field.key]: e.target.checked ? "1" : "" } })}
                />
                {field.label}
              </label>
            ) : (
              <span key={field.key} className="filter-detail inline-flex">
                <label htmlFor={`filter-${field.key}`} className="sr-only">
                  {field.label}
                </label>
                <select
                  id={`filter-${field.key}`}
                  value={filters.details?.[field.key] ?? ""}
                  onChange={(e) => go({ details: { ...filters.details, [field.key]: e.target.value } })}
                  className="filter-select h-9 max-w-44 rounded-full border border-santan-300 bg-white px-3 text-sm font-semibold dark:border-santan-700 dark:bg-santan-950"
                >
                  <option value="">{field.label}: any</option>
                  {(field.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </span>
            ),
          )}
          {activeCount ? (
            <button type="button" onClick={() => go({ area: undefined, open_now: false, details: {} })} className="filter-clear inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
              <X className="size-4" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </fieldset>
        {locationError ? (
          <p className="places-location-error rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
            {locationError}
          </p>
        ) : null}

        <div className="places-list-head flex items-center justify-between gap-3">
          <p className="text-sm text-santan-600 dark:text-santan-300" aria-live="polite">
            {listLoading ? "Looking…" : list ? `${list.meta.total} ${list.meta.total === 1 ? "place" : "places"}${me ? ", nearest first" : ""}` : ""}
          </p>
          {me ? null : (
            <span className="inline-flex">
              <label htmlFor="places-sort" className="sr-only">
                Sort
              </label>
              <select id="places-sort" value={filters.sort ?? "recommended"} onChange={(e) => go({ sort: e.target.value as PlaceSort })} className="filter-select h-9 rounded-full border border-santan-300 bg-white px-3 text-sm font-semibold dark:border-santan-700 dark:bg-santan-950">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </span>
          )}
        </div>

        <div className={`places-list flex flex-col gap-3 transition-opacity ${listLoading ? "opacity-60" : ""}`} aria-busy={listLoading}>
          {!list && !listLoading ? (
            <p className="places-list-error rounded-card bg-marigold-50 p-5 text-sm dark:bg-gula-900">We couldn&apos;t load places. Please try again in a minute.</p>
          ) : list && list.data.length === 0 ? (
            <div className="places-list-empty flex flex-col items-start gap-3 rounded-card bg-santan-100 p-6 text-santan-600 dark:bg-santan-900 dark:text-santan-300">
              <p>No places match these filters yet.</p>
              <Link href="/places/add" className="font-bold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
                Know one? Add it to the map
              </Link>
            </div>
          ) : (
            list?.data.map((card) => (
              <div key={card.id} onMouseEnter={() => setSelectedId(card.id)} className="places-list-item">
                <PlaceCardItem card={card} selected={card.id === selectedId} />
              </div>
            ))
          )}
        </div>

        {lastPage > 1 ? (
          <nav className="places-pager flex items-center justify-between gap-4 border-t border-santan-200 pt-4 dark:border-santan-800" aria-label="More places">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => toPage(currentPage - 1)}
              className="pager-link inline-flex h-10 items-center gap-1 rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 disabled:invisible dark:border-santan-700 dark:hover:bg-santan-800"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </button>
            <span className="text-sm text-santan-500 tabular-nums">
              Page {currentPage} of {lastPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= lastPage}
              onClick={() => toPage(currentPage + 1)}
              className="pager-link inline-flex h-10 items-center gap-1 rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 disabled:invisible dark:border-santan-700 dark:hover:bg-santan-800"
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </nav>
        ) : null}

        <Link href="/places/add" className="places-add-link inline-flex items-center gap-1.5 self-start text-sm font-bold text-pandan-700 hover:underline dark:text-pandan-300">
          <Plus className="size-4" aria-hidden />
          Add a place to the map
        </Link>
      </div>

      {/* phone: the chosen pin slides up as a card above the tab bar */}
      {selectedPin ? (
        <div className="place-sheet fixed inset-x-3 bottom-20 z-30 lg:hidden" role="dialog" aria-label={selectedPin.name}>
          <div className="relative">
            {selectedCard ? (
              <PlaceCardItem card={selectedCard} selected compact />
            ) : (
              <div className="rounded-card border border-pandan-500 bg-white p-4 shadow-lg dark:bg-santan-900">
                <p className="font-display text-lg font-black">{selectedPin.name}</p>
                <Link href={`/places/${selectedPin.sector ?? "all"}/${selectedPin.slug}`} className="text-sm font-bold text-pandan-700 underline dark:text-pandan-300">
                  Open this place
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="place-sheet-close absolute -top-3 -right-1 z-10 inline-flex size-8 items-center justify-center rounded-full bg-gula-900 text-coconut shadow"
              aria-label="Close"
              title="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectorLink({ href, active, label, icon, tone }: { href: string; active: boolean; label: string; icon: string; tone?: Sector["color"] }) {
  const t = toneFor(tone ?? "pandan");
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={[
        "sector-chip-link inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap",
        active ? "is-active bg-gula-900 text-coconut dark:bg-marigold-400 dark:text-gula-900" : `${t.chip} hover:opacity-80`,
      ].join(" ")}
    >
      <SectorIcon icon={icon} className="size-4" />
      {label}
    </Link>
  );
}
