"use client";

import { errorMessage, FormMessage } from "@/components/account/auth-ui";
import { Stars, VerifiedVisit } from "@/components/places/place-bits";
import { readerApi } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/place-links";
import type { PublicReview, SimplePage } from "@cendol/api-client";
import { Flag, Loader2, MessageSquareReply, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type OwnerReview = PublicReview & { reported: boolean };

/** Reviews of the owner's place: reply (once, editable), remove a reply, or report a review. Owners can't delete reviews. */
export function ReviewsPanel({ placeId }: { placeId: string }) {
  const [filter, setFilter] = useState<"all" | "unanswered">("unanswered");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SimplePage<OwnerReview> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    readerApi
      .get<SimplePage<OwnerReview>>(`me/businesses/${placeId}/reviews`, { filter, page })
      .then((r) => {
        setResult(r);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [placeId, filter, page]);

  useEffect(load, [load]);

  const chip = (active: boolean) => `inline-flex h-9 items-center rounded-full px-3.5 text-sm font-bold ${active ? "bg-gula-900 text-coconut dark:bg-marigold-400 dark:text-gula-900" : "border border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"}`;

  return (
    <div className="reviews-panel flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Which reviews">
        <button type="button" className={chip(filter === "unanswered")} aria-pressed={filter === "unanswered"} onClick={() => (setFilter("unanswered"), setPage(1))}>
          Waiting for a reply
        </button>
        <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => (setFilter("all"), setPage(1))}>
          All reviews
        </button>
      </div>
      <p className="text-sm text-santan-600 dark:text-santan-300">A kind, specific reply helps more than anything else. If a review breaks the rules (fake, rude, personal details), report it and a moderator will check.</p>
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
      {!result && !error ? (
        <div className="h-40 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" aria-busy />
      ) : result && !result.data.length ? (
        <p className="rounded-card bg-santan-100 p-5 text-santan-600 dark:bg-santan-900 dark:text-santan-300">{filter === "unanswered" ? "You've replied to every review. Nice." : "No reviews yet."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result?.data.map((review) => (
            <OwnerReviewItem
              key={review.id}
              review={review}
              onDone={(text) => {
                setNotice(text);
                load();
              }}
            />
          ))}
        </ul>
      )}
      {result && result.meta.last_page > 1 ? (
        <nav className="flex items-center justify-between" aria-label="More reviews">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold disabled:invisible dark:border-santan-700">
            Previous
          </button>
          <span className="text-sm text-santan-500">
            Page {page} of {result.meta.last_page}
          </span>
          <button type="button" disabled={page >= result.meta.last_page} onClick={() => setPage(page + 1)} className="h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold disabled:invisible dark:border-santan-700">
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function OwnerReviewItem({ review, onDone }: { review: OwnerReview; onDone: (message: string) => void }) {
  const [mode, setMode] = useState<"view" | "reply" | "report" | "remove-reply">("view");
  const [body, setBody] = useState(review.reply?.body ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ message: string }>) {
    setBusy(true);
    setError(null);
    try {
      const r = await action();
      setMode("view");
      onDone(r.message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="owner-review flex flex-col gap-3 rounded-card border border-santan-200 bg-white p-4 dark:border-santan-800 dark:bg-santan-900">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stars value={review.rating} />
        <span className="font-bold">{review.author_name}</span>
        {review.is_verified_visit ? <VerifiedVisit /> : null}
        <span className="text-santan-500">{formatDate(review.published_at)}</span>
      </div>
      {review.title ? <p className="font-bold">{review.title}</p> : null}
      <p className="text-sm whitespace-pre-line">{review.body}</p>
      {review.reply && mode !== "reply" ? (
        <div className="rounded-xl bg-santan-100 p-3 text-sm dark:bg-santan-800">
          <p className="font-bold">Your reply</p>
          <p className="whitespace-pre-line">{review.reply.body}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p> : null}

      {mode === "reply" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => readerApi.put(`me/reviews/${review.id}/reply`, { body }));
          }}
        >
          <label htmlFor={`reply-${review.id}`} className="text-sm font-semibold">
            Your public reply
          </label>
          <textarea id={`reply-${review.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1500} className="rounded-xl border border-santan-300 bg-white p-3 text-sm dark:border-santan-700 dark:bg-santan-950" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || body.trim().length < 2} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut disabled:opacity-60 dark:bg-marigold-400 dark:text-gula-900">
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Post reply
            </button>
            <button type="button" onClick={() => setMode("view")} className="h-9 rounded-full px-4 text-sm font-semibold hover:bg-santan-100 dark:hover:bg-santan-800">
              Cancel
            </button>
          </div>
        </form>
      ) : mode === "report" ? (
        <form
          className="flex flex-col gap-2 rounded-xl border border-santan-200 p-3 dark:border-santan-800"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return setError("Please choose what is wrong with this review.");
            void run(() => readerApi.post(`me/reviews/${review.id}/report`, { reason, note: note || null }));
          }}
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-bold">What&apos;s wrong with this review?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`owner-report-${review.id}`} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-4 accent-pandan-600" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`owner-report-note-${review.id}`} className="text-sm font-semibold">
            Tell the moderator more (optional)
          </label>
          <textarea id={`owner-report-note-${review.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="rounded-xl border border-santan-300 bg-white p-2 text-sm dark:border-santan-700 dark:bg-santan-950" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut disabled:opacity-60 dark:bg-marigold-400 dark:text-gula-900">
              Send report
            </button>
            <button type="button" onClick={() => setMode("view")} className="h-9 rounded-full px-4 text-sm font-semibold hover:bg-santan-100 dark:hover:bg-santan-800">
              Cancel
            </button>
          </div>
        </form>
      ) : mode === "remove-reply" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-santan-100 p-3 text-sm dark:bg-santan-800" role="alertdialog" aria-label="Remove your reply?">
          <span className="flex-1 font-semibold">Remove your reply? Readers will no longer see it.</span>
          <button type="button" disabled={busy} onClick={() => run(() => readerApi.delete(`me/reviews/${review.id}/reply`))} className="h-9 rounded-full bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-60">
            Remove
          </button>
          <button type="button" onClick={() => setMode("view")} className="h-9 rounded-full px-4 text-sm font-semibold hover:bg-santan-200 dark:hover:bg-santan-700">
            Keep it
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMode("reply")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pandan-700 px-4 text-sm font-bold text-white hover:bg-pandan-800">
            {review.reply ? <Pencil className="size-4" aria-hidden /> : <MessageSquareReply className="size-4" aria-hidden />}
            {review.reply ? "Edit reply" : "Reply"}
          </button>
          {review.reply ? (
            <button type="button" onClick={() => setMode("remove-reply")} title="Remove your reply" aria-label="Remove your reply" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-santan-100 dark:hover:bg-santan-800">
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
          <span className="flex-1" />
          {review.reported ? (
            <span className="text-sm text-santan-500">Reported</span>
          ) : (
            <button type="button" onClick={() => setMode("report")} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-santan-500 hover:text-satay-700 hover:underline">
              <Flag className="size-4" aria-hidden />
              Report
            </button>
          )}
        </div>
      )}
    </li>
  );
}
