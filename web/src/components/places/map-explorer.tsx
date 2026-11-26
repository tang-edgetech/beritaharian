"use client";

import type { PlaceDetail, PlacePin, Sector } from "@cendol/api-client";
import { MapView, type MapPoint } from "@cendol/map";
import { Layers, Loader2, LocateFixed, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { placeHref, ratingText } from "@/lib/place-links";
import { toneFor } from "../news/category-tone";
import { OpenNowLine, SectorChip, SectorIcon, Stars } from "./place-bits";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

/** The full-screen Peta Melaka map: every place, sector layers, "near me" and a card for the chosen pin. */
export function MapExplorer({ sectors, pins }: { sectors: Sector[]; pins: PlacePin[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [me, setMe] = useState<MapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);

  const visible = useMemo(() => pins.filter((p) => !hidden.has(p.sector ?? "")), [pins, hidden]);
  const mapPins = useMemo(() => visible.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude, label: p.name, tone: p.color })), [visible]);
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  // a little more about the chosen place (address, open now)
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`${API}/public/places/${encodeURIComponent(selected.slug)}`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ data: PlaceDetail }>) : null))
      .then((r) => setDetail(r?.data ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected]);

  function toggle(slug: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function nearMe() {
    if (!("geolocation" in navigator)) {
      setNotice("This browser can't share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setNotice(null);
        setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setNotice("We couldn't get your location. Check that location is allowed for this site.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const location = detail && selected && detail.slug === selected.slug ? (detail.locations.find((l) => l.id === selected.id) ?? detail.locations[0]) : null;

  return (
    <div className="map-explorer relative h-[calc(100dvh-7.5rem)] min-h-96 md:h-[calc(100dvh-9rem)]">
      <MapView
        label="Map of places in Melaka"
        pins={mapPins}
        cluster
        selectedId={selectedId}
        onSelect={(id) => {
          setDetail(null);
          setSelectedId(id);
        }}
        userLocation={me}
        focus={me ? { ...me, zoom: 15 } : null}
        className="size-full"
      />

      {/* controls float over the map */}
      <div className="map-controls pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-col items-end gap-2 sm:items-start">
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2 sm:justify-start sm:pl-12">
          <button
            type="button"
            onClick={nearMe}
            title="Show where I am"
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-md ${me ? "bg-pandan-600 text-white" : "bg-white text-gula-900 hover:bg-santan-100 dark:bg-santan-900 dark:text-coconut"}`}
          >
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            Near me
          </button>
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            aria-expanded={layersOpen}
            aria-controls="map-layers"
            title="Choose what the map shows"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-gula-900 shadow-md hover:bg-santan-100 dark:bg-santan-900 dark:text-coconut"
          >
            <Layers className="size-4" aria-hidden />
            Layers
          </button>
          <Link href="/places" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut shadow-md hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
            List view
          </Link>
        </div>
        {layersOpen ? (
          <div id="map-layers" className="map-layers pointer-events-auto w-64 rounded-card bg-white p-4 shadow-lg sm:ml-12 dark:bg-santan-900">
            <p className="mb-2 text-sm font-black">Places</p>
            <ul className="flex flex-col gap-1.5">
              {sectors.map((s) => (
                <li key={s.slug}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={!hidden.has(s.slug)} onChange={() => toggle(s.slug)} className="size-4 accent-pandan-600" />
                    <span className={`inline-flex size-6 items-center justify-center rounded-full ${toneFor(s.color).chip}`}>
                      <SectorIcon icon={s.icon} className="size-3.5" />
                    </span>
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-3 mb-1 text-sm font-black">Community reports</p>
            <label className="flex items-center gap-2 text-sm text-santan-500">
              <input type="checkbox" disabled className="size-4" />
              Coming soon
            </label>
          </div>
        ) : null}
        {notice ? (
          <p className="pointer-events-auto rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800 shadow sm:ml-12 dark:bg-red-950 dark:text-red-200" role="alert">
            {notice}
          </p>
        ) : null}
      </div>

      <p className="map-count absolute bottom-3 left-3 z-[500] rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow dark:bg-santan-900/90">
        {visible.length} {visible.length === 1 ? "place" : "places"}
      </p>

      {selected ? (
        <div className="map-place-card absolute inset-x-3 bottom-12 z-[600] sm:right-auto sm:bottom-10 sm:left-3 sm:w-96" role="dialog" aria-label={selected.name}>
          <div className="relative flex flex-col gap-2 rounded-card bg-white p-4 shadow-xl dark:bg-santan-900">
            <button type="button" onClick={() => setSelectedId(null)} className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full hover:bg-santan-100 dark:hover:bg-santan-800" aria-label="Close" title="Close">
              <X className="size-4" aria-hidden />
            </button>
            {detail?.sector ? <SectorChip sector={detail.sector} /> : null}
            <p className="pr-8 font-display text-lg leading-snug font-black text-gula-900 dark:text-coconut">{selected.name}</p>
            <p className="flex items-center gap-2 text-sm">
              {detail?.rating_count ? <Stars value={detail.rating_avg} /> : null}
              <span>{detail ? ratingText(detail.rating_avg, detail.rating_count) : "…"}</span>
            </p>
            {location ? (
              <>
                <OpenNowLine open={location.open_now} label={location.hours_today} />
                <p className="flex items-start gap-1 text-sm text-santan-600 dark:text-santan-300">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {location.address}
                </p>
              </>
            ) : null}
            <Link href={placeHref(selected.sector, selected.slug)} className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
              Open this place
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
