"use client";

import { ReviewListing, ReviewTabs } from "@/components/directory/review-listing";
import { PageHeader } from "@/components/page-header";

export default function AllReviewsPage() {
  return (
    <>
      <PageHeader back="/reviews" backLabel="Reviews to check" title="All reviews" description="Every review, whatever its status." />
      <ReviewTabs />
      <ReviewListing name="reviews-all" emptyTitle="No reviews yet" />
    </>
  );
}
