import { LeadStory, RankedList, StoryCard } from "@/components/news/article-cards";
import { toneFor } from "@/components/news/category-tone";
import { getAreas, getHome } from "@/lib/news";
import type { HomeSection } from "@cendol/api-client";
import { ArrowRight, Map as MapIcon, Store, Zap } from "lucide-react";
import Link from "next/link";
import { articleHref } from "@/lib/news";

/** The Kopitiam Board: lead story, "Hari ini" list, breaking strip, then a row per section. */
export default async function HomePage() {
  const [home, areas] = await Promise.all([getHome(), getAreas()]);

  if (!home) {
    return (
      <div className="site-container flex flex-col items-start gap-3 py-16">
        <h1 className="page-heading">The news is taking a moment</h1>
        <p className="page-lead">We couldn&apos;t load today&apos;s stories. Please refresh in a minute.</p>
      </div>
    );
  }

  if (!home.lead) {
    return (
      <div className="site-container flex flex-col items-start gap-3 py-16">
        <h1 className="page-heading">Apa cerita, Melaka?</h1>
        <p className="page-lead">The first stories are being written and checked. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="kopitiam-board flex flex-col gap-12 pt-6">
      <h1 className="sr-only">Cendol Satay: today&apos;s news from Melaka</h1>
      {home.breaking.length ? (
        <section className="breaking-strip site-container" aria-label="Breaking news">
          <div className="flex flex-col gap-2 rounded-card bg-red-700 px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-widest uppercase">
              <Zap className="size-4" aria-hidden />
              Breaking
            </span>
            <ul className="flex min-w-0 flex-col gap-1 sm:flex-row sm:gap-6">
              {home.breaking.map((a) => (
                <li key={a.slug} className="min-w-0">
                  <Link href={articleHref(a)} className="block truncate font-semibold hover:underline">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="board-top site-container grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]" aria-label="Top stories">
        <LeadStory article={home.lead} />
        {home.today.length ? <RankedList articles={home.today} /> : null}
      </section>

      {/* busy sections get a full row; quieter ones share a grid so no row sits half empty */}
      {home.sections
        .filter((s) => s.articles.length >= 3)
        .map((section) => (
          <section key={section.category.slug} className="topic-row site-container flex flex-col gap-5" aria-labelledby={`topic-${section.category.slug}`}>
            <SectionHead section={section} />
            <div className="topic-row-cards grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {section.articles.map((article) => (
                <StoryCard key={article.slug} article={article} />
              ))}
            </div>
          </section>
        ))}

      {home.sections.some((s) => s.articles.length < 3) ? (
        <div className="topic-grid site-container grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {home.sections
            .filter((s) => s.articles.length < 3)
            .map((section) => (
              <section key={section.category.slug} className="topic-column flex flex-col gap-5" aria-labelledby={`topic-${section.category.slug}`}>
                <SectionHead section={section} />
                {section.articles.map((article) => (
                  <StoryCard key={article.slug} article={article} />
                ))}
              </section>
            ))}
        </div>
      ) : null}

      {areas.length ? (
        <section className="area-strip site-container" aria-labelledby="area-strip-title">
          <div className="flex flex-col gap-4 rounded-card bg-pandan-700 px-5 py-6 text-coconut sm:px-8">
            <div className="flex flex-col gap-1">
              <h2 id="area-strip-title" className="font-display text-2xl font-black">Near you</h2>
              <p className="text-sm text-pandan-100">News by place, and the places themselves: stalls, stays and services on the map.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/places" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-coconut px-4 text-sm font-extrabold text-gula-900 hover:bg-santan-100">
                <Store className="size-4" aria-hidden />
                Browse places
              </Link>
              <Link href="/map" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pandan-300 px-4 text-sm font-bold hover:bg-pandan-600">
                <MapIcon className="size-4" aria-hidden />
                Open the map
              </Link>
            </div>
            <ul className="flex flex-wrap gap-2">
              {areas.flatMap((district) => [
                <li key={district.slug}>
                  <Link href={`/areas/${district.slug}`} className="inline-flex h-9 items-center rounded-full bg-marigold-400 px-4 text-sm font-extrabold text-gula-900 hover:bg-marigold-300">
                    {district.name}
                  </Link>
                </li>,
                ...district.children.slice(0, 4).map((place) => (
                  <li key={place.slug}>
                    <Link href={`/areas/${place.slug}`} className="inline-flex h-9 items-center rounded-full border border-pandan-400 px-4 text-sm font-semibold hover:bg-pandan-600">
                      {place.name}
                    </Link>
                  </li>
                )),
              ])}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SectionHead({ section }: { section: HomeSection }) {
  const tone = toneFor(section.category.color);
  return (
    <div className="topic-head flex items-end justify-between gap-4 border-b-2 border-gula-900 pb-2 dark:border-santan-200">
      <h2 id={`topic-${section.category.slug}`} className="flex items-center gap-2.5 font-display text-2xl font-black text-gula-900 dark:text-coconut">
        <span className={`size-3 rounded-full ${tone.dot}`} aria-hidden />
        {section.category.name}
      </h2>
      <Link href={`/news/${section.category.slug}`} className={`inline-flex items-center gap-1 text-sm font-bold ${tone.text} hover:underline`}>
        More <span className="sr-only">{section.category.name}</span>
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
