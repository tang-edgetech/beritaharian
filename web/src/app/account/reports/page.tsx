import { MyReportsList, type MyReportsFilter } from "@/components/civic/my-reports-list";
import { one, type SearchParams } from "@/types/routes";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Your reports", robots: { index: false } };

export default function MyReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="site-container h-96 max-w-3xl animate-pulse py-6" aria-busy />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const state = one((await searchParams).state);
  const filter: MyReportsFilter = state === "open" || state === "decided" ? state : "";
  return <MyReportsList state={filter} />;
}
