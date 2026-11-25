"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

/** Most readers pass stories on through WhatsApp, so it comes first. */
export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${site}${path}`;
  const encoded = encodeURIComponent(url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const button =
    "share-button inline-flex h-9 items-center gap-2 rounded-full border border-santan-300 px-3.5 text-sm font-semibold text-gula-900 hover:bg-santan-100 dark:border-santan-700 dark:text-coconut dark:hover:bg-santan-800";

  return (
    <div className="share-buttons flex flex-wrap items-center gap-2" aria-label="Share this story">
      <a className={`${button} share-whatsapp border-pandan-300 bg-pandan-50 dark:bg-pandan-950`} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" className="size-4 fill-pandan-600" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.1.1.6-.1 1.2Z" />
        </svg>
        WhatsApp
      </a>
      <a className={`${button} share-facebook`} href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noopener noreferrer">
        Facebook
      </a>
      <button type="button" className={`${button} share-copy`} onClick={copy}>
        {copied ? <Check className="size-4 text-pandan-600" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
