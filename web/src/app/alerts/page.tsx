import { AlertsExplorer } from "@/components/civic/alerts-explorer";
import { alertFiltersFromSearch } from "@/lib/alert-links";
import { getAlertPins, getAlerts, getAlertTypes } from "@/lib/alerts";
import { getAreas } from "@/lib/news";
import type { SearchParams } from "@/types/routes";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Alerts in Melaka",
  description: "Floods, road hazards and other incidents in Melaka, checked by the Cendol Satay team before they go up.",
  alternates: { canonical: "/alerts" },
};

export default function AlertsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="alerts-page site-container flex flex-col gap-5 pt-4 sm:pt-6">
      <Link href="/" className="back-link hidden items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline sm:inline-flex dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Today&apos;s news
      </Link>
      <header className="alerts-header flex flex-col gap-1">
        <h1 className="page-heading">Alerts in Melaka</h1>
        <p className="page-lead">Reports from readers that our team has checked. Only our own summary and blurred photos are shown.</p>
      </header>
      <Suspense fallback={<AlertsSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const filters = alertFiltersFromSearch(await searchParams);
  const [types, areas, page, pins] = await Promise.all([getAlertTypes(), getAreas(), getAlerts(filters), getAlertPins(filters)]);
  return <AlertsExplorer types={types} areas={areas} filters={filters} page={page} pins={pins} />;
}

function AlertsSkeleton() {
  return (
    <div className="alerts-skeleton grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-busy>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
        ))}
      </div>
      <div className="order-first h-[50dvh] animate-pulse rounded-card bg-santan-100 lg:order-last lg:h-[70vh] dark:bg-santan-900" />
    </div>
  );
}
