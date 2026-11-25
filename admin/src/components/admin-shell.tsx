"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import {
  Banknote,
  Building2,
  ClipboardCheck,
  ChartColumn,
  FileMinus,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Settings,
  Sun,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the person has any of these. */
  permission?: string | string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Later phases add News, Directory, Reports and Billing sections here. */
const NAV: NavSection[] = [
  { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Newsroom",
    items: [
      { href: "/news", label: "Stories", icon: Newspaper, permission: ["news.write", "news.edit_any", "news.verify", "news.publish"] },
      { href: "/news/review", label: "Review queue", icon: ClipboardCheck, permission: ["news.verify", "news.publish"] },
      { href: "/news/categories", label: "Categories", icon: Tags, permission: "news.categories" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/users", label: "Users", icon: Users, permission: "users.view" },
      { href: "/roles", label: "Roles & permissions", icon: KeyRound, permission: "roles.manage" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/billing/invoices", label: "Invoices", icon: FileText, permission: "billing.view" },
      { href: "/billing/payments", label: "Payments", icon: Banknote, permission: "billing.view" },
      { href: "/billing/credit-notes", label: "Credit notes", icon: FileMinus, permission: "billing.view" },
      { href: "/billing/customers", label: "Customers", icon: Building2, permission: "billing.view" },
      { href: "/billing/expenses", label: "Expenses", icon: Wallet, permission: "billing.view" },
      { href: "/billing/reports", label: "Reports", icon: ChartColumn, permission: "billing.reports" },
    ],
  },
  {
    title: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  // the most specific link wins: /news/review lights "Review queue", not "Stories"
  const activeHref = NAV.flatMap((s) => s.items.map((i) => i.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="sidebar-nav flex flex-col gap-6" aria-label="Main">
      {NAV.map((section) => {
        const items = section.items.filter((item) => !item.permission || [item.permission].flat().some((p) => can(p)));
        if (!items.length) return null;
        return (
          <div key={section.title} className="sidebar-nav-section flex flex-col gap-1">
            <p className="sidebar-nav-heading px-3 text-[0.68rem] font-semibold tracking-[0.14em] text-sidebar-foreground/50 uppercase">
              {section.title}
            </p>
            {items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "sidebar-nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "is-active bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  ].join(" ")}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link href="/dashboard" className="sidebar-brand flex items-center gap-2.5 px-3">
      <Image src="/brand/cendol-satay-pin-icon-transparent.png" alt="" width={34} height={34} />
      <span className="sidebar-brand-name font-display text-lg font-black text-coconut lowercase">cendol satay</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

/** Bottom of the sidebar: avatar, name and role open the profile page; the button beside it signs out after a confirmation. */
function SidebarUser({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const confirm = useConfirm();
  const pathname = usePathname();
  if (!user) return null;

  const roleLabel = user.roles?.map((role) => role.label).join(", ") || "Staff";
  const active = pathname.startsWith("/account");

  async function handleSignOut() {
    if (await confirm({ title: "Sign out?", description: "You'll need your password to come back in.", confirmLabel: "Sign out" })) {
      await signOut();
    }
  }

  return (
    <div className="sidebar-user mt-auto flex items-center gap-1 border-t border-sidebar-border pt-4">
      <Link
        href="/account/profile"
        onClick={onNavigate}
        title="Open my profile"
        aria-current={active ? "page" : undefined}
        className={[
          "sidebar-user-link flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors",
          active ? "is-active bg-sidebar-accent" : "hover:bg-sidebar-accent",
        ].join(" ")}
      >
        <Avatar className="sidebar-user-avatar size-9">
          <AvatarFallback className="bg-marigold-300 text-xs font-bold text-gula-900">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="sidebar-user-text flex min-w-0 flex-col">
          <span className="sidebar-user-name truncate text-sm font-semibold text-sidebar-foreground">{user.name}</span>
          <span className="sidebar-user-role truncate text-xs text-sidebar-foreground/60">{roleLabel}</span>
        </span>
      </Link>
      <IconAction
        icon={LogOut}
        label="Sign out"
        onClick={handleSignOut}
        className="sidebar-sign-out text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      />
    </div>
  );
}

function ShellLoading() {
  return (
    <div className="shell-loading flex min-h-dvh">
      <div className="hidden w-64 bg-sidebar lg:block" />
      <div className="flex flex-1 flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    </div>
  );
}

function NoAccess() {
  const { signOut } = useAuth();
  return (
    <div className="no-access flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="page-title">This account can&apos;t use the admin panel</h1>
      <p className="page-description">Ask a super admin to give you a staff role, then sign in again.</p>
      <Button onClick={() => signOut()}>Sign out</Button>
    </div>
  );
}

/** Wraps every signed-in admin page: checks the sign-in, then draws the sidebar and top bar. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isLoading, hasToken, can, twoFactorSetupRequired } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!isLoading && !hasToken) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, hasToken, router, pathname]);

  useEffect(() => {
    if (twoFactorSetupRequired && !pathname.startsWith("/account/security")) {
      router.replace("/account/security?setup=1");
    }
  }, [twoFactorSetupRequired, pathname, router]);

  const mustSetUpTwoFactor = twoFactorSetupRequired && !pathname.startsWith("/account/security");
  if (isLoading || !user || mustSetUpTwoFactor) return <ShellLoading />;
  if (!can("admin.access")) return <NoAccess />;

  return (
    <div className="admin-shell flex min-h-dvh">
      <aside className="admin-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 overflow-y-auto bg-sidebar px-3 py-6 lg:flex">
        <SidebarBrand />
        <SidebarNav />
        <SidebarUser />
      </aside>
      <div className="admin-body flex min-w-0 flex-1 flex-col">
        <header className="admin-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="admin-menu-button lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="admin-mobile-sidebar w-72 border-none bg-sidebar px-3 py-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="admin-mobile-sidebar-inner flex h-full flex-col gap-8">
                <SidebarBrand />
                <SidebarNav onNavigate={closeMenu} />
                <SidebarUser onNavigate={closeMenu} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="admin-topbar-actions ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="admin-main mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
