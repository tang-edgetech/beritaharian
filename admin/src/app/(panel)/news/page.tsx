"use client";

import { ArticleListing } from "@/components/news/article-listing";
import { StatTile } from "@/components/billing/money-text";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useNewsSummary } from "@/lib/news";
import { PenLine } from "lucide-react";
import Link from "next/link";

export default function NewsPage() {
  const { can } = useAuth();
  const summary = useNewsSummary();
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Stories"
        description="Every story moves from draft, to fact-check, to an editor before it goes live."
        actions={
          can("news.write") ? (
            <Button asChild>
              <Link href="/news/create">
                <PenLine />
                Write a story
              </Link>
            </Button>
          ) : null
        }
      />
      {s ? (
        <div className="news-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/news?mine=yes&status=draft" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
            <StatTile label="My drafts" tone={s.sent_back ? "warning" : undefined}>
              {s.my_drafts}
              {s.sent_back ? <span className="ml-2 text-sm font-semibold text-marigold-700">{s.sent_back} sent back</span> : null}
            </StatTile>
          </Link>
          {can("news.verify") ? (
            <Link href="/news/review" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
              <StatTile label="Waiting for fact-check" tone={s.to_verify ? "warning" : undefined}>
                {s.to_verify}
              </StatTile>
            </Link>
          ) : null}
          {can("news.publish") ? (
            <Link href="/news?status=verified" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
              <StatTile label="Ready to publish" tone={s.to_publish ? "good" : undefined}>
                {s.to_publish}
              </StatTile>
            </Link>
          ) : null}
          <Link href="/news?status=live" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
            <StatTile label="Published today">{s.live_today}</StatTile>
          </Link>
        </div>
      ) : null}
      <ArticleListing name="articles" emptyTitle="No stories yet" emptyDescription="Write the first story for Melaka." />
    </>
  );
}
