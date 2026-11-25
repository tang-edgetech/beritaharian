import { StoryCard } from "@/components/news/article-cards";
import { toneFor } from "@/components/news/category-tone";
import { MediaImage } from "@/components/news/media-image";
import { RichText } from "@/components/news/rich-text";
import { ShareButtons } from "@/components/news/share-buttons";
import { TruthBadge } from "@/components/news/truth-badge";
import { ViewCounter } from "@/components/news/view-counter";
import { formatDateTime, formatLongDate } from "@/lib/format";
import { articleHref, getArticle } from "@/lib/news";
import type { RouteParams } from "@/types/routes";
import { ExternalLink, PencilLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

type Props = { params: RouteParams<"category" | "slug"> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getArticle(slug);
  if (!page || page === "not-found") return { title: "Story not found" };
  const { article } = page;
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    alternates: { canonical: articleHref(article) },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt ?? undefined,
      publishedTime: article.published_at ?? undefined,
      authors: [article.author.name],
      images: article.cover?.large ? [{ url: article.cover.large, alt: article.cover.alt }] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default function ArticlePage({ params }: Props) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <ArticleContent params={params} />
    </Suspense>
  );
}

async function ArticleContent({ params }: Props) {
  const { category, slug } = await params;
  const page = await getArticle(slug);
  if (page === "not-found") notFound();
  if (!page) {
    return (
      <div className="site-container py-16">
        <h1 className="page-heading">This story is taking a moment</h1>
        <p className="page-lead mt-2">We couldn&apos;t load it. Please refresh in a minute.</p>
      </div>
    );
  }

  const { article, related } = page;
  // the category in the link changed (e.g. an editor moved the story): send readers to the right address
  if (article.category && article.category.slug !== category) permanentRedirect(articleHref(article));

  const tone = toneFor(article.category?.color);
  const structured = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.published_at,
    dateModified: article.updated_at ?? article.published_at,
    author: [{ "@type": "Person", name: article.author.name }],
    image: article.cover?.large ? [article.cover.large] : undefined,
    publisher: { "@type": "Organization", name: "Cendol Satay" },
  };

  return (
    <article className="article-page flex flex-col gap-10 pt-6 pb-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <ViewCounter slug={article.slug} />

      <header className="article-header site-container flex max-w-3xl flex-col gap-4">
        <nav className="article-breadcrumb flex flex-wrap items-center gap-2 text-sm" aria-label="Breadcrumb">
          <Link href="/news" className="text-santan-500 hover:underline">
            News
          </Link>
          <span aria-hidden className="text-santan-400">/</span>
          {article.category ? (
            <Link href={`/news/${article.category.slug}`} className={`font-bold ${tone.text} hover:underline`}>
              {article.category.name}
            </Link>
          ) : null}
          {article.area ? (
            <>
              <span aria-hidden className="text-santan-400">·</span>
              <Link href={`/areas/${article.area.slug}`} className="text-santan-600 hover:underline dark:text-santan-300">
                {article.area.name}
              </Link>
            </>
          ) : null}
        </nav>
        <TruthBadge label={article.truth_label} breaking={article.is_breaking} />
        <h1 className="article-title font-display text-3xl leading-[1.12] font-black text-balance text-gula-900 sm:text-5xl dark:text-coconut">{article.title}</h1>
        {article.excerpt ? <p className="article-excerpt text-lg text-santan-600 sm:text-xl dark:text-santan-300">{article.excerpt}</p> : null}
        <div className="article-meta flex flex-wrap items-center justify-between gap-4 border-y border-santan-200 py-3 dark:border-santan-800">
          <div className="flex flex-col text-sm">
            <span className="font-bold text-gula-900 dark:text-coconut">By {article.author.name}</span>
            <span className="text-santan-500">
              {article.published_at ? <time dateTime={article.published_at}>{formatLongDate(article.published_at)}</time> : null} · {article.reading_minutes} min read
            </span>
          </div>
          <ShareButtons title={article.title} path={articleHref(article)} />
        </div>
      </header>

      {article.cover ? (
        <figure className="article-cover site-container flex max-w-5xl flex-col gap-2">
          <MediaImage media={article.cover} sizes="(min-width: 1024px) 1024px, 100vw" priority className="aspect-[16/9] w-full rounded-card object-cover" />
          {article.cover.caption || article.cover.credit ? (
            <figcaption className="text-sm text-santan-500">
              {article.cover.caption}
              {article.cover.credit ? <span className="ml-1 text-santan-400">Photo: {article.cover.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="article-main site-container flex max-w-3xl flex-col gap-10">
        {article.truth_label === "developing" ? (
          <p className="developing-note rounded-card border-l-4 border-satay-500 bg-gula-50 px-5 py-4 text-sm text-gula-800 dark:bg-gula-900 dark:text-gula-100">
            <strong>This story is developing.</strong> It was published quickly because it matters now. Our verifiers are still checking the facts, and we will update it.
          </p>
        ) : null}

        <RichText doc={article.body} />

        {article.corrections?.length ? (
          <section className="article-corrections flex flex-col gap-3 rounded-card bg-santan-100 p-5 dark:bg-santan-900" aria-labelledby="corrections-title">
            <h2 id="corrections-title" className="flex items-center gap-2 font-display text-lg font-extrabold text-gula-900 dark:text-coconut">
              <PencilLine className="size-5" aria-hidden />
              Corrections
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {article.corrections.map((c, i) => (
                <li key={i}>
                  <span className="text-santan-500">{formatDateTime(c.at)}:</span> {c.note}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {article.sources?.length ? (
          <section className="article-sources flex flex-col gap-3" aria-labelledby="sources-title">
            <h2 id="sources-title" className="font-display text-lg font-extrabold text-gula-900 dark:text-coconut">
              Sources
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {article.sources.map((s, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-bold tracking-wide text-santan-500 uppercase">{s.kind}</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
                      {s.label}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    <span className="font-medium">{s.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {article.tags?.length ? (
          <ul className="article-tags flex flex-wrap gap-2" aria-label="Topics">
            {article.tags.map((t) => (
              <li key={t.slug}>
                <Link href={`/topics/${t.slug}`} className="inline-flex h-8 items-center rounded-full bg-santan-100 px-3 text-sm font-medium text-santan-700 hover:bg-santan-200 dark:bg-santan-800 dark:text-santan-200">
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="article-share-end flex flex-col gap-3 border-t border-santan-200 pt-6 dark:border-santan-800">
          <p className="font-display font-extrabold text-gula-900 dark:text-coconut">Know someone who should see this?</p>
          <ShareButtons title={article.title} path={articleHref(article)} />
        </div>
      </div>

      {related.length ? (
        <section className="related-stories site-container flex flex-col gap-5" aria-labelledby="related-title">
          <h2 id="related-title" className="border-b-2 border-gula-900 pb-2 font-display text-2xl font-black text-gula-900 dark:border-santan-200 dark:text-coconut">
            More like this
          </h2>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <StoryCard key={r.slug} article={r} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="article-skeleton site-container flex max-w-3xl flex-col gap-4 py-8" aria-hidden>
      <div className="h-4 w-32 animate-pulse rounded bg-santan-200 dark:bg-santan-800" />
      <div className="h-12 w-full animate-pulse rounded bg-santan-200 dark:bg-santan-800" />
      <div className="h-12 w-2/3 animate-pulse rounded bg-santan-200 dark:bg-santan-800" />
      <div className="mt-4 aspect-[16/9] w-full animate-pulse rounded-card bg-santan-200 dark:bg-santan-800" />
    </div>
  );
}
