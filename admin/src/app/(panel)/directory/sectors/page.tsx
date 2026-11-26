"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { SectorIcon } from "@/components/directory/sector-icon";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { SortableList } from "@/components/sortable-list";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useSectors } from "@/lib/directory";
import { CATEGORY_COLORS } from "@/lib/news";
import { notify } from "@/lib/notify";
import type { MessageResponse, Sector } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function SectorsPage() {
  const query = useSectors();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  async function reorder(items: Sector[]) {
    queryClient.setQueryData(["directory-sectors"], items);
    try {
      notify.success((await api.put<MessageResponse>("admin/directory/sectors/order", { slugs: items.map((s) => s.slug) })).message);
    } catch (error) {
      notify.error(error);
      await queryClient.invalidateQueries({ queryKey: ["directory-sectors"] });
    }
  }

  async function remove(sector: Sector) {
    const ok = await confirm({ title: `Delete “${sector.name}”?`, description: "Only sectors with no places can be deleted.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/directory/sectors/${sector.slug}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["directory-sectors"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Sectors"
        description="The kinds of places readers browse, and the details each kind fills in. Drag to change the order of menus and filters."
        actions={
          <Button asChild>
            <Link href="/directory/sectors/create">
              <Plus />
              Add sector
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
          getId={(s) => s.slug}
          handleLabel={(s) => `Move ${s.name}`}
          onReorder={reorder}
          renderItem={(s) => (
            <div className="sector-row flex flex-1 items-center gap-3 py-3 pr-3">
              <span className={`sector-row-icon grid size-9 shrink-0 place-items-center rounded-full text-white ${CATEGORY_COLORS.find((c) => c.value === s.color)?.swatch ?? ""}`} aria-hidden>
                <SectorIcon name={s.icon} className="size-4" />
              </span>
              <Link href={`/directory/sectors/${s.slug}`} className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium hover:underline">{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {s.fields.length ? s.fields.map((f) => f.label).join(", ") : "No extra details"}
                </span>
              </Link>
              {!s.is_active ? <StatusBadge tone="neutral">Hidden</StatusBadge> : null}
              <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">{s.places_count ?? 0} places</span>
              <IconAction icon={Pencil} label="Edit" href={`/directory/sectors/${s.slug}`} />
              <IconAction icon={Trash2} label={s.places_count ? "Has places, can't delete" : "Delete"} danger disabled={Boolean(s.places_count)} onClick={() => remove(s)} />
            </div>
          )}
        />
      )}
    </>
  );
}
