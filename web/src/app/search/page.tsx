import { pageFrom, StoryList, StoryListSkeleton } from "@/components/news/story-list";
import { one, type SearchParams } from "@/types/routes";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="search-page site-container flex max-w-3xl flex-col gap-8 py-8">
      <h1 className="page-heading">Search</h1>
      <Suspense fallback={<SearchForm value="" />}>
        <SearchBox searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<StoryListSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchForm({ value }: { value: string }) {
  return (
    <form action="/search" role="search" className="search-form flex gap-2">
      <label htmlFor="search-page-input" className="sr-only">
        Search the news
      </label>
      <span className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-santan-500" aria-hidden />
        <input
          id="search-page-input"
          name="q"
          type="search"
          defaultValue={value}
          autoFocus={!value}
          placeholder="e.g. banjir, Jonker Street, pasar malam"
          className="h-12 w-full rounded-full border border-santan-300 bg-white pr-4 pl-12 outline-none focus:border-pandan-500 focus:ring-2 focus:ring-pandan-200 dark:border-santan-700 dark:bg-santan-900"
        />
      </span>
      <button type="submit" className="h-12 rounded-full bg-gula-900 px-6 font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
        Search
      </button>
    </form>
  );
}

async function SearchBox({ searchParams }: { searchParams: SearchParams }) {
  return <SearchForm value={one((await searchParams).q)} />;
}

async function SearchResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = one(params.q).slice(0, 100);
  if (!q) return <p className="text-santan-500">Type a word or place above to find stories.</p>;
  return (
    <section className="flex flex-col gap-3" aria-label={`Results for ${q}`}>
      <p className="text-sm text-santan-500">
        Stories matching <strong className="text-gula-900 dark:text-coconut">“{q}”</strong>
      </p>
      <StoryList query={{ q, page: pageFrom(params.page) }} basePath="/search" keep={{ q }} layout="rows" empty="Nothing found. Try a shorter word, or the name of a place." />
    </section>
  );
}
