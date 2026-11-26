import { MapExplorer } from "@/components/places/map-explorer";
import { getPins, getSectors } from "@/lib/places";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Map of Melaka",
  description: "Every place on Cendol Satay on one map, with near me on your phone.",
  alternates: { canonical: "/map" },
};

export default function MapPage() {
  return (
    <>
      <h1 className="sr-only">Map of places in Melaka</h1>
      <Suspense fallback={<div className="h-[calc(100dvh-7.5rem)] animate-pulse bg-santan-100 dark:bg-santan-900" aria-busy />}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const [sectors, pins] = await Promise.all([getSectors(), getPins({})]);
  return <MapExplorer sectors={sectors} pins={pins} />;
}
