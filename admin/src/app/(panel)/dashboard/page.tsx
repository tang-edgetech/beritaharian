"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { KeyRound, Newspaper, Settings, ShieldCheck, Store, Siren, Users } from "lucide-react";
import Link from "next/link";

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("en-MY", { hour: "numeric", hour12: false, timeZone: "Asia/Kuala_Lumpur" }).format(new Date()));
  return hour < 12 ? "Selamat pagi" : hour < 19 ? "Selamat petang" : "Selamat malam";
};

/** Areas arriving in later phases, so staff can see what's coming. */
const COMING = [
  { icon: Newspaper, title: "News", phase: "Phase 1", text: "Write, fact-check and publish articles." },
  { icon: Store, title: "Directory", phase: "Phase 2", text: "Business listings, claims and reviews." },
  { icon: Siren, title: "Civic reports", phase: "Phase 3", text: "Incident reports, verification and evidence packs." },
];

export default function DashboardPage() {
  const { user, can } = useAuth();

  const shortcuts = [
    can("users.view") && { href: "/users", icon: Users, label: "Users", text: "Find people, change roles, suspend accounts." },
    can("roles.manage") && { href: "/roles", icon: KeyRound, label: "Roles & permissions", text: "Decide who can do what." },
    can("settings.manage") && { href: "/settings/general", icon: Settings, label: "Settings", text: "Site name, languages, security rules." },
    { href: "/account/security", icon: ShieldCheck, label: "Your security", text: user?.two_factor_enabled ? "Two-step sign-in is on." : "Turn on two-step sign-in." },
  ].filter(Boolean) as { href: string; icon: typeof Users; label: string; text: string }[];

  return (
    <>
      <PageHeader title={`${greeting()}, ${user?.name.split(" ")[0] ?? ""}`} description="Here's what you can do in the admin panel today." />

      <section className="dashboard-shortcuts grid gap-3 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="dashboard-shortcut panel-card group flex items-start gap-4 transition-colors hover:border-pandan-300 hover:bg-pandan-50/50 dark:hover:bg-pandan-950/40"
          >
            <span className="dashboard-shortcut-icon flex size-10 shrink-0 items-center justify-center rounded-lg bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-200">
              <item.icon className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="dashboard-shortcut-label font-heading font-bold group-hover:underline">{item.label}</span>
              <span className="dashboard-shortcut-text text-sm text-muted-foreground">{item.text}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="dashboard-coming flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">Coming next</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {COMING.map((item) => (
            <li key={item.title} className="dashboard-coming-item flex flex-col gap-2 rounded-xl border border-dashed p-4">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <item.icon className="size-4 text-marigold-600" />
                {item.title}
                <span className="ml-auto text-xs font-normal text-muted-foreground">{item.phase}</span>
              </span>
              <span className="text-sm text-muted-foreground">{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {!user?.two_factor_enabled ? (
        <div className="dashboard-security-nudge flex flex-wrap items-center justify-between gap-3 rounded-xl border border-marigold-300 bg-marigold-50 p-4 dark:border-marigold-800 dark:bg-marigold-900/30">
          <p className="text-sm">
            <strong>Protect your account.</strong> Two-step sign-in stops anyone who learns your password from getting in.
          </p>
          <Button asChild size="sm">
            <Link href="/account/security">Set it up</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
