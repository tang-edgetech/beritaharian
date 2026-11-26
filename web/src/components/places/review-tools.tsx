"use client";

import { errorMessage } from "@/components/account/auth-ui";
import { readerApi, rememberReturn } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/place-links";
import { updatePlaceStatus, usePlaceStatus } from "@/lib/place-status";
import { Flag, Loader2, ThumbsUp } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** "Helpful" and "Report" under a review. Signed-out readers are sent to sign in first. */
export function ReviewTools({ reviewId, slug, helpfulCount }: { reviewId: string; slug: string; helpfulCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, signedIn } = usePlaceStatus(slug);
  const [count, setCount] = useState(helpfulCount);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const voted = status?.voted.includes(reviewId) ?? false;
  const reported = status?.reported.includes(reviewId) ?? false;
  const own = status?.my_review?.id === reviewId;

  function needSignIn() {
    rememberReturn(`${pathname}#review-${reviewId}`);
    router.push("/login");
  }

  async function toggleHelpful() {
    if (!signedIn) return needSignIn();
    setBusy(true);
    setMessage(null);
    try {
      const r = await readerApi.post<{ message: string; data: { helpful: boolean; count: number } }>(`me/reviews/${reviewId}/helpful`);
      setCount(r.data.count);
      updatePlaceStatus(slug, (s) => ({ ...s, voted: r.data.helpful ? [...s.voted, reviewId] : s.voted.filter((id) => id !== reviewId) }));
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function report(event: FormEvent) {
    event.preventDefault();
    if (!reason) {
      setMessage({ tone: "error", text: "Please choose what is wrong with this review." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await readerApi.post<{ message: string }>(`me/reviews/${reviewId}/report`, { reason, note: note || null });
      updatePlaceStatus(slug, (s) => ({ ...s, reported: [...s.reported, reviewId] }));
      setReporting(false);
      setMessage({ tone: "ok", text: r.message });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-tools flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {own ? (
          <span className="text-sm text-santan-500">Your review{count ? ` · ${count} found it helpful` : ""}</span>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleHelpful}
              disabled={busy}
              aria-pressed={voted}
              title={voted ? "Remove your helpful mark" : "Mark this review as helpful"}
              className={`review-helpful inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${voted ? "border-pandan-600 bg-pandan-50 text-pandan-800 dark:bg-pandan-950 dark:text-pandan-100" : "border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"}`}
            >
              {busy && !reporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ThumbsUp className="size-3.5" aria-hidden />}
              Helpful{count ? ` · ${count}` : ""}
            </button>
            {reported ? (
              <span className="text-sm text-santan-500">You reported this review</span>
            ) : (
              <button
                type="button"
                onClick={() => (signedIn ? setReporting((v) => !v) : needSignIn())}
                title="Tell a moderator something is wrong with this review"
                className="review-report-toggle inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-santan-500 hover:text-satay-700 hover:underline"
              >
                <Flag className="size-3.5" aria-hidden />
                Report
              </button>
            )}
          </>
        )}
      </div>
      {reporting ? (
        <form className="review-report-form flex flex-col gap-3 rounded-xl border border-santan-200 p-4 dark:border-santan-800" onSubmit={report}>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold">What&apos;s wrong with this review?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`report-${reviewId}`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-4 accent-pandan-600" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`report-note-${reviewId}`} className="text-sm font-semibold">
            Anything else? (optional)
          </label>
          <textarea id={`report-note-${reviewId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="rounded-xl border border-santan-300 bg-white p-3 text-sm dark:border-santan-700 dark:bg-santan-950" />
          <p className="text-xs text-santan-500">A moderator reads every report. Reports don&apos;t hide a review on their own.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut disabled:opacity-60 dark:bg-marigold-400 dark:text-gula-900">
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Send report
            </button>
            <button type="button" onClick={() => setReporting(false)} className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold hover:bg-santan-100 dark:hover:bg-santan-800">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-red-700 dark:text-red-400" : "text-pandan-700 dark:text-pandan-300"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
