"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A popup that asks "are you sure?" before a risky step (withdraw, delete).
 * Uses the browser's own <dialog>, so Esc and the keyboard work without extra code.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // useId keeps the label unique even when Next keeps a hidden copy of an earlier page
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="confirm-dialog m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card bg-white p-0 text-gula-900 shadow-2xl backdrop:bg-gula-900/50 dark:bg-santan-900 dark:text-coconut"
    >
      <div className="confirm-dialog-body flex flex-col gap-4 p-6">
        <h2 id={titleId} className="font-display text-xl font-black">
          {title}
        </h2>
        {children ? <div className="confirm-dialog-text flex flex-col gap-2 text-sm text-santan-700 dark:text-santan-200">{children}</div> : null}
        <div className="confirm-dialog-actions flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-10 items-center rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 disabled:opacity-60 dark:border-santan-600 dark:hover:bg-santan-800">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white disabled:opacity-60 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-gula-900 hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900"}`}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
