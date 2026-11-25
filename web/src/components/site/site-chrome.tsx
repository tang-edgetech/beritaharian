import { getCategories } from "@/lib/news";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AccountLink, TodayDate } from "./site-client";

/** Top of every page: masthead with today's date, search, sign-in, and the section chips. */
export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-santan-200 bg-santan-50/95 backdrop-blur dark:border-santan-800 dark:bg-santan-950/95">
      <div className="site-container flex h-16 items-center gap-4">
        <Link href="/" className="site-logo flex shrink-0 items-center gap-2" aria-label="Cendol Satay home">
          <Image src="/brand/cendol-satay-pin-icon-transparent.png" alt="" width={36} height={36} priority />
          <span className="site-logo-name font-display text-xl font-black tracking-tight text-gula-900 lowercase dark:text-coconut">cendol satay</span>
        </Link>
        <TodayDate />
        <form action="/search" className="site-search ml-auto hidden max-w-xs flex-1 items-center md:flex" role="search">
          <label htmlFor="site-search-input" className="sr-only">
            Search the news
          </label>
          <span className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-santan-500" aria-hidden />
            <input
              id="site-search-input"
              name="q"
              type="search"
              placeholder="Search Melaka news"
              className="h-10 w-full rounded-full border border-santan-300 bg-white pr-4 pl-9 text-sm outline-none focus:border-pandan-500 focus:ring-2 focus:ring-pandan-200 dark:border-santan-700 dark:bg-santan-900 dark:focus:ring-pandan-900"
            />
          </span>
        </form>
        <Link href="/search" className="site-search-icon ml-auto inline-flex size-10 items-center justify-center rounded-full hover:bg-santan-100 md:hidden dark:hover:bg-santan-800" aria-label="Search">
          <Search className="size-5" aria-hidden />
        </Link>
        <AccountLink />
      </div>
      <Suspense fallback={<div className="h-11" />}>
        <SectionNav />
      </Suspense>
    </header>
  );
}

async function SectionNav() {
  const categories = await getCategories();
  return (
    <nav className="section-nav border-t border-santan-200/70 dark:border-santan-800" aria-label="Sections">
      <ul className="site-container flex h-11 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <li>
          <Link href="/news" className="section-nav-link inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-gula-900 hover:bg-santan-100 dark:text-coconut dark:hover:bg-santan-800">
            Latest
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/news/${c.slug}`}
              className="section-nav-link inline-flex h-8 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-santan-700 hover:bg-santan-100 hover:text-gula-900 dark:text-santan-300 dark:hover:bg-santan-800 dark:hover:text-coconut"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer mt-16 border-t border-santan-200 pb-24 md:pb-0 dark:border-santan-800">
      <div className="site-container grid gap-8 py-10 sm:grid-cols-3">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/cendol-satay-pin-icon-transparent.png" alt="" width={32} height={32} />
            <span className="font-display text-lg font-black text-gula-900 lowercase dark:text-coconut">cendol satay</span>
          </Link>
          <p className="max-w-xs text-sm text-santan-600 dark:text-santan-400">Melaka news you can trust, places worth the trip, and a way to tell us what&apos;s happening on your street.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <h2 className="font-display font-extrabold text-gula-900 dark:text-coconut">How we check stories</h2>
          <p className="text-santan-600 dark:text-santan-400">
            <strong className="text-pandan-700 dark:text-pandan-300">Verified</strong> stories were fact-checked before publishing.{" "}
            <strong className="text-satay-700 dark:text-satay-400">Developing</strong> stories are urgent and still being checked.{" "}
            <strong className="text-gula-700 dark:text-gula-300">Corrected</strong> stories show what changed at the end.
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label="More">
          <h2 className="font-display font-extrabold text-gula-900 dark:text-coconut">Around Melaka</h2>
          <Link href="/areas/melaka-tengah" className="text-santan-600 hover:underline dark:text-santan-400">Melaka Tengah</Link>
          <Link href="/areas/alor-gajah" className="text-santan-600 hover:underline dark:text-santan-400">Alor Gajah</Link>
          <Link href="/areas/jasin" className="text-santan-600 hover:underline dark:text-santan-400">Jasin</Link>
        </nav>
      </div>
    </footer>
  );
}
