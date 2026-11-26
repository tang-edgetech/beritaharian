"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

/*
  A one-time "done" message carried to the next page (e.g. "Thanks! Your review is up").
  Kept in this tab's sessionStorage, so cached pages stay the same for everyone.
*/

const KEY = "cendol-flash";

export function setFlash(text: string) {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    /* storage blocked: the page still works, just without the note */
  }
}

export function FlashMessage({ className }: { className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let value: string | null = null;
    try {
      value = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      value = null;
    }
    // shown once after a client navigation; reading storage has to wait for the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value) setText(value);
  }, []);

  if (!text) return null;
  return (
    <div className={`flash-message flex items-start gap-3 rounded-xl bg-pandan-50 px-4 py-3 text-pandan-900 dark:bg-pandan-950 dark:text-pandan-100 ${className ?? ""}`} role="status">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-semibold">{text}</p>
      <button type="button" onClick={() => setText(null)} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-pandan-100 dark:hover:bg-pandan-900" aria-label="Dismiss" title="Dismiss">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
