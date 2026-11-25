"use client";

import { useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Counts one read per story per day from this browser, for the "Hari ini" most-read list. Draws nothing. */
export function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `cendol-read:${slug}:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* private mode: still count once per page view */
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* not important */
      }
      void fetch(`${API}/public/articles/${encodeURIComponent(slug)}/view`, { method: "POST", headers: { Accept: "application/json" }, keepalive: true }).catch(() => undefined);
    }, 4000); // only count people who stay a few seconds
    return () => clearTimeout(timer);
  }, [slug]);

  return null;
}
