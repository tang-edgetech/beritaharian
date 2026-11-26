"use client";

import { errorMessage, FormMessage } from "@/components/account/auth-ui";
import { Stars } from "@/components/places/place-bits";
import { readerApi, requireReader } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { placeHref, REVIEW_STATUS_LABEL } from "@/lib/place-links";
import type { MyReview, SimplePage } from "@cendol/api-client";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** The reader's own reviews, with where each one stands. */
export default function MyReviewsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SimplePage<MyReview> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (n: number) =>
      readerApi
        .get<SimplePage<MyReview>>("me/reviews", { page: n })
        .then((r) => {
          setResult(r);
          setError(null);
        })
        .catch((e) => setError(errorMessage(e))),
    [],
  );

  useEffect(() => {
    if (requireReader(router, "/account/reviews")) return;
    void load(page);
  }, [router, load, page]);

  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await readerApi.delete<{ message: string }>(`me/reviews/${id}`);
      setNotice(r.message);
      setConfirming(null);
      await load(page);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="my-reviews-page site-container flex max-w-3xl flex-col gap-5 py-6">
      <Link href="/account" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Your account
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="page-heading">Your reviews</h1>
        <p className="page-lead">Reviews with a receipt photo go up once our team has checked it, usually within a day.</p>
      </header>
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}

      {!result && !error ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
          ))}
        </div>
      ) : result && result.data.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card bg-santan-100 p-6 text-santan-600 dark:bg-santan-900 dark:text-santan-300">
          <p>You haven&apos;t reviewed anywhere yet.</p>
          <Link href="/places" className="font-bold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
            Find a place you&apos;ve been to
          </Link>
        </div>
      ) : (
        <ul className="my-review-list flex flex-col gap-3">
          {result?.data.map((review) => {
            const status = REVIEW_STATUS_LABEL[review.status];
            return (
              <li key={review.id} className="my-review flex flex-col gap-2 rounded-card border border-santan-200 bg-white p-4 dark:border-santan-800 dark:bg-santan-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={placeHref(review.place.sector, review.place.slug)} className="font-display text-lg font-black text-gula-900 hover:underline dark:text-coconut">
                    {review.place.name}
                  </Link>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${status?.tone ?? ""}`}>{status?.label ?? review.status}</span>
                </div>
                <p className="flex flex-wrap items-center gap-2 text-sm text-santan-500">
                  <Stars value={review.rating} />
                  {review.visited_on ? `Visited ${formatDate(review.visited_on)}` : null}
                  {review.proof ? ` · ${review.proof === "checkin" ? "Checked in" : "Receipt"}` : null}
                </p>
                {review.title ? <p className="font-bold">{review.title}</p> : null}
                <p className="line-clamp-3 text-sm text-santan-700 dark:text-santan-200">{review.body}</p>
                {review.moderation_note ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                    <span className="font-bold">Why: </span>
                    {review.moderation_note}
                  </p>
                ) : null}
                {review.status === "returned" ? (
                  <Link href={`${placeHref(review.place.sector, review.place.slug)}/write-review`} className="self-start text-sm font-bold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
                    Write it again with new proof
                  </Link>
                ) : null}
                {review.reply ? <p className="rounded-xl bg-santan-100 px-3 py-2 text-sm dark:bg-santan-800">Owner replied: {review.reply.body}</p> : null}
                {confirming === review.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-santan-100 p-3 dark:bg-santan-800" role="alertdialog" aria-labelledby={`delete-${review.id}`}>
                    <p id={`delete-${review.id}`} className="flex-1 text-sm font-semibold">
                      Delete this review? This can&apos;t be undone.
                    </p>
                    <button type="button" disabled={busy} onClick={() => remove(review.id)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      Delete
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold hover:bg-santan-200 dark:hover:bg-santan-700">
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirming(review.id)} title="Delete this review" className="inline-flex items-center gap-1 self-end text-sm font-semibold text-santan-500 hover:text-red-700">
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {result && result.meta.last_page > 1 ? (
        <nav className="flex items-center justify-between" aria-label="More reviews">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="pager-link h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold disabled:invisible dark:border-santan-700">
            Previous
          </button>
          <span className="text-sm text-santan-500">
            Page {page} of {result.meta.last_page}
          </span>
          <button type="button" disabled={page >= result.meta.last_page} onClick={() => setPage(page + 1)} className="pager-link h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold disabled:invisible dark:border-santan-700">
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
