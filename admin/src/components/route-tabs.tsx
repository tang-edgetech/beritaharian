"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface RouteTab {
  href: string;
  label: string;
}

/** Tabs where every tab is its own page (its own address), not hidden content. */
export function RouteTabs({ tabs, label }: { tabs: RouteTab[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav className="route-tabs -mx-1 overflow-x-auto border-b" aria-label={label}>
      <ul className="route-tabs-list flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "route-tab-link -mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "is-active border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
