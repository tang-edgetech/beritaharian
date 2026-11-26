"use client";

import { IncidentTypeForm } from "@/components/civic/incident-type-form";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function CreateIncidentTypePage() {
  const router = useRouter();
  const { can } = useAuth();

  return (
    <>
      <PageHeader back="/incidents/types" backLabel="Incident types" title="Add an incident type" />
      {can("incidents.types") ? (
        <IncidentTypeForm onSaved={(saved) => router.replace(`/incidents/types/${saved.slug}`)} />
      ) : (
        <p className="panel-card">You don&apos;t have permission to edit incident types.</p>
      )}
    </>
  );
}
