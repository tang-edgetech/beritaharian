"use client";

import { PageHeader } from "@/components/page-header";
import { UserForm } from "@/components/users/user-form";
import { useRouter } from "next/navigation";

export default function CreateUserPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader back="/users" backLabel="Users" title="Add user" description="Staff accounts get their role here. Members of the public usually sign up themselves." />
      <UserForm section="create" onSaved={(user) => router.push(`/users/${user.id}/profile`)} />
    </>
  );
}
