"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { AuditListing } from "@/components/logs/audit-listing";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { StatusBadge, UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserForm } from "@/components/users/user-form";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { MessageResponse, User } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldOff } from "lucide-react";
import { notFound, useParams } from "next/navigation";

const TABS = ["profile", "access", "security", "activity"] as const;
type Tab = (typeof TABS)[number];

function SecurityTab({ user }: { user: User }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  async function run(path: string, options: Parameters<typeof confirm>[0]) {
    if (!(await confirm(options))) return;
    try {
      const result = path.endsWith("two-factor")
        ? await api.delete<MessageResponse>(path)
        : await api.post<MessageResponse>(path);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["user", user.id] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <div className="user-security-tab grid gap-4 md:grid-cols-2">
      <section className="panel-card flex flex-col gap-3">
        <h2 className="panel-card-title">Sign-in</h2>
        <dl className="user-security-facts grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Account confirmed</dt>
          <dd>{user.is_verified ? `Yes, ${formatDateTime(user.email_verified_at ?? user.phone_verified_at)}` : "Not yet"}</dd>
          <dt className="text-muted-foreground">Two-step sign-in</dt>
          <dd>{user.two_factor_enabled ? <StatusBadge tone="good">On</StatusBadge> : <StatusBadge tone="neutral">Off</StatusBadge>}</dd>
          <dt className="text-muted-foreground">Last sign-in</dt>
          <dd>{formatRelative(user.last_login_at)}</dd>
        </dl>
      </section>
      {can("users.update") ? (
        <section className="panel-card flex flex-col gap-3">
          <h2 className="panel-card-title">Help with access</h2>
          <p className="panel-card-description">Use these when someone loses their phone or thinks their account was used by someone else.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                run(`admin/users/${user.id}/sign-out-everywhere`, {
                  title: `Sign ${user.name} out everywhere?`,
                  description: "They will need to sign in again on every device.",
                  confirmLabel: "Sign out everywhere",
                })
              }
            >
              <LogOut />
              Sign out everywhere
            </Button>
            <Button
              variant="destructive"
              disabled={!user.two_factor_enabled}
              onClick={() =>
                run(`admin/users/${user.id}/two-factor`, {
                  title: `Reset two-step sign-in for ${user.name}?`,
                  description: "Only do this after you have checked it's really them. They will set it up again next time they sign in.",
                  confirmLabel: "Reset",
                  danger: true,
                })
              }
            >
              <ShieldOff />
              Reset two-step sign-in
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function UserDetailPage() {
  const { id, tab } = useParams<{ id: string; tab: string }>();
  const { can } = useAuth();

  const query = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.get<{ data: User }>(`admin/users/${id}`).then((r) => r.data),
  });

  if (!TABS.includes(tab as Tab)) notFound();

  const user = query.data;
  const tabs = [
    { href: `/users/${id}/profile`, label: "Profile" },
    { href: `/users/${id}/access`, label: "Roles & access" },
    { href: `/users/${id}/security`, label: "Security" },
    ...(can("audit.view") ? [{ href: `/users/${id}/activity`, label: "Activity" }] : []),
  ];

  return (
    <>
      <PageHeader
        back="/users"
        backLabel="Users"
        title={user ? user.name : <Skeleton className="h-8 w-56" />}
        description={
          user ? (
            <span className="flex flex-wrap items-center gap-2">
              <UserStatusBadge status={user.status} deleted={Boolean(user.deleted_at)} />
              <span>{user.email}</span>
              <span aria-hidden>·</span>
              <span>Joined {formatDateTime(user.created_at)}</span>
            </span>
          ) : null
        }
      />
      <RouteTabs tabs={tabs} label="User sections" />
      {query.isPending ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : user ? (
        <>
          {tab === "profile" ? <UserForm key={`profile-${user.id}`} section="profile" user={user} /> : null}
          {tab === "access" ? <UserForm key={`access-${user.id}`} section="access" user={user} /> : null}
          {tab === "security" ? <SecurityTab user={user} /> : null}
          {tab === "activity" ? <AuditListing name={`user-activity-${user.id}`} extraQuery={{ "filter[subject_user]": user.id }} /> : null}
        </>
      ) : null}
    </>
  );
}
