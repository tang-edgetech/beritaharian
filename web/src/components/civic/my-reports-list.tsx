"use client";

import { errorMessage, FormMessage } from "@/components/account/auth-ui";
import { readerApi, requireReader } from "@/lib/auth";
import { myReportHref, reportStatusTone } from "@/lib/alert-links";
import { formatDate } from "@/lib/format";
import type { MyReportsPage } from "@cendol/api-client";
import { ArrowLeft, ChevronRight, MessageCircleWarning, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlashMessage } from "../site/flash-message";
import { IncidentIcon } from "./alert-bits";

export type MyReportsFilter = "" | "open" | "decided";

const FILTERS: { value: MyReportsFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "decided", label: "Decided" },
];

const filterHref = (state: MyReportsFilter) => (state ? `/account/reports?state=${state}` : "/account/reports");

/** The reader's own civic reports, with where each one stands. */
export function MyReportsList({ state }: { state: MyReportsFilter }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; data: MyReportsPage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${state}|${page}`;

  useEffect(() => {
    if (requireReader(router, filterHref(state))) return;
    const controller = new AbortController();
    readerApi
      .get<MyReportsPage>("me/reports", { state: state || undefined, page }, controller.signal)
      .then((data) => {
        setResult({ key, data });
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [router, state, page, key]);

  const data = result?.key === key ? result.data : null;

  return (
    <div className="my-reports-page site-container flex max-w-3xl flex-col gap-5 py-6">
      <Link href="/account" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Your account
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-heading">Your reports</h1>
          <p className="page-lead">What you&apos;ve told us about, and what our team did with it.</p>
        </div>
        <Link href="/report" className="my-reports-new inline-flex h-10 items-center gap-1.5 rounded-full bg-satay-500 px-4 text-sm font-bold text-white hover:bg-satay-700">
          <Plus className="size-4" aria-hidden />
          New report
        </Link>
      </header>
      <FlashMessage />

      <nav className="my-reports-filters flex gap-2" aria-label="Which reports">
        {FILTERS.map((f) => (
          <Link
            key={f.value || "all"}
            href={filterHref(f.value)}
            replace
            scroll={false}
            onClick={() => setPage(1)}
            aria-current={state === f.value ? "page" : undefined}
            className={`my-reports-filter inline-flex h-9 items-center rounded-full px-4 text-sm font-bold ${state === f.value ? "is-active bg-gula-900 text-coconut dark:bg-marigold-400 dark:text-gula-900" : "bg-santan-100 text-santan-700 hover:bg-santan-200 dark:bg-santan-800 dark:text-santan-200"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? <FormMessage>{error}</FormMessage> : null}

      {!data && !error ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
          ))}
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="my-reports-empty flex flex-col items-start gap-3 rounded-card bg-santan-100 p-6 text-santan-600 dark:bg-santan-900 dark:text-santan-300">
          <p>{state === "open" ? "You have no open reports." : state === "decided" ? "None of your reports has been decided yet." : "You haven't sent any reports yet."}</p>
          <Link href="/report" className="font-bold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
            Report something you&apos;ve seen
          </Link>
        </div>
      ) : (
        <ul className="my-report-list flex flex-col gap-3">
          {data?.data.map((report) => (
            <li key={report.ref}>
              <Link
                href={myReportHref(report.ref)}
                className={`my-report-row flex items-center gap-3 rounded-card border bg-white p-4 hover:shadow-md dark:bg-santan-900 ${report.needs_reply ? "has-reply-needed border-marigold-400 ring-2 ring-marigold-200 dark:ring-marigold-900" : "border-santan-200 dark:border-santan-800"}`}
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-santan-100 text-gula-900 dark:bg-santan-800 dark:text-coconut">
                  <IncidentIcon icon={report.type?.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-display text-lg leading-snug font-black text-gula-900 dark:text-coconut">{report.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-santan-500">
                    <span className={`my-report-status inline-flex rounded-full px-2 py-0.5 font-bold ${reportStatusTone(report.status)}`}>{report.status_label}</span>
                    {report.type?.name ? <span>{report.type.name}</span> : null}
                    <span>Sent {formatDate(report.created_at)}</span>
                    <span>{report.ref}</span>
                  </span>
                  {report.needs_reply ? (
                    <span className="my-report-reply-needed inline-flex items-center gap-1 text-sm font-bold text-marigold-800 dark:text-marigold-200">
                      <MessageCircleWarning className="size-4" aria-hidden />
                      We need your reply
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="size-5 shrink-0 text-santan-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.last_page > 1 ? (
        <nav className="my-reports-pager flex items-center justify-between" aria-label="More reports">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="pager-link h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold disabled:invisible dark:border-santan-700">
            Previous
          </button>
          <span className="text-sm text-santan-500">
            Page {page} of {data.meta.last_page}
          </span>
          <button type="button" disabled={page >= data.meta.last_page} onClick={() => setPage(page + 1)} className="pager-link h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold disabled:invisible dark:border-santan-700">
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
