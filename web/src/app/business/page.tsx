"use client";

import { errorMessage, FormMessage } from "@/components/account/auth-ui";
import { Stars } from "@/components/places/place-bits";
import { FlashMessage } from "@/components/site/flash-message";
import { readerApi, requireReader } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CLAIM_STATUS_LABEL, placeHref } from "@/lib/place-links";
import type { MyBusinesses } from "@cendol/api-client";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "On the map", tone: "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100" },
  pending: { label: "Waiting for approval", tone: "bg-marigold-100 text-marigold-800 dark:bg-gula-800 dark:text-marigold-100" },
  suspended: { label: "Taken off the map", tone: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

/** Owner home: the places I manage and the claims I've sent. */
export default function BusinessHomePage() {
  const router = useRouter();
  const [data, setData] = useState<MyBusinesses | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (requireReader(router, "/business")) return;
    readerApi
      .get<{ data: MyBusinesses }>("me/businesses")
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [router]);

  return (
    <div className="business-home site-container flex max-w-3xl flex-col gap-6 py-6">
      <Link href="/account" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Your account
      </Link>
      <FlashMessage />
      <header className="flex flex-col gap-1">
        <h1 className="page-heading">Places you manage</h1>
        <p className="page-lead">Keep your hours and photos up to date, and answer reviews. It&apos;s free.</p>
      </header>
      {error ? <FormMessage>{error}</FormMessage> : null}

      {!data && !error ? (
        <div className="h-40 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" aria-busy />
      ) : data ? (
        <>
          {data.places.length ? (
            <ul className="business-list flex flex-col gap-3">
              {data.places.map((place) => {
                const status = STATUS[place.status];
                return (
                  <li key={place.id}>
                    <Link href={`/business/${place.id}/listing`} className="business-row flex items-center gap-3 rounded-card border border-santan-200 bg-white p-4 hover:shadow-md dark:border-santan-800 dark:bg-santan-900">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-display text-lg font-black text-gula-900 dark:text-coconut">{place.name}</span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-santan-500">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${status?.tone ?? ""}`}>{status?.label ?? place.status}</span>
                          {place.rating_count ? <Stars value={place.rating_avg} /> : null}
                          {place.open_reviews ? <span className="font-semibold text-satay-700 dark:text-satay-400">{place.open_reviews} reviews waiting for a reply</span> : null}
                        </span>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-santan-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-card bg-santan-100 p-6 text-santan-600 dark:bg-santan-900 dark:text-santan-300">
              <p>You don&apos;t manage any places yet.</p>
              <p className="text-sm">Find your business on the map and tap &ldquo;Own this place? Claim it&rdquo;, or add it if it isn&apos;t listed.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/places" className="inline-flex h-10 items-center rounded-full border border-santan-300 px-4 text-sm font-bold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              Find my business
            </Link>
            <Link href="/places/add" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
              <Plus className="size-4" aria-hidden />
              Add my business
            </Link>
          </div>

          {data.claims.length ? (
            <section className="business-claims flex flex-col gap-3" aria-labelledby="claims-title">
              <h2 id="claims-title" className="font-display text-xl font-black">
                Your claims
              </h2>
              <ul className="flex flex-col gap-2">
                {data.claims.map((claim) => {
                  const status = CLAIM_STATUS_LABEL[claim.status];
                  return (
                    <li key={claim.id} className="flex flex-col gap-1 rounded-xl border border-santan-200 p-3 text-sm dark:border-santan-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {claim.place ? (
                          <Link href={placeHref(claim.place.sector, claim.place.slug)} className="font-bold hover:underline">
                            {claim.place.name}
                          </Link>
                        ) : null}
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${status?.tone ?? ""}`}>{status?.label ?? claim.status}</span>
                      </div>
                      <span className="text-santan-500">Sent {formatDate(claim.created_at)}</span>
                      {claim.status === "rejected" && claim.decision_note ? <span className="text-red-800 dark:text-red-200">Why: {claim.decision_note}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
