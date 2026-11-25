import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found site-container flex max-w-2xl flex-col items-start gap-4 py-16">
      <p className="font-display text-6xl font-black text-marigold-400">404</p>
      <h1 className="page-heading">We couldn&apos;t find that page</h1>
      <p className="page-lead">The story may have been moved or taken down. Try searching for it instead.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-gula-900 px-5 font-bold text-coconut dark:bg-marigold-400 dark:text-gula-900">
          Today&apos;s news
        </Link>
        <Link href="/search" className="inline-flex h-11 items-center rounded-full border border-santan-300 px-5 font-bold dark:border-santan-700">
          Search
        </Link>
      </div>
    </div>
  );
}
