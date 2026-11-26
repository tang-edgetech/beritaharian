"use client";

import { ClaimListing, ClaimTabs } from "@/components/directory/claim-listing";
import { PageHeader } from "@/components/page-header";

export default function DecidedClaimsPage() {
  return (
    <>
      <PageHeader back="/directory/claims" backLabel="Waiting claims" title="Ownership claims" description="Claims that were approved or turned down." />
      <ClaimTabs />
      <ClaimListing decided />
    </>
  );
}
