import { pageFrom, StoryList, StoryListSkeleton } from "@/components/news/story-list";
import type { SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Latest news", description: "The newest stories from around Melaka." };

export default function LatestPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="latest-page site-container flex flex-col gap-8 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">Latest</h1>
        <p className="page-lead">Every story, newest first.</p>
      </header>
      <Suspense fallback={<StoryListSkeleton />}>
        <LatestList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LatestList({ searchParams }: { searchParams: SearchParams }) {
  const page = pageFrom((await searchParams).page);
  return <StoryList query={{ page }} basePath="/news" empty="No stories yet." />;
}
