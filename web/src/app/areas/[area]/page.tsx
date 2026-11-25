import { pageFrom, StoryList, StoryListSkeleton } from "@/components/news/story-list";
import { getAreas } from "@/lib/news";
import type { RouteParams, SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = { params: RouteParams<"area">; searchParams: SearchParams };

async function findArea(slug: string) {
  const districts = await getAreas();
  for (const district of districts) {
    if (district.slug === slug) return { area: { slug: district.slug, name: district.name }, district, places: district.children };
    const place = district.children.find((c) => c.slug === slug);
    if (place) return { area: place, district, places: [] };
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await findArea((await params).area);
  return found ? { title: `${found.area.name} news`, description: `What's happening in ${found.area.name}, Melaka.` } : { title: "Place not found" };
}

export default function AreaPage({ params, searchParams }: Props) {
  return (
    <div className="area-page site-container flex flex-col gap-8 py-8">
      <Suspense fallback={<div className="h-24" />}>
        <AreaHeader params={params} />
      </Suspense>
      <Suspense fallback={<StoryListSkeleton />}>
        <AreaStories params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AreaHeader({ params }: { params: Props["params"] }) {
  const found = await findArea((await params).area);
  if (!found) notFound();
  const isDistrict = found.area.slug === found.district.slug;
  return (
    <header className="flex flex-col gap-3">
      <span className="text-sm font-bold tracking-wide text-pandan-700 uppercase dark:text-pandan-300">{isDistrict ? "District" : found.district.name}</span>
      <h1 className="page-heading">{found.area.name}</h1>
      {found.places.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={`Places in ${found.area.name}`}>
          {found.places.map((p) => (
            <li key={p.slug}>
              <Link href={`/areas/${p.slug}`} className="inline-flex h-8 items-center rounded-full border border-santan-300 px-3 text-sm font-medium hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}

async function AreaStories({ params, searchParams }: Props) {
  const { area } = await params;
  const page = pageFrom((await searchParams).page);
  return <StoryList query={{ area, page }} basePath={`/areas/${area}`} empty="No stories from here yet." />;
}
