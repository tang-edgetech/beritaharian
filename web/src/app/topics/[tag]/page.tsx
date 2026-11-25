import { pageFrom, StoryList, StoryListSkeleton } from "@/components/news/story-list";
import { getTag } from "@/lib/news";
import type { RouteParams, SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = { params: RouteParams<"tag">; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await getTag((await params).tag);
  return { title: tag ? `#${tag.name}` : "Topic not found" };
}

export default function TopicPage({ params, searchParams }: Props) {
  return (
    <div className="topic-page site-container flex flex-col gap-8 py-8">
      <Suspense fallback={<div className="h-16" />}>
        <TopicHeader params={params} />
      </Suspense>
      <Suspense fallback={<StoryListSkeleton />}>
        <TopicStories params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TopicHeader({ params }: { params: Props["params"] }) {
  const tag = await getTag((await params).tag);
  if (!tag) notFound();
  return (
    <header className="flex flex-col gap-1">
      <span className="text-sm font-bold tracking-wide text-santan-500 uppercase">Topic</span>
      <h1 className="page-heading">#{tag.name}</h1>
    </header>
  );
}

async function TopicStories({ params, searchParams }: Props) {
  const { tag } = await params;
  const page = pageFrom((await searchParams).page);
  return <StoryList query={{ tag, page }} basePath={`/topics/${tag}`} layout="rows" empty="No stories on this topic yet." />;
}
