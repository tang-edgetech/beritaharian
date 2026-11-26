"use client";

import { ReviewListing, ReviewTabs } from "@/components/directory/review-listing";
import { PageHeader } from "@/components/page-header";

const QUEUE = { "filter[queue]": "check" };

export default function ReviewsToCheckPage() {
  return (
    <>
      <PageHeader title="Reviews" description="Receipts to check and reviews the automatic checks held back. Oldest first." />
      <ReviewTabs />
      <ReviewListing name="reviews-check" extraQuery={QUEUE} emptyTitle="Nothing to check" emptyDescription="Reviews with a receipt photo, or with words the checks didn't like, wait here." />
    </>
  );
}
