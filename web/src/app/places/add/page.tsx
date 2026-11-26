import { SuggestForm } from "@/components/places/suggest-form";
import { getAreas } from "@/lib/news";
import { getSectors } from "@/lib/places";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Add a place", robots: { index: false } };

export default function AddPlacePage() {
  return (
    <Suspense fallback={<div className="site-container h-96 animate-pulse py-6" aria-busy />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const [sectors, areas] = await Promise.all([getSectors(), getAreas()]);
  return <SuggestForm sectors={sectors} areas={areas} />;
}
