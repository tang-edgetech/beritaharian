"use client";

import { errorMessage, FormMessage } from "@/components/account/auth-ui";
import { ListingForm } from "./listing-form";
import { PhotosPanel } from "./photos-panel";
import { ReviewsPanel } from "./reviews-panel";
import { readerApi, requireReader } from "@/lib/auth";
import { placeHref } from "@/lib/place-links";
import type { BusinessFull } from "@cendol/api-client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const TABS = [
  { key: "listing", label: "Details & hours" },
  { key: "photos", label: "Photos" },
  { key: "reviews", label: "Reviews" },
] as const;

/** The owner's tools for one place. Each tab is its own address (see app/business/[id]/[tab]). */
export function BusinessTab() {
  const { id, tab } = useParams<{ id: string; tab: string }>();
  const router = useRouter();
  const [place, setPlace] = useState<BusinessFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = TABS.find((t) => t.key === tab);

  const load = useCallback(() => {
    readerApi
      .get<{ data: BusinessFull }>(`me/businesses/${id}`)
      .then((r) => setPlace(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(() => {
    if (requireReader(router, `/business/${id}/${tab}`)) return;
    load();
  }, [router, id, tab, load]);

  if (!current) notFound();

  return (
    <div className="business-page site-container flex max-w-3xl flex-col gap-5 py-6">
      <Link href="/business" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Places you manage
      </Link>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {!place && !error ? <div className="h-64 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" aria-busy /> : null}
      {place ? (
        <>
          <header className="flex flex-col gap-2">
            <h1 className="page-heading">{place.name}</h1>
            {place.status === "active" ? (
              <Link href={placeHref(place.sector?.slug, place.slug)} className="inline-flex items-center gap-1 self-start text-sm font-bold text-pandan-700 hover:underline dark:text-pandan-300">
                See your public page
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            ) : (
              <p className="rounded-xl bg-marigold-50 px-4 py-2 text-sm dark:bg-gula-900">
                {place.status === "pending" ? "Waiting for a moderator to approve this place. You can get it ready in the meantime." : `This place is off the map${place.moderation_note ? `: ${place.moderation_note}` : "."}`}
              </p>
            )}
          </header>
          <nav className="route-tabs flex gap-1 overflow-x-auto border-b border-santan-200 dark:border-santan-800" aria-label="Manage this place">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/business/${id}/${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={`route-tab -mb-px inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-bold whitespace-nowrap ${t.key === tab ? "is-active border-gula-900 text-gula-900 dark:border-marigold-400 dark:text-coconut" : "border-transparent text-santan-500 hover:text-gula-900 dark:hover:text-coconut"}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {tab === "listing" ? <ListingForm key={place.id} place={place} onSaved={load} /> : tab === "photos" ? <PhotosPanel place={place} onChanged={load} /> : <ReviewsPanel placeId={place.id} />}
        </>
      ) : null}
    </div>
  );
}
