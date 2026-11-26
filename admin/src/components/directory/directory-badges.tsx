import { StatusBadge } from "@/components/status-badge";
import { BUSINESS_STATUS, CLAIM_STATUS, REVIEW_STATUS } from "@/lib/directory";
import type { BusinessStatus, ClaimStatus, ReviewStatus } from "@cendol/api-client";
import { Star } from "lucide-react";

export function BusinessStatusBadge({ status, deleted }: { status: BusinessStatus; deleted?: boolean }) {
  if (deleted) return <StatusBadge tone="neutral">Deleted</StatusBadge>;
  const s = BUSINESS_STATUS[status];
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function ReviewStatusBadge({ status, deleted }: { status: ReviewStatus; deleted?: boolean }) {
  if (deleted) return <StatusBadge tone="neutral">Deleted by the writer</StatusBadge>;
  const s = REVIEW_STATUS[status];
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const s = CLAIM_STATUS[status];
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

/** Five stars, filled up to the rating. Read aloud as "4 out of 5 stars". */
export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const icon = size === "md" ? "size-5" : "size-3.5";
  return (
    <span className="rating-stars inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${icon} ${n <= Math.round(rating) ? "fill-marigold-400 text-marigold-500" : "text-santan-300"}`} aria-hidden />
      ))}
    </span>
  );
}
