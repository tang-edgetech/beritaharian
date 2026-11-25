"use client";

import { TwoFactorPanel } from "@/components/account/two-factor-panel";
import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { notify } from "@/lib/notify";
import { ApiError, type MessageResponse, type Session, type User } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, MonitorSmartphone } from "lucide-react";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

function ProfileForm({ user }: { user: User }) {
  const { refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [displayName, setDisplayName] = useState(user.profile?.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.put<MessageResponse>("account/profile", {
        name,
        display_name: displayName || null,
        user_type: user.profile?.user_type ?? null,
        preferred_locale: user.profile?.preferred_locale ?? "en",
      });
      notify.success(result.message);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) setError(e.fieldError("name") ?? "");
      notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-profile-form panel-card flex flex-col gap-5" onSubmit={submit}>
      <h2 className="panel-card-title">Your details</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="account-name" label="Full name" error={error}>
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField id="account-display-name" label="Name shown on articles (optional)" hint="For example, a by-line like “Aisyah R.”">
          <Input id="account-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormField>
        <FormField id="account-email" label="Email" hint="Ask a super admin to change your sign-in email.">
          <Input id="account-email" value={user.email ?? ""} disabled />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const result = await api.put<MessageResponse>("account/password", { current_password: current, password: next, password_confirmation: again });
      notify.success(result.message);
      setCurrent("");
      setNext("");
      setAgain("");
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION_FAILED") {
        setErrors({ current: e.fieldError("current_password") ?? "", next: e.fieldError("password") ?? "" });
      } else notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-password-form panel-card flex flex-col gap-5" onSubmit={submit}>
      <div>
        <h2 className="panel-card-title">Password</h2>
        <p className="panel-card-description">Changing it signs you out on every other device.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="password-current" label="Current password" error={errors.current}>
          <Input id="password-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </FormField>
        <FormField id="password-new" label="New password" error={errors.next} hint="At least 10 characters.">
          <Input id="password-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </FormField>
        <FormField id="password-again" label="Type it again" error={again && again !== next ? "The two new passwords don't match." : undefined}>
          <Input id="password-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !current || !next || next !== again}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Change password
        </Button>
      </div>
    </form>
  );
}

function SessionsPanel() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<{ data: Session[] }>("account/sessions").then((r) => r.data),
  });

  async function revoke(path: string, title: string) {
    if (!(await confirm({ title, confirmLabel: "Sign out" }))) return;
    try {
      const result = await api.delete<MessageResponse>(path);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (e) {
      notify.error(e);
    }
  }

  const others = sessions.data?.filter((s) => !s.is_current).length ?? 0;

  return (
    <section className="sessions-panel panel-card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-card-title">Where you&apos;re signed in</h2>
          <p className="panel-card-description">Sign out anywhere you don&apos;t recognise.</p>
        </div>
        <Button variant="outline" disabled={!others} onClick={() => revoke("account/sessions/others", "Sign out of all other devices?")}>
          <LogOut /> Sign out everywhere else
        </Button>
      </div>
      {sessions.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="sessions-list flex flex-col divide-y">
          {sessions.data?.map((session) => (
            <li key={session.id} className="session-item flex items-center gap-3 py-3">
              <MonitorSmartphone className="size-5 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {session.device}
                  {session.is_current ? <StatusBadge tone="good">This device</StatusBadge> : null}
                </span>
                <span className="text-xs text-muted-foreground">Last active {formatRelative(session.last_used_at ?? session.created_at)}</span>
              </span>
              {!session.is_current ? (
                <IconAction icon={LogOut} label="Sign out this device" onClick={() => revoke(`account/sessions/${session.id}`, `Sign out “${session.device}”?`)} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AccountTabPage() {
  const { tab } = useParams<{ tab: string }>();
  const search = useSearchParams();
  const { user, twoFactorSetupRequired } = useAuth();

  if (tab !== "profile" && tab !== "security") notFound();

  return (
    <>
      <PageHeader title="My account" description="Your own details and sign-in security." />
      <RouteTabs
        label="Account sections"
        tabs={[
          { href: "/account/profile", label: "Profile" },
          { href: "/account/security", label: "Password & security" },
        ]}
      />
      {tab === "security" && (search.get("setup") || twoFactorSetupRequired) && !user?.two_factor_enabled ? (
        <p className="setup-required-notice rounded-lg border border-marigold-300 bg-marigold-50 p-4 text-sm dark:border-marigold-800 dark:bg-marigold-900/30">
          <strong>One more step.</strong> Your role needs two-step sign-in before you can use the rest of the admin panel. It takes about a minute.
        </p>
      ) : null}
      {!user ? null : tab === "profile" ? (
        <ProfileForm key={user.id} user={user} />
      ) : (
        <div className="account-security flex flex-col gap-6">
          <TwoFactorPanel required={twoFactorSetupRequired || Boolean(search.get("setup"))} />
          <PasswordForm />
          <SessionsPanel />
        </div>
      )}
    </>
  );
}
