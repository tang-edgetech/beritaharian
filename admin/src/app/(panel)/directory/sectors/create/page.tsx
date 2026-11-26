"use client";

import { SectorForm } from "@/components/directory/sector-form";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "next/navigation";

export default function CreateSectorPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader back="/directory/sectors" backLabel="Sectors" title="Add a sector" />
      <SectorForm onSaved={(saved) => router.replace(`/directory/sectors/${saved.slug}`)} />
    </>
  );
}
