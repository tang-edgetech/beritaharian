"use client";

import type { MyPlaceStatus } from "@cendol/api-client";
import { useEffect, useSyncExternalStore } from "react";
import { readerApi, session, useReader } from "./auth";

/*
  What the signed-in reader has done on one place (their review, claim, helpful votes, reports).
  Fetched once per place and shared by every button on the page.
*/

type Entry = { status: MyPlaceStatus | null; loading: boolean };

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: Entry = { status: null, loading: false };

function load(slug: string, force = false) {
  if (!session.token()) return;
  if (inflight.has(slug) || (!force && entries.has(slug))) return;
  entries.set(slug, { status: entries.get(slug)?.status ?? null, loading: true });
  emit();
  const p = readerApi
    .get<{ data: MyPlaceStatus }>(`me/places/${encodeURIComponent(slug)}`)
    .then((r) => void entries.set(slug, { status: r.data, loading: false }))
    .catch(() => void entries.set(slug, { status: null, loading: false }))
    .finally(() => {
      inflight.delete(slug);
      emit();
    });
  inflight.set(slug, p);
}

/** Change the shared copy after an action (vote, report) without asking the server again. */
export function updatePlaceStatus(slug: string, change: (s: MyPlaceStatus) => MyPlaceStatus) {
  const current = entries.get(slug)?.status;
  if (!current) return;
  entries.set(slug, { status: change(current), loading: false });
  emit();
}

export function refreshPlaceStatus(slug: string) {
  load(slug, true);
}

export function usePlaceStatus(slug: string): Entry & { signedIn: boolean } {
  const reader = useReader();
  const entry = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => entries.get(slug) ?? EMPTY,
    () => EMPTY,
  );
  useEffect(() => {
    if (reader) load(slug);
  }, [reader, slug]);
  return { ...entry, signedIn: Boolean(reader) };
}
