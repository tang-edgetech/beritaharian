import { PlacesPageBody, PlacesSkeleton } from "@/components/places/places-page";
import type { SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Places in Melaka",
  description: "Hawker stalls, cafés, stays and services across Melaka on one map, with reviews from people who really visited.",
  alternates: { canonical: "/places" },
};

export default function PlacesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PlacesSkeleton />}>
      <PlacesPageBody sectorSlug={null} searchParams={searchParams} />
    </Suspense>
  );
}
