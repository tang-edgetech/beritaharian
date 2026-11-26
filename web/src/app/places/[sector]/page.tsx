import { PlacesPageBody, PlacesSkeleton } from "@/components/places/places-page";
import { getSectors } from "@/lib/places";
import type { RouteParams, SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import { Suspense } from "react";

type Props = { params: RouteParams<"sector">; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sector: slug } = await params;
  const sector = (await getSectors()).find((s) => s.slug === slug);
  if (!sector) return { title: "Places" };
  return {
    title: `${sector.name} in Melaka`,
    description: sector.description ?? undefined,
    alternates: { canonical: `/places/${sector.slug}` },
  };
}

export default function SectorPlacesPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PlacesSkeleton />}>
      <SectorBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SectorBody({ params, searchParams }: Props) {
  const { sector } = await params;
  return <PlacesPageBody sectorSlug={sector} searchParams={searchParams} />;
}
