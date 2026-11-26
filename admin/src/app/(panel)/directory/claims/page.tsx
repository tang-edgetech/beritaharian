"use client";

import { ClaimListing, ClaimTabs } from "@/components/directory/claim-listing";
import { PageHeader } from "@/components/page-header";

export default function ClaimsPage() {
  return (
    <>
      <PageHeader title="Ownership claims" description="Owners asking to manage their place. Check the SSM number or the document, then decide." />
      <ClaimTabs />
      <ClaimListing />
    </>
  );
}
