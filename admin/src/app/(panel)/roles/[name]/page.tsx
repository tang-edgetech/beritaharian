"use client";

import { PageHeader } from "@/components/page-header";
import { RoleForm } from "@/components/roles/role-form";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Role } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function EditRolePage() {
  const { name } = useParams<{ name: string }>();
  const role = useQuery({
    queryKey: ["role", name],
    queryFn: () => api.get<{ data: Role }>(`admin/roles/${name}`).then((r) => r.data),
  });

  return (
    <>
      <PageHeader
        back="/roles"
        backLabel="Roles"
        title={role.data ? `Edit “${role.data.label}”` : <Skeleton className="h-8 w-56" />}
        description={role.data ? `${role.data.users_count ?? 0} people have this role. Changes apply to them straight away.` : null}
      />
      {role.isPending ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : role.isError ? (
        <p className="panel-card">{role.error.message}</p>
      ) : role.data.is_locked ? (
        <p className="panel-card">The super admin role always has every permission and can&apos;t be edited.</p>
      ) : (
        <RoleForm key={role.data.name} role={role.data} />
      )}
    </>
  );
}
