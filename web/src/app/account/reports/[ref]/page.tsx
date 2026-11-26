import { MyReportView } from "@/components/civic/my-report-view";
import { getReportLimits } from "@/lib/alerts";
import type { RouteParams } from "@/types/routes";
import type { Metadata } from "next";
import { Suspense } from "react";

type Props = { params: RouteParams<"ref"> };

export const metadata: Metadata = { title: "Your report", robots: { index: false } };

export default function MyReportPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="site-container h-96 max-w-3xl animate-pulse py-6" aria-busy />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Props) {
  const [{ ref }, limits] = await Promise.all([params, getReportLimits()]);
  return <MyReportView key={ref} reference={decodeURIComponent(ref)} limits={limits} />;
}
