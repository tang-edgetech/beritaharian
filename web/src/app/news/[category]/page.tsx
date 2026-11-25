import { toneFor } from "@/components/news/category-tone";
import { pageFrom, StoryList, StoryListSkeleton } from "@/components/news/story-list";
import { getCategories } from "@/lib/news";
import type { RouteParams, SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = { params: RouteParams<"category">; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const found = (await getCategories()).find((c) => c.slug === category);
  return found ? { title: `${found.name} news`, description: found.description ?? `${found.name} stories from Melaka.` } : { title: "Section not found" };
}

export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <div className="category-page site-container flex flex-col gap-8 py-8">
      <Suspense fallback={<div className="h-20" />}>
        <CategoryHeader params={params} />
      </Suspense>
      <Suspense fallback={<StoryListSkeleton />}>
        <CategoryStories params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryHeader({ params }: { params: Props["params"] }) {
  const { category } = await params;
  const found = (await getCategories()).find((c) => c.slug === category);
  if (!found) notFound();
  const tone = toneFor(found.color);
  return (
    <header className="flex flex-col gap-2">
      <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${tone.chip}`}>
        <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden />
        Section
      </span>
      <h1 className="page-heading">{found.name}</h1>
      {found.description ? <p className="page-lead">{found.description}</p> : null}
    </header>
  );
}

async function CategoryStories({ params, searchParams }: Props) {
  const { category } = await params;
  const page = pageFrom((await searchParams).page);
  return <StoryList query={{ category, page }} basePath={`/news/${category}`} empty="No stories in this section yet." />;
}
