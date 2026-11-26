import { WriteReviewForm } from "@/components/places/write-review-form";
import { placeHref } from "@/lib/place-links";
import { getPlace } from "@/lib/places";
import type { RouteParams } from "@/types/routes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = { params: RouteParams<"sector" | "slug"> };

export const metadata: Metadata = { title: "Write a review", robots: { index: false } };

export default function WriteReviewPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="site-container h-96 animate-pulse py-6" aria-busy />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Props) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (place === "not-found") notFound();
  if (!place) return <p className="site-container py-16">We couldn&apos;t load this place. Please refresh in a minute.</p>;
  return <WriteReviewForm place={place} base={placeHref(place.sector?.slug, place.slug)} />;
}
