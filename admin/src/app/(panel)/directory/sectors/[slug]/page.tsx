"use client";

import { SectorForm } from "@/components/directory/sector-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Sector } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

export default function EditSectorPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["directory-sector", slug],
    queryFn: () => api.get<{ data: Sector }>(`admin/directory/sectors/${slug}`).then((r) => r.data),
  });

  return (
    <>
      <PageHeader
        back="/directory/sectors"
        backLabel="Sectors"
        title={query.data ? query.data.name : <Skeleton className="h-8 w-48" />}
        description={query.data ? `${query.data.places_count ?? 0} places in this sector` : null}
      />
      {query.isPending ? (
        <Skeleton className="h-96 w-full max-w-3xl rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : (
        <SectorForm key={query.dataUpdatedAt} sector={query.data} onSaved={(saved) => router.replace(`/directory/sectors/${saved.slug}`)} />
      )}
    </>
  );
}
