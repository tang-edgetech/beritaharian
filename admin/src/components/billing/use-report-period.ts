"use client";

import { firstOfMonth, todayInMalaysia } from "@/lib/billing";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

/** The report period lives in the address bar (?from=2026-01-01&to=2026-03-31), so a report can be bookmarked or shared. */
export function useReportPeriod() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const fromParam = search.get("from");
  const toParam = search.get("to");
  const from = isDate(fromParam) ? fromParam : firstOfMonth();
  const to = isDate(toParam) ? toParam : todayInMalaysia();

  const setPeriod = useCallback(
    (range: { from: string; to: string }) => {
      const next = new URLSearchParams(search.toString());
      next.set("from", range.from);
      next.set("to", range.to);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [search, router, pathname],
  );

  return { from, to, setPeriod };
}
