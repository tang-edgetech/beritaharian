"use client";

import { REVIEW_STATUS_LABEL } from "@/lib/place-links";
import { usePlaceStatus } from "@/lib/place-status";
import { BadgeCheck, PenLine, Store } from "lucide-react";
import Link from "next/link";

/**
 * "Write a review" and "Own this place?" boxes. They change once we know who is looking:
 * someone who already reviewed sees their review's status, an owner sees "Manage this place".
 */
export function PlaceActions({ slug, placeId, base, isClaimed }: { slug: string; placeId: string; base: string; isClaimed: boolean }) {
  const { status, signedIn } = usePlaceStatus(slug);
  const mine = status?.my_review;
  const claim = status?.my_claim;

  return (
    <div className="place-actions flex flex-col gap-3">
      {status?.is_manager ? (
        <Link
          href={`/business/${placeId}/listing`}
          className="place-manage-link inline-flex h-12 items-center justify-center gap-2 rounded-full bg-pandan-700 px-5 font-bold text-white hover:bg-pandan-800"
        >
          <Store className="size-5" aria-hidden />
          Manage this place
        </Link>
      ) : mine && mine.status !== "returned" ? (
        <div className="place-my-review flex flex-col gap-1 rounded-card bg-santan-100 p-4 text-sm dark:bg-santan-900">
          <p className="font-bold text-gula-900 dark:text-coconut">You reviewed this place</p>
          <p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${REVIEW_STATUS_LABEL[mine.status]?.tone ?? ""}`}>{REVIEW_STATUS_LABEL[mine.status]?.label ?? mine.status}</span>
          </p>
          <Link href="/account/reviews" className="font-semibold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
            See your reviews
          </Link>
        </div>
      ) : (
        <Link
          href={`${base}/write-review`}
          className="place-write-review inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gula-900 px-5 font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900 dark:hover:bg-marigold-300"
        >
          <PenLine className="size-5" aria-hidden />
          {mine?.status === "returned" ? "Write your review again" : "Write a review"}
        </Link>
      )}
      {mine?.status === "returned" && mine.moderation_note ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Your last review was sent back: {mine.moderation_note}</p>
      ) : null}

      {status?.is_manager ? null : claim?.status === "pending" ? (
        <p className="place-claim-status rounded-xl bg-marigold-50 px-4 py-3 text-sm dark:bg-gula-900">We&apos;re checking your claim for this place. We&apos;ll email you when it&apos;s done.</p>
      ) : !isClaimed || (signedIn && claim?.status === "rejected") ? (
        <Link href={`${base}/claim`} className="place-claim-link inline-flex items-center gap-1.5 text-sm font-bold text-pandan-700 hover:underline dark:text-pandan-300">
          <BadgeCheck className="size-4" aria-hidden />
          Own this place? Claim it
        </Link>
      ) : null}
    </div>
  );
}
