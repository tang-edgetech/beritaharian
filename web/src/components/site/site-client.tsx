"use client";

import { useReader } from "@/lib/auth";
import { formatMalayDay } from "@/lib/format";
import { Map as MapIcon, Newspaper, Plus, Store, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** "Rabu, 25 November" in the masthead. Drawn in the browser so the cached page never shows yesterday's date. */
export function TodayDate() {
  const text = useSyncExternalStore(noop, () => formatMalayDay(new Date()), () => "");
  return (
    <span className="site-today hidden text-sm font-medium text-santan-500 lg:inline" suppressHydrationWarning>
      {text}
    </span>
  );
}

export function AccountLink() {
  const reader = useReader();
  return reader ? (
    <Link
      href="/account"
      className="account-link inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-marigold-100 pr-3 pl-1 text-sm font-semibold text-gula-900 hover:bg-marigold-200 dark:bg-gula-800 dark:text-coconut"
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-marigold-400 text-xs font-black" aria-hidden>
        {reader.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="hidden sm:inline">{reader.name.split(" ")[0]}</span>
    </Link>
  ) : (
    <Link href="/login" className="sign-in-link inline-flex h-10 shrink-0 items-center rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
      Sign in
    </Link>
  );
}

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Today", icon: Newspaper, match: (p) => p === "/" || p.startsWith("/news") || p.startsWith("/areas") || p.startsWith("/topics") || p.startsWith("/search") },
  { href: "/places", label: "Places", icon: Store, match: (p) => p.startsWith("/places") },
  { href: "/report", label: "Report", icon: Plus, match: (p) => p.startsWith("/report") },
  { href: "/map", label: "Map", icon: MapIcon, match: (p) => p.startsWith("/map") },
  { href: "/account", label: "Me", icon: UserRound, match: (p) => ["/account", "/login", "/register", "/verify"].some((x) => p.startsWith(x)) },
];

/** Phone navigation: the same five tabs the mobile app will have. */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="bottom-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-santan-200 bg-santan-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-santan-800 dark:bg-santan-950/95" aria-label="App sections">
      <ul className="grid h-16 grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const report = tab.href === "/report";
          return (
            <li key={tab.href} className="flex">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "bottom-tab flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold",
                  active ? "is-active text-pandan-700 dark:text-pandan-300" : "text-santan-500",
                ].join(" ")}
              >
                {report ? (
                  <span className="bottom-tab-report -mt-6 inline-flex size-12 items-center justify-center rounded-full border-4 border-santan-50 bg-satay-500 text-white shadow-lg dark:border-santan-950">
                    <tab.icon className="size-6" aria-hidden />
                  </span>
                ) : (
                  <tab.icon className="size-5" aria-hidden />
                )}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
