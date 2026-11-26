import { BusinessTab } from "@/components/business/business-tab";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Manage your place", robots: { index: false } };

export default function BusinessTabPage() {
  return (
    <Suspense fallback={<div className="site-container h-96 animate-pulse py-6" aria-busy />}>
      <BusinessTab />
    </Suspense>
  );
}
