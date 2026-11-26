"use client";

import { IncidentTypeForm } from "@/components/civic/incident-type-form";
import { useConfirm } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import type { AdminIncidentType, MessageResponse } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function EditIncidentTypePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const allowed = can("incidents.types");
  const query = useQuery({
    queryKey: ["incident-type", slug],
    queryFn: () => api.get<{ data: AdminIncidentType }>(`admin/incident-types/${slug}`).then((r) => r.data),
    enabled: allowed,
  });
  const t = query.data;

  async function remove() {
    if (!t) return;
    const ok = await confirm({
      title: `Delete “${t.name}”?`,
      description: "Only types no report uses can be deleted. To hide a used type, turn it off instead.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/incident-types/${t.slug}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["incident-types"] });
      router.replace("/incidents/types");
    } catch (error) {
      notify.error(error);
    }
  }

  if (!allowed) return <p className="panel-card">You don&apos;t have permission to edit incident types.</p>;

  return (
    <>
      <PageHeader
        back="/incidents/types"
        backLabel="Incident types"
        title={t ? t.name : <Skeleton className="h-8 w-48" />}
        description={
          t ? (
            <>
              {t.incidents_count ?? 0} report{t.incidents_count === 1 ? "" : "s"} use this type.{" "}
              {t.incidents_count ? (
                <Link href={`/incidents/queue/all?type=${t.slug}`} className="underline underline-offset-2">
                  See them
                </Link>
              ) : null}
            </>
          ) : null
        }
        actions={
          t ? (
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={remove}>
              <Trash2 />
              Delete
            </Button>
          ) : null
        }
      />
      {query.isPending ? (
        <Skeleton className="h-96 w-full max-w-3xl rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : (
        <IncidentTypeForm key={query.dataUpdatedAt} type={query.data} onSaved={(saved) => router.replace(`/incidents/types/${saved.slug}`)} />
      )}
    </>
  );
}
