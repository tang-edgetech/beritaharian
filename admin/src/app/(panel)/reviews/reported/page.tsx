"use client";

import { ReviewListing, ReviewTabs } from "@/components/directory/review-listing";
import { PageHeader } from "@/components/page-header";

const QUEUE = { "filter[queue]": "reported" };

export default function ReportedReviewsPage() {
  return (
    <>
      <PageHeader back="/reviews" backLabel="Reviews to check" title="Reported reviews" description="Shown reviews that owners or readers reported. Reports never hide a review by themselves." />
      <ReviewTabs />
      <ReviewListing name="reviews-reported" extraQuery={QUEUE} emptyTitle="No open reports" />
    </>
  );
}
