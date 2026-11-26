import { Stars } from "@/components/places/place-bits";
import { ReviewItem } from "@/components/places/review-item";
import { placeHref, ratingText } from "@/lib/place-links";
import { getPlace, getPlaceReviews, type ReviewSort } from "@/lib/places";
import { one, type RouteParams, type SearchParams } from "@/types/routes";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

type Props = { params: RouteParams<"sector" | "slug">; searchParams: SearchParams };

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "helpful", label: "Most helpful" },
  { value: "highest", label: "Highest" },
  { value: "lowest", label: "Lowest" },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place || place === "not-found") return { title: "Reviews" };
  return { title: `Reviews of ${place.name}`, alternates: { canonical: `${placeHref(place.sector?.slug, place.slug)}/reviews` } };
}

export default function PlaceReviewsPage(props: Props) {
  return (
    <Suspense fallback={<div className="site-container h-96 animate-pulse py-6" aria-busy />}>
      <Reviews {...props} />
    </Suspense>
  );
}

async function Reviews({ params, searchParams }: Props) {
  const [{ sector, slug }, search] = await Promise.all([params, searchParams]);
  const place = await getPlace(slug);
  if (place === "not-found") notFound();
  if (!place) return <p className="site-container py-16">We couldn&apos;t load these reviews. Please refresh in a minute.</p>;
  const base = placeHref(place.sector?.slug, place.slug);
  if (place.sector && place.sector.slug !== sector) permanentRedirect(`${base}/reviews`);

  const sort = (SORTS.find((s) => s.value === one(search.sort))?.value ?? "newest") as ReviewSort;
  const rating = [1, 2, 3, 4, 5].includes(Number(one(search.rating))) ? Number(one(search.rating)) : 0;
  const page = Math.max(1, Number(one(search.page)) || 1);
  const result = await getPlaceReviews(place.slug, sort, rating, page);

  const link = (next: { sort?: ReviewSort; rating?: number; page?: number }) => {
    const params = new URLSearchParams();
    const s = next.sort ?? sort;
    const r = next.rating ?? rating;
    if (s !== "newest") params.set("sort", s);
    if (r) params.set("rating", String(r));
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const q = params.toString();
    return q ? `${base}/reviews?${q}` : `${base}/reviews`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-sm font-bold whitespace-nowrap ${active ? "bg-gula-900 text-coconut dark:bg-marigold-400 dark:text-gula-900" : "border border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"}`;

  return (
    <div className="place-reviews-page site-container flex max-w-3xl flex-col gap-5 pt-4">
      <Link href={base} className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Back to {place.name}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">Reviews of {place.name}</h1>
        <p className="flex flex-wrap items-center gap-2">
          {place.rating_count ? <Stars value={place.rating_avg} size="md" /> : null}
          <span className="font-bold">{ratingText(place.rating_avg, place.rating_count)}</span>
        </p>
      </header>

      <nav className="review-filters flex flex-col gap-2" aria-label="Sort and filter reviews">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <Link key={s.value} href={link({ sort: s.value })} className={chip(s.value === sort)} aria-current={s.value === sort ? "true" : undefined}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={link({ rating: 0 })} className={chip(rating === 0)}>
            All stars
          </Link>
          {[5, 4, 3, 2, 1].map((n) => (
            <Link key={n} href={link({ rating: n })} className={chip(rating === n)} aria-label={`${n} stars only`}>
              {n}★
            </Link>
          ))}
        </div>
      </nav>

      {!result ? (
        <p className="rounded-card bg-marigold-50 p-5 text-sm dark:bg-gula-900">We couldn&apos;t load these reviews. Please refresh in a minute.</p>
      ) : result.data.length === 0 ? (
        <p className="rounded-card bg-santan-100 p-5 text-santan-600 dark:bg-santan-900 dark:text-santan-300">No reviews match. Try another filter.</p>
      ) : (
        <div className="review-list flex flex-col">
          {result.data.map((review) => (
            <ReviewItem key={review.id} review={review} slug={place.slug} />
          ))}
        </div>
      )}

      {result && result.meta.last_page > 1 ? (
        <nav className="reviews-pager flex items-center justify-between gap-4 border-t border-santan-200 pt-4 dark:border-santan-800" aria-label="More reviews">
          {page > 1 ? (
            <Link href={link({ page: page - 1 })} className="pager-link inline-flex h-10 items-center gap-1 rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-santan-500 tabular-nums">
            Page {page} of {result.meta.last_page}
          </span>
          {page < result.meta.last_page ? (
            <Link href={link({ page: page + 1 })} className="pager-link inline-flex h-10 items-center gap-1 rounded-full border border-santan-300 px-4 text-sm font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
