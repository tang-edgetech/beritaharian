"use client";

import { ArticleListing } from "@/components/news/article-listing";
import { PageHeader } from "@/components/page-header";

const QUEUE = { "filter[queue]": "review" };

export default function ReviewQueuePage() {
  return (
    <>
      <PageHeader
        title="Review queue"
        description="Stories waiting for you: fact-checks, developing stories to confirm, and verified stories ready to publish."
      />
      <ArticleListing name="review-queue" extraQuery={QUEUE} emptyTitle="Nothing waiting" emptyDescription="New stories appear here when writers send them for fact-check." />
    </>
  );
}
