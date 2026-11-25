"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { UserStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelative, initials } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useRoles } from "@/lib/queries";
import type { MessageResponse, User } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, CircleCheck, Eye, PauseCircle, Pencil, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const bulk = (action: string) => (ids: string[]) => api.post<MessageResponse>("admin/users/bulk", { action, ids });

export default function UsersPage() {
  const { user: me, can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const roles = useRoles(can("roles.manage") || can("users.view"));

  const filters = useMemo<ListingFilter[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "active", label: "Active" },
          { value: "suspended", label: "Suspended" },
          { value: "banned", label: "Banned" },
        ],
      },
      { key: "role", label: "Role", type: "select", options: roles.data?.map((r) => ({ value: r.name, label: r.label })) ?? [] },
      { key: "verified", label: "Account confirmed", type: "select", options: [{ value: "yes", label: "Confirmed" }, { value: "no", label: "Not yet" }] },
      { key: "two_factor", label: "Two-step sign-in", type: "select", options: [{ value: "yes", label: "On" }, { value: "no", label: "Off" }] },
      { key: "trashed", label: "Bin", type: "select", options: [{ value: "with", label: "Include people in the bin" }, { value: "only", label: "Only people in the bin" }] },
      { key: "created_from", label: "Joined on or after", type: "date" },
      { key: "created_to", label: "Joined on or before", type: "date" },
    ],
    [roles.data],
  );

  const columns = useMemo<ListingColumn<User>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortKey: "name",
        hideable: false,
        cell: (user) => (
          <Link href={`/users/${user.id}/profile`} className="user-cell flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-pandan-100 text-xs font-bold text-pandan-800 dark:bg-pandan-900 dark:text-pandan-200">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="user-cell-text flex min-w-0 flex-col">
              <span className="user-cell-name truncate font-medium hover:underline">{user.name}</span>
              <span className="user-cell-email truncate text-xs text-muted-foreground">{user.email ?? user.phone}</span>
            </span>
          </Link>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        cell: (user) => <span className="text-sm">{user.roles?.map((r) => r.label).join(", ") || "—"}</span>,
      },
      { id: "status", header: "Status", sortKey: "status", cell: (user) => <UserStatusBadge status={user.status} deleted={Boolean(user.deleted_at)} /> },
      {
        id: "security",
        header: "Security",
        cell: (user) => (
          <span className="user-security flex flex-col text-xs text-muted-foreground">
            <span>{user.is_verified ? "Confirmed" : "Not confirmed"}</span>
            <span>{user.two_factor_enabled ? "Two-step on" : "Two-step off"}</span>
          </span>
        ),
      },
      { id: "phone", header: "Phone", hiddenByDefault: true, cell: (user) => user.phone ?? "—" },
      { id: "last_login_at", header: "Last sign-in", sortKey: "last_login_at", cell: (user) => <span className="text-sm whitespace-nowrap">{formatRelative(user.last_login_at)}</span> },
      { id: "created_at", header: "Joined", sortKey: "created_at", cell: (user) => <span className="text-sm whitespace-nowrap">{formatDate(user.created_at)}</span> },
    ],
    [],
  );

  const bulkActions: BulkAction[] = [
    ...(can("users.update")
      ? [
          { key: "activate", label: "Activate", icon: CircleCheck, run: bulk("activate") },
          {
            key: "suspend",
            label: "Suspend",
            icon: PauseCircle,
            confirm: (n: number) => ({
              title: `Suspend ${n} ${n === 1 ? "person" : "people"}?`,
              description: "They will be signed out and can't sign in until you activate them again.",
              confirmLabel: "Suspend",
              danger: true,
            }),
            run: bulk("suspend"),
          },
        ]
      : []),
    ...(can("users.delete")
      ? [
          {
            key: "delete",
            label: "Move to bin",
            icon: Trash2,
            danger: true,
            confirm: (n: number) => ({
              title: `Move ${n} ${n === 1 ? "person" : "people"} to the bin?`,
              description: "They will be signed out. You can restore them later from the Bin filter.",
              confirmLabel: "Move to bin",
              danger: true,
            }),
            run: bulk("delete"),
          },
          { key: "restore", label: "Restore", icon: ArchiveRestore, run: bulk("restore") },
        ]
      : []),
  ];

  async function removeOne(user: User) {
    const ok = await confirm({
      title: `Move ${user.name} to the bin?`,
      description: "They will be signed out straight away. You can restore them later.",
      confirmLabel: "Move to bin",
      danger: true,
    });
    if (!ok) return;
    try {
      const result = await api.delete<MessageResponse>(`admin/users/${user.id}`);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "users"] });
    } catch (error) {
      notify.error(error);
    }
  }

  async function restoreOne(user: User) {
    try {
      const result = await api.post<MessageResponse>(`admin/users/${user.id}/restore`);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "users"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with an account: staff, business owners and members of the public."
        actions={
          can("users.create") ? (
            <Button asChild>
              <Link href="/users/create">
                <UserPlus />
                Add user
              </Link>
            </Button>
          ) : null
        }
      />
      <DataListing<User>
        name="users"
        endpoint="admin/users"
        columns={columns}
        filters={filters}
        getRowId={(user) => user.id}
        searchPlaceholder="Search by name, email or phone"
        defaultSort="-created_at"
        bulkActions={bulkActions}
        canSelectRow={(user) => user.id !== me?.id}
        empty={{ title: "No users yet", description: "People appear here when they sign up or when you add them." }}
        rowActions={(user) => (
          <>
            <IconAction icon={Eye} label="View details" href={`/users/${user.id}/profile`} />
            {can("users.update") && !user.deleted_at ? <IconAction icon={Pencil} label="Edit" href={`/users/${user.id}/profile?edit=1`} /> : null}
            {can("users.update") && !user.deleted_at ? <IconAction icon={ShieldCheck} label="Roles and access" href={`/users/${user.id}/access`} /> : null}
            {can("users.delete") && user.deleted_at ? <IconAction icon={ArchiveRestore} label="Restore" onClick={() => restoreOne(user)} /> : null}
            {can("users.delete") && !user.deleted_at ? (
              <IconAction icon={Trash2} label={user.id === me?.id ? "You can't delete yourself" : "Move to bin"} danger onClick={() => removeOne(user)} disabled={user.id === me?.id} />
            ) : null}
          </>
        )}
      />
    </>
  );
}
