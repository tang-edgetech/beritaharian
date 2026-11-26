"use client";

import { createApiClient, type AuthResult, type User } from "@cendol/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/*
  Reader sign-in on the public site. The token lives in this browser only (localStorage);
  a half-finished sign-in (waiting for a code) lives in sessionStorage until it is completed.
*/

const TOKEN_KEY = "cendol-reader-token";
const PENDING_KEY = "cendol-reader-pending";
const USER_KEY = "cendol-reader-user";

export interface PendingSignIn {
  status: "verification_required" | "two_factor_required";
  token: string;
  destination?: string | null;
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(kind: "local" | "session", key: string): string | null {
  try {
    return (kind === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(kind: "local" | "session", key: string, value: string | null) {
  try {
    const store = kind === "local" ? localStorage : sessionStorage;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* storage blocked: the reader signs in again next time */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export const session = {
  token: () => read("local", TOKEN_KEY),
  pending: (): PendingSignIn | null => {
    const raw = read("session", PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSignIn) : null;
  },
  user: (): Pick<User, "name" | "email"> | null => {
    const raw = read("local", USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  signIn(token: string, user: User) {
    write("session", PENDING_KEY, null);
    write("local", USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
    write("local", TOKEN_KEY, token);
  },
  setPending: (pending: PendingSignIn | null) => write("session", PENDING_KEY, pending ? JSON.stringify(pending) : null),
  clear() {
    write("local", TOKEN_KEY, null);
    write("local", USER_KEY, null);
    write("session", PENDING_KEY, null);
  },
};

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Calls the API as the reader (or with the half-finished sign-in token while a code is pending). */
export const readerApi = createApiClient({
  baseUrl,
  getToken: () => session.pending()?.token ?? session.token(),
  onUnauthenticated: () => session.clear(),
});

const userSnapshot = () => read("local", USER_KEY);

/** The signed-in reader's name, or null. Safe during server rendering (returns null there). */
export function useReader(): Pick<User, "name" | "email"> | null {
  const raw = useSyncExternalStore(subscribe, userSnapshot, () => null);
  return raw ? JSON.parse(raw) : null;
}

const RETURN_KEY = "cendol-reader-return";

/** Remember where to come back to after signing in (only paths on this site). */
export function rememberReturn(path: string) {
  if (path.startsWith("/") && !path.startsWith("//")) write("session", RETURN_KEY, path);
}

/** Sends a signed-out reader to sign in, then back to `path`. Returns true when it redirected. */
export function requireReader(router: { replace: (href: string) => void }, path: string): boolean {
  if (session.token()) return false;
  rememberReturn(path);
  router.replace("/login");
  return true;
}

/** For pages that need a signed-in reader: sends others to sign in (and back). True once someone is signed in. */
export function useRequireReader(path: string): boolean {
  const router = useRouter();
  const reader = useReader();
  useEffect(() => {
    requireReader(router, path);
  }, [router, path]);
  return reader !== null;
}

function takeReturn(): string {
  const path = read("session", RETURN_KEY);
  write("session", RETURN_KEY, null);
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/account";
}

/** What to do after the API answers a sign-in, sign-up or code step. Returns where to go next. */
export function nextStepAfter(result: AuthResult): string {
  if (result.status === "authenticated") {
    session.signIn(result.token, result.user);
    return takeReturn();
  }
  session.setPending({ status: result.status, token: result.token, destination: result.status === "verification_required" ? result.destination : null });
  return result.status === "verification_required" ? "/verify" : "/two-factor";
}
