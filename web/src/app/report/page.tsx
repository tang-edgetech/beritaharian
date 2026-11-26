import { ReportPageBody } from "@/components/civic/report-form";
import { getAlertTypes, getReportLimits } from "@/lib/alerts";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Report something",
  description: "Tell the Cendol Satay team about a flood, road hazard or anything happening on your street in Melaka.",
  alternates: { canonical: "/report" },
};

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="site-container h-96 max-w-3xl animate-pulse py-6" aria-busy />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const [types, limits] = await Promise.all([getAlertTypes(), getReportLimits()]);
  return <ReportPageBody types={types} limits={limits} />;
}
