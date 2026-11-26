"use client";

import type { AlertCard, AlertPin, AreaGroup, IncidentType, SimplePage } from "@cendol/api-client";
import { MapView, type MapPin as MapPinData, type MapPoint } from "@cendol/map";
import { ChevronLeft, ChevronRight, Loader2, LocateFixed, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { alertHref, alertQuery, alertsAddress, type AlertFilters, type AlertStateFilter } from "@/lib/alert-links";
import { toneFor } from "../news/category-tone";
import { AlertCardItem, IncidentIcon } from "./alert-bits";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

interface ExplorerProps {
  types: IncidentType[];
  areas: AreaGroup[];
  filters: AlertFilters;
  page: SimplePage<AlertCard> | null;
  pins: AlertPin[];
}

/**
 * Peta Melaka for verified alerts: the list beside the map on a computer; on a phone the map fills
 * the top half and the list sits on a sheet below it. Filters live in the address (shareable);
 * "Near me" stays in this browser only, so the reader's location never ends up in a link.
 */
export function AlertsExplorer({ types, areas, filters: serverFilters, page, pins }: ExplorerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(serverFilters);
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [me, setMe] = useState<MapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearPageNo, setNearPageNo] = useState(1);
  const [near, setNear] = useState<{ key: string; data: SimplePage<AlertCard> | null } | null>(null);
  const nearKey = me ? alertQuery({ ...filters, page: nearPageNo }, { lat: me.latitude.toFixed(5), lng: me.longitude.toFixed(5), sort: "distance", per_page: 20 }) : null;

  // "near me": the list comes straight from the API in this browser, nearest first
  useEffect(() => {
    if (!nearKey) return;
    const controller = new AbortController();
    fetch(`${API}/public/alerts?${nearKey}`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<SimplePage<AlertCard>>) : null))
      .then((data) => setNear({ key: nearKey, data }))
      .catch(() => {
        if (!controller.signal.aborted) setNear({ key: nearKey, data: null });
      });
    return () => controller.abort();
  }, [nearKey]);

  const nearLoading = nearKey !== null && near?.key !== nearKey;
  const list = me ? (near?.data ?? null) : page;
  const listLoading = pending || nearLoading;

  // pins take their type's colour; resolved ones are greyed out
  const mapPins = useMemo<MapPinData[]>(
    () => pins.map((p) => ({ id: p.ref, latitude: p.latitude, longitude: p.longitude, label: p.state === "resolved" ? `${p.title} (resolved)` : p.title, tone: p.state === "resolved" ? "santan" : (p.color ?? "satay") })),
    [pins],
  );
  const selectedCard = list?.data.find((c) => c.ref === selectedRef) ?? null;
  const selectedPin = pins.find((p) => p.ref === selectedRef) ?? null;
  const resolved = filters.state === "resolved";

  function go(next: Partial<AlertFilters>) {
    const merged: AlertFilters = { ...filters, page: 1, ...next };
    setSelectedRef(null);
    setNearPageNo(1);
    startTransition(() => {
      setOptimisticFilters(merged);
      router.replace(alertsAddress(merged), { scroll: false });
    });
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

  function choose(ref: string) {
    setSelectedRef(ref);
    rootRef.current?.querySelector(`[data-alert="${CSS.escape(ref)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const currentPage = me ? nearPageNo : (filters.page ?? 1);
  const lastPage = list?.meta.last_page ?? 1;
  const toPage = (n: number) => (me ? setNearPageNo(n) : go({ page: n }));
  const typeName = types.find((t) => t.slug === filters.type)?.name;

  return (
    <div ref={rootRef} className="alerts-explorer flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6">
      {/* phone: the map fills the top half; computer: beside the list */}
      <div className="alerts-map-column order-first -mx-4 sm:mx-0 lg:sticky lg:top-4 lg:order-last">
        <MapView
          label={resolved ? "Map of resolved alerts in Melaka" : "Map of active alerts in Melaka"}
          pins={mapPins}
          cluster
          fitToPins
          selectedId={selectedRef}
          onSelect={choose}
          userLocation={me}
          focus={me ? { ...me, zoom: 14 } : null}
          className="alerts-map h-[50dvh] min-h-64 sm:rounded-card sm:border sm:border-santan-200 lg:h-[calc(100dvh-8rem)] dark:sm:border-santan-800"
        />
      </div>

      {/* phone: a sheet pulled up over the bottom of the map */}
      <div className="alerts-sheet relative z-10 -mx-4 -mt-5 flex min-w-0 flex-col gap-4 rounded-t-3xl bg-santan-50 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] sm:mx-0 sm:rounded-card sm:px-0 sm:shadow-none lg:mt-0 lg:bg-transparent dark:bg-santan-950 lg:dark:bg-transparent">
        <span className="alerts-sheet-handle mx-auto h-1.5 w-12 rounded-full bg-santan-300 sm:hidden dark:bg-santan-700" aria-hidden />

        <div className="alerts-state-switch inline-flex self-start rounded-full bg-santan-200 p-1 dark:bg-santan-800" role="group" aria-label="Show alerts">
          {(["active", "resolved"] as AlertStateFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => go({ state: s })}
              aria-pressed={(filters.state ?? "active") === s}
              className={`alerts-state-option inline-flex h-8 items-center rounded-full px-4 text-sm font-bold ${(filters.state ?? "active") === s ? "is-active bg-white text-gula-900 shadow dark:bg-santan-950 dark:text-coconut" : "text-santan-600 dark:text-santan-300"}`}
            >
              {s === "active" ? "Active" : "Resolved"}
            </button>
          ))}
        </div>

        <nav className="alert-type-chips -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Kinds of alerts">
          <TypeLink href={alertsAddress({ ...filters, type: undefined, page: 1 })} active={!filters.type} label="All" icon="triangle-alert" />
          {types.map((t) => (
            <TypeLink key={t.slug} href={alertsAddress({ ...filters, type: t.slug, page: 1 })} active={filters.type === t.slug} label={t.name} icon={t.icon} tone={t.color} />
          ))}
        </nav>

        <fieldset className="alerts-filters flex flex-wrap items-center gap-2" disabled={pending}>
          <legend className="sr-only">Filters</legend>
          <button
            type="button"
            onClick={nearMe}
            aria-pressed={Boolean(me)}
            title={me ? "Stop sorting by distance" : "Show the nearest alerts first"}
            className={`filter-near-me inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${me ? "is-on border-pandan-600 bg-pandan-600 text-white" : "border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"}`}
          >
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            {me ? "Near me ✓" : "Near me"}
          </button>
          <label className="filter-area inline-flex">
            <span className="sr-only">Area</span>
            <select value={filters.area ?? ""} onChange={(e) => go({ area: e.target.value || undefined })} className="filter-select h-9 max-w-48 rounded-full border border-santan-300 bg-white px-3 text-sm font-semibold dark:border-santan-700 dark:bg-santan-950">
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
          </label>
          {filters.area || filters.type ? (
            <button type="button" onClick={() => go({ area: undefined, type: undefined })} className="filter-clear inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
              <X className="size-4" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </fieldset>
        {locationError ? (
          <p className="alerts-location-error rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
            {locationError}
          </p>
        ) : null}

        <p className="alerts-count text-sm text-santan-600 dark:text-santan-300" aria-live="polite">
          {listLoading
            ? "Looking…"
            : list
              ? `${list.meta.total} ${resolved ? "resolved" : "active"} ${list.meta.total === 1 ? "alert" : "alerts"}${typeName ? ` · ${typeName}` : ""}${me ? ", nearest first" : ""}`
              : ""}
        </p>

        <div className={`alerts-list flex flex-col gap-3 transition-opacity ${listLoading ? "is-loading opacity-60" : ""}`} aria-busy={listLoading}>
          {!list && !listLoading ? (
            <p className="alerts-list-error rounded-card bg-marigold-50 p-5 text-sm dark:bg-gula-900">We couldn&apos;t load alerts. Please try again in a minute.</p>
          ) : list && list.data.length === 0 ? (
            <div className="alerts-list-empty flex flex-col items-start gap-3 rounded-card bg-santan-100 p-6 text-santan-600 dark:bg-santan-900 dark:text-santan-300">
              <p>{resolved ? "No resolved alerts match these filters." : "No active alerts here right now. That's good news."}</p>
              <Link href="/report" className="font-bold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
                Seen something? Report it
              </Link>
            </div>
          ) : (
            list?.data.map((card) => (
              <div key={card.ref} onMouseEnter={() => setSelectedRef(card.ref)} className="alerts-list-item">
                <AlertCardItem alert={card} selected={card.ref === selectedRef} />
              </div>
            ))
          )}
        </div>

        {lastPage > 1 ? (
          <nav className="alerts-pager flex items-center justify-between gap-4 border-t border-santan-200 pt-4 dark:border-santan-800" aria-label="More alerts">
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

        <Link href="/report" className="alerts-report-link inline-flex h-11 items-center gap-1.5 self-start rounded-full bg-satay-500 px-5 text-sm font-bold text-white hover:bg-satay-700">
          <Plus className="size-4" aria-hidden />
          Report something
        </Link>
      </div>

      {/* phone: the chosen pin slides up as a card above the tab bar */}
      {selectedPin ? (
        <div className="alert-pin-sheet fixed inset-x-3 bottom-20 z-30 lg:hidden" role="dialog" aria-label={selectedPin.title}>
          <div className="relative">
            {selectedCard ? (
              <AlertCardItem alert={selectedCard} selected compact />
            ) : (
              <div className="rounded-card border border-pandan-500 bg-white p-4 shadow-lg dark:bg-santan-900">
                <p className="font-display text-lg font-black">{selectedPin.title}</p>
                <Link href={alertHref(selectedPin.ref)} className="text-sm font-bold text-pandan-700 underline dark:text-pandan-300">
                  Open this alert
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedRef(null)}
              className="alert-pin-sheet-close absolute -top-3 -right-1 z-10 inline-flex size-8 items-center justify-center rounded-full bg-gula-900 text-coconut shadow"
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

function TypeLink({ href, active, label, icon, tone }: { href: string; active: boolean; label: string; icon: string; tone?: IncidentType["color"] }) {
  const t = toneFor(tone ?? "santan");
  return (
    <Link
      href={href}
      scroll={false}
      replace
      aria-current={active ? "page" : undefined}
      className={[
        "alert-type-link inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap",
        active ? "is-active bg-gula-900 text-coconut dark:bg-marigold-400 dark:text-gula-900" : `${t.chip} hover:opacity-80`,
      ].join(" ")}
    >
      <IncidentIcon icon={icon} className="size-4" />
      {label}
    </Link>
  );
}
