import { createApiClient } from "@cendol/api-client";
import { useSyncExternalStore } from "react";

const TOKEN_KEY = "cendol-admin-token";
const PENDING_KEY = "cendol-admin-pending-sign-in";

/** A sign-in that still needs a step (verify account or two-step code). */
export interface PendingSignIn {
  status: "verification_required" | "two_factor_required";
  token: string;
  destination?: string | null;
  login?: string;
}

type Storage = "local" | "session";

function read(storage: Storage, key: string): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function write(storage: Storage, key: string, value: string | null) {
  try {
    const store = storage === "local" ? localStorage : sessionStorage;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* storage blocked: the person will simply need to sign in again */
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // another tab signed in or out
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export const tokenStore = {
  get: () => read("local", TOKEN_KEY),
  set: (token: string | null) => write("local", TOKEN_KEY, token),
};

export const pendingStore = {
  raw: () => read("session", PENDING_KEY),
  get(): PendingSignIn | null {
    const raw = read("session", PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSignIn) : null;
  },
  set: (pending: PendingSignIn | null) => write("session", PENDING_KEY, pending ? JSON.stringify(pending) : null),
};

const noop = () => () => {};

/** False while the page is being prepared on the server or hydrated; true once it runs in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** The stored full-access token, kept in step with sign-in and sign-out (also in other tabs). */
export function useStoredToken(): string | null {
  return useSyncExternalStore(subscribe, tokenStore.get, () => null);
}

/** The half-finished sign-in, if any. */
export function usePendingSignIn(): PendingSignIn | null {
  const raw = useSyncExternalStore(subscribe, pendingStore.raw, () => null);
  return raw ? (JSON.parse(raw) as PendingSignIn) : null;
}

let unauthenticatedHandler: (() => void) | null = null;
export function onUnauthenticated(handler: () => void) {
  unauthenticatedHandler = handler;
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = createApiClient({
  baseUrl,
  getToken: () => pendingStore.get()?.token ?? tokenStore.get(),
  onUnauthenticated: () => unauthenticatedHandler?.(),
});

/** Same client, but always with the full-access token (ignores a half-finished sign-in). */
export const sessionApi = createApiClient({
  baseUrl,
  getToken: () => tokenStore.get(),
  onUnauthenticated: () => unauthenticatedHandler?.(),
});
