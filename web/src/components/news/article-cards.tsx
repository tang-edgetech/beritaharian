import { formatDate } from "@/lib/format";
import { articleHref } from "@/lib/news";
import type { PublicArticle } from "@cendol/api-client";
import Link from "next/link";
import { toneFor } from "./category-tone";
import { ImagePlaceholder, MediaImage } from "./media-image";
import { TruthBadge } from "./truth-badge";

function Kicker({ article }: { article: PublicArticle }) {
  const tone = toneFor(article.category?.color);
  return (
    <span className="article-kicker flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold tracking-wide uppercase">
      {article.category ? <span className={tone.text}>{article.category.name}</span> : null}
      {article.area ? <span className="text-santan-500 dark:text-santan-400">{article.area.name}</span> : null}
    </span>
  );
}

function Byline({ article }: { article: PublicArticle }) {
  return (
    <span className="article-byline text-xs text-santan-500 dark:text-santan-400">
      {article.author.name} · {formatDate(article.published_at)} · {article.reading_minutes} min read
    </span>
  );
}

/** The lead story at the top of the Kopitiam Board. */
export function LeadStory({ article }: { article: PublicArticle }) {
  return (
    <article className="lead-story group relative flex flex-col overflow-hidden rounded-card bg-gula-900 text-coconut">
      <Link href={articleHref(article)} className="lead-story-link flex flex-col">
        <div className="lead-story-media relative aspect-[16/10] overflow-hidden sm:aspect-[16/9]">
          {article.cover ? (
            <MediaImage media={article.cover} sizes="(min-width: 1024px) 60vw, 100vw" priority className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          ) : (
            <ImagePlaceholder className="size-full" />
          )}
          <div className="lead-story-shade absolute inset-0 bg-gradient-to-t from-gula-950/90 via-gula-950/30 to-transparent" aria-hidden />
        </div>
        <div className="lead-story-text relative -mt-24 flex flex-col gap-2 px-5 pb-5 sm:-mt-32 sm:px-7 sm:pb-7">
          <span className="flex flex-wrap items-center gap-3">
            {article.category ? (
              <span className="rounded-full bg-marigold-400 px-2.5 py-0.5 text-xs font-extrabold tracking-wide text-gula-900 uppercase">{article.category.name}</span>
            ) : null}
            <TruthBadge label={article.truth_label} breaking={article.is_breaking} onDark />
          </span>
          <h2 className="lead-story-title font-display text-2xl leading-tight font-black text-balance sm:text-4xl">{article.title}</h2>
          {article.excerpt ? <p className="lead-story-excerpt line-clamp-3 max-w-2xl text-sm text-santan-200 sm:text-base">{article.excerpt}</p> : null}
          <span className="text-xs text-santan-300">
            {article.author.name} · {formatDate(article.published_at)}
            {article.area ? ` · ${article.area.name}` : ""}
          </span>
        </div>
      </Link>
    </article>
  );
}

/** "Hari ini": the numbered list beside the lead story. */
export function RankedList({ articles, title = "Hari ini" }: { articles: PublicArticle[]; title?: string }) {
  return (
    <section className="ranked-list flex flex-col gap-1" aria-labelledby="ranked-list-title">
      <h2 id="ranked-list-title" className="ranked-list-title flex items-baseline gap-2 font-display text-xl font-black text-gula-900 dark:text-coconut">
        {title}
        <span className="text-xs font-semibold tracking-wide text-santan-500 uppercase">most read today</span>
      </h2>
      <ol className="ranked-list-items flex flex-col">
        {articles.map((article, index) => (
          <li key={article.slug} className="ranked-item border-b border-santan-200 last:border-0 dark:border-santan-800">
            <Link href={articleHref(article)} className="ranked-item-link group flex gap-4 py-3.5">
              <span className="ranked-item-number w-7 shrink-0 font-display text-3xl leading-none font-black text-satay-500 tabular-nums" aria-hidden>
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <Kicker article={article} />
                <span className="ranked-item-title font-display leading-snug font-extrabold text-gula-900 group-hover:underline dark:text-coconut">{article.title}</span>
                <TruthBadge label={article.truth_label === "verified" ? null : article.truth_label} breaking={article.is_breaking} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Picture card used in topic rows and listings. */
export function StoryCard({ article, sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" }: { article: PublicArticle; sizes?: string }) {
  return (
    <article className="story-card group flex flex-col gap-3">
      <Link href={articleHref(article)} className="story-card-media block overflow-hidden rounded-card">
        {article.cover ? (
          <MediaImage media={article.cover} sizes={sizes} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <ImagePlaceholder className="aspect-[4/3] w-full" />
        )}
      </Link>
      <div className="story-card-text flex flex-col gap-1.5">
        <Kicker article={article} />
        <h3 className="story-card-title font-display text-lg leading-snug font-extrabold text-gula-900 dark:text-coconut">
          <Link href={articleHref(article)} className="hover:underline">
            {article.title}
          </Link>
        </h3>
        <TruthBadge label={article.truth_label === "verified" ? null : article.truth_label} breaking={article.is_breaking} />
        <Byline article={article} />
      </div>
    </article>
  );
}

/** Text-first row for search results and long lists. */
export function StoryRow({ article }: { article: PublicArticle }) {
  return (
    <article className="story-row group flex gap-4 border-b border-santan-200 py-4 last:border-0 dark:border-santan-800">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Kicker article={article} />
        <h3 className="story-row-title font-display text-lg leading-snug font-extrabold text-gula-900 dark:text-coconut">
          <Link href={articleHref(article)} className="hover:underline">
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? <p className="line-clamp-2 text-sm text-santan-600 dark:text-santan-300">{article.excerpt}</p> : null}
        <span className="flex flex-wrap items-center gap-3">
          <Byline article={article} />
          <TruthBadge label={article.truth_label === "verified" ? null : article.truth_label} breaking={article.is_breaking} />
        </span>
      </div>
      <Link href={articleHref(article)} className="story-row-media w-28 shrink-0 overflow-hidden rounded-lg sm:w-40" tabIndex={-1} aria-hidden>
        {article.cover ? <MediaImage media={article.cover} sizes="160px" className="aspect-[4/3] w-full object-cover" /> : <ImagePlaceholder className="aspect-[4/3] w-full" />}
      </Link>
    </article>
  );
}
