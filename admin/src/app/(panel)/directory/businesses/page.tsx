"use client";

import { StatTile } from "@/components/billing/money-text";
import { BusinessListing } from "@/components/directory/business-listing";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDirectorySummary } from "@/lib/directory";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function PlacesPage() {
  const { can } = useAuth();
  const summary = useDirectorySummary();
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Places"
        description="Every business and place on Peta Melaka. Readers' suggestions wait here for approval."
        actions={
          can("directory.manage") ? (
            <Button asChild>
              <Link href="/directory/businesses/create">
                <Plus />
                Add a place
              </Link>
            </Button>
          ) : null
        }
      />
      {s ? (
        <div className="directory-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/directory/businesses?status=active" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
            <StatTile label="On the map">{s.places}</StatTile>
          </Link>
          {can("directory.claims") ? (
            <>
              <Link href="/directory/businesses?status=pending" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
                <StatTile label="Waiting for approval" tone={s.new_places ? "warning" : undefined}>
                  {s.new_places}
                </StatTile>
              </Link>
              <Link href="/directory/claims" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
                <StatTile label="Ownership claims" tone={s.claims ? "warning" : undefined}>
                  {s.claims}
                </StatTile>
              </Link>
            </>
          ) : null}
          {can("reviews.moderate") ? (
            <Link href="/reviews" className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
              <StatTile label="Reviews to check" tone={s.reviews_to_check ? "warning" : undefined}>
                {s.reviews_to_check}
                {s.reported_reviews ? <span className="ml-2 text-sm font-semibold text-red-700 dark:text-red-300">{s.reported_reviews} reported</span> : null}
              </StatTile>
            </Link>
          ) : null}
        </div>
      ) : null}
      <BusinessListing />
    </>
  );
}
