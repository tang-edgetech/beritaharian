import type { PublicReview } from "@cendol/api-client";
import { MessageSquareReply } from "lucide-react";
import { formatDate } from "@/lib/format";
import { MediaImage } from "../news/media-image";
import { Stars, VerifiedVisit } from "./place-bits";
import { ReviewTools } from "./review-tools";

const SUB_LABELS: Record<string, string> = { service: "Service", value: "Value", cleanliness: "Cleanliness" };

/** One review as everyone sees it. Helpful / report buttons appear for signed-in readers. */
export function ReviewItem({ review, slug }: { review: PublicReview; slug: string }) {
  const subs = Object.entries(review.sub_ratings ?? {}).filter(([, v]) => v);
  return (
    <article className="review-item flex flex-col gap-3 border-b border-santan-200 py-5 last:border-b-0 dark:border-santan-800" id={`review-${review.id}`}>
      <header className="review-item-head flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="font-bold text-gula-900 dark:text-coconut">{review.author_name}</span>
        {review.is_verified_visit ? <VerifiedVisit /> : null}
        <span className="text-sm text-santan-500">
          {review.visited_on ? `Visited ${formatDate(review.visited_on)}` : null}
          {review.branch_label ? ` · ${review.branch_label}` : null}
        </span>
      </header>
      {review.title ? <h3 className="review-item-title font-display text-lg font-extrabold text-gula-900 dark:text-coconut">{review.title}</h3> : null}
      <p className="review-item-body whitespace-pre-line text-santan-800 dark:text-santan-100">{review.body}</p>
      {subs.length ? (
        <ul className="review-item-subs flex flex-wrap gap-x-4 gap-y-1 text-sm text-santan-600 dark:text-santan-300">
          {subs.map(([key, value]) => (
            <li key={key}>
              {SUB_LABELS[key] ?? key}: <span className="font-bold tabular-nums">{value}/5</span>
            </li>
          ))}
        </ul>
      ) : null}
      {review.photos.length ? (
        <ul className="review-item-photos flex gap-2 overflow-x-auto">
          {review.photos.map((photo) => (
            <li key={photo.id} className="shrink-0">
              <a href={photo.large ?? photo.card ?? "#"} target="_blank" rel="noreferrer" className="block" title="Open the full photo">
                <MediaImage media={photo} sizes="128px" className="size-28 rounded-xl object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {review.reply ? (
        <div className="review-item-reply flex gap-3 rounded-xl bg-santan-100 p-4 dark:bg-santan-900">
          <MessageSquareReply className="mt-0.5 size-5 shrink-0 text-pandan-700 dark:text-pandan-300" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-gula-900 dark:text-coconut">Reply from the owner</p>
            <p className="whitespace-pre-line text-sm text-santan-700 dark:text-santan-200">{review.reply.body}</p>
          </div>
        </div>
      ) : null}
      <ReviewTools reviewId={review.id} slug={slug} helpfulCount={review.helpful_count} />
    </article>
  );
}
