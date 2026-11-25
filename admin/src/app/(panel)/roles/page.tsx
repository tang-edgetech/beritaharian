"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { SortableList } from "@/components/sortable-list";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useRoles } from "@/lib/queries";
import type { MessageResponse, Role } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";

export default function RolesPage() {
  const roles = useRoles();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  async function reorder(next: Role[]) {
    const previous = roles.data;
    queryClient.setQueryData(["roles"], next);
    try {
      const result = await api.put<MessageResponse>("admin/roles/order", { names: next.map((r) => r.name) });
      notify.success(result.message);
    } catch (error) {
      queryClient.setQueryData(["roles"], previous);
      notify.error(error);
    }
  }

  async function remove(role: Role) {
    const ok = await confirm({
      title: `Delete the “${role.label}” role?`,
      description: "This can't be undone. Roles that people still have can't be deleted.",
      confirmLabel: "Delete role",
      danger: true,
    });
    if (!ok) return;
    try {
      const result = await api.delete<MessageResponse>(`admin/roles/${role.name}`);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Each role is a set of things a person may do. Drag the handle to change the order roles appear in."
        actions={
          <Button asChild>
            <Link href="/roles/create">
              <Plus />
              New role
            </Link>
          </Button>
        }
      />
      {roles.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : roles.isError ? (
        <p className="panel-card">{roles.error.message}</p>
      ) : (
        <SortableList
          items={roles.data}
          getId={(role) => role.name}
          onReorder={reorder}
          handleLabel={(role) => `Move ${role.label}`}
          renderItem={(role) => (
            <div className="role-row flex flex-wrap items-center gap-3 py-3 pr-3">
              <div className="role-row-text flex min-w-0 flex-1 flex-col">
                <span className="role-row-title flex items-center gap-2 font-medium">
                  {role.label}
                  {role.is_locked ? <StatusBadge tone="warning">Full access</StatusBadge> : role.is_system ? <StatusBadge tone="neutral">Built-in</StatusBadge> : null}
                </span>
                {role.description ? <span className="role-row-description truncate text-sm text-muted-foreground">{role.description}</span> : null}
              </div>
              <span className="role-row-meta flex items-center gap-4 text-sm text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1" title="People with this role">
                  <Users className="size-4" /> {role.users_count ?? 0}
                </span>
                <span title="Permissions in this role">{role.is_locked ? "All permissions" : role.permissions.length === 1 ? "1 permission" : `${role.permissions.length} permissions`}</span>
              </span>
              <span className="role-row-actions flex gap-0.5">
                {role.is_locked ? (
                  <IconAction icon={Lock} label="Super admin always has every permission" disabled />
                ) : (
                  <IconAction icon={Pencil} label="Edit role" href={`/roles/${role.name}`} />
                )}
                <IconAction
                  icon={Trash2}
                  label={role.is_system ? "Built-in roles can't be deleted" : "Delete role"}
                  danger
                  disabled={role.is_system}
                  onClick={() => remove(role)}
                />
              </span>
            </div>
          )}
        />
      )}
    </>
  );
}
