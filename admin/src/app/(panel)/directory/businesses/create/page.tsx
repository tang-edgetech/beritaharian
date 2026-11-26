"use client";

import { BusinessForm } from "@/components/directory/business-form";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "next/navigation";

export default function CreatePlacePage() {
  const router = useRouter();

  return (
    <>
      <PageHeader back="/directory/businesses" backLabel="Places" title="Add a place" description="Fill in what you know. Photos can be added after saving." />
      <BusinessForm onSaved={(saved) => router.replace(`/directory/businesses/${saved.id}/details`)} />
    </>
  );
}
