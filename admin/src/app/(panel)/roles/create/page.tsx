"use client";

import { PageHeader } from "@/components/page-header";
import { RoleForm } from "@/components/roles/role-form";
import { useRouter } from "next/navigation";

export default function CreateRolePage() {
  const router = useRouter();
  return (
    <>
      <PageHeader back="/roles" backLabel="Roles" title="New role" description="Give it a clear name, like “Night desk” or “Directory moderator”." />
      <RoleForm onSaved={() => router.push("/roles")} />
    </>
  );
}
