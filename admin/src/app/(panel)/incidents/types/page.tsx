"use client";

import { IncidentTypeIcon, SeverityBadge } from "@/components/civic/incident-badges";
import { useConfirm } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useIncidentTypes } from "@/lib/civic";
import { notify } from "@/lib/notify";
import type { AdminIncidentType, IncidentTypeInput, MessageResponse } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function IncidentTypesPage() {
  const { can } = useAuth();
  const allowed = can("incidents.types");
  const query = useIncidentTypes(allowed);
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  async function reorder(items: AdminIncidentType[]) {
    queryClient.setQueryData(["incident-types"], items);
    try {
      notify.success((await api.put<MessageResponse>("admin/incident-types/order", { slugs: items.map((t) => t.slug) })).message);
    } catch (error) {
      notify.error(error);
      await queryClient.invalidateQueries({ queryKey: ["incident-types"] });
    }
  }

  async function toggle(type: AdminIncidentType, on: boolean) {
    const input: IncidentTypeInput = {
      name: type.name,
      description: type.description ?? undefined,
      icon: type.icon,
      color: type.color,
      default_severity: type.default_severity,
      is_active: on,
    };
    queryClient.setQueryData<AdminIncidentType[]>(["incident-types"], (list) => list?.map((t) => (t.slug === type.slug ? { ...t, is_active: on } : t)));
    try {
      await api.put(`admin/incident-types/${type.slug}`, input);
      notify.success(on ? `“${type.name}” is on the report form.` : `“${type.name}” is hidden from the report form.`);
    } catch (error) {
      notify.error(error);
    }
    await queryClient.invalidateQueries({ queryKey: ["incident-types"] });
  }

  async function remove(type: AdminIncidentType) {
    const ok = await confirm({
      title: `Delete “${type.name}”?`,
      description: "Only types no report uses can be deleted. To hide a used type, turn it off instead.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/incident-types/${type.slug}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["incident-types"] });
    } catch (error) {
      notify.error(error);
    }
  }

  if (!allowed) return <p className="panel-card">You don&apos;t have permission to edit incident types.</p>;

  return (
    <>
      <PageHeader
        back="/incidents/queue/check"
        backLabel="Reports"
        title="Incident types"
        description="The kinds of incident readers choose from when they send a report. Drag to change the order on the form."
        actions={
          <Button asChild>
            <Link href="/incidents/types/create">
              <Plus />
              Add type
            </Link>
          </Button>
        }
      />
      {query.isPending ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : (
        <SortableList
          items={query.data}
          getId={(t) => t.slug}
          handleLabel={(t) => `Move ${t.name}`}
          onReorder={reorder}
          renderItem={(t) => (
            <div className={["incident-type-row flex flex-1 flex-wrap items-center gap-3 py-3 pr-3", t.is_active ? "" : "is-inactive"].join(" ")}>
              <IncidentTypeIcon type={t} />
              <Link href={`/incidents/types/${t.slug}`} className="flex min-w-0 flex-1 basis-40 flex-col">
                <span className="font-medium hover:underline">{t.name}</span>
                <span className="truncate text-xs text-muted-foreground">{t.description || "No description"}</span>
              </Link>
              <span className="hidden sm:inline-flex">
                <SeverityBadge severity={t.default_severity} />
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {t.incidents_count ?? 0} report{t.incidents_count === 1 ? "" : "s"}
              </span>
              <label htmlFor={`incident-type-active-${t.slug}`} className="flex items-center gap-2 text-sm">
                <Switch id={`incident-type-active-${t.slug}`} checked={t.is_active} onCheckedChange={(on) => toggle(t, on)} />
                <span className="w-12">{t.is_active ? "On" : "Off"}</span>
              </label>
              <IconAction icon={Pencil} label="Edit" href={`/incidents/types/${t.slug}`} />
              <IconAction icon={Trash2} label="Delete" danger onClick={() => remove(t)} />
            </div>
          )}
        />
      )}
    </>
  );
}
