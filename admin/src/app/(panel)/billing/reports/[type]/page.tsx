"use client";

import { ReportSkeleton, ReportToolbar, ReportView } from "@/components/billing/report-view";
import { useReportPeriod } from "@/components/billing/use-report-period";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { FinanceReport } from "@cendol/api-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";

const REPORTS = [
  { key: "sales", label: "Sales", about: "Every invoice issued in the period, with what was credited, paid and is still owed." },
  { key: "collections", label: "Money received", about: "Receipts and refunds in the period, and totals by payment method. Use it to match the bank statement." },
  { key: "outstanding", label: "Outstanding", about: "Who owes what today, grouped by how late it is." },
  { key: "income-expenses", label: "Income & expenses", about: "Money in after refunds against money spent, month by month." },
  { key: "expenses", label: "Expenses", about: "Everything spent in the period, by category." },
  { key: "tax", label: "Tax", about: "Tax charged on invoices less credit notes. Only needed once you are registered for SST." },
] as const;

export default function ReportPage() {
  const { type } = useParams<{ type: string }>();
  const current = REPORTS.find((r) => r.key === type);
  const { from, to, setPeriod } = useReportPeriod();
  const endpoint = `admin/billing/reports/${type}`;

  const query = useQuery({
    queryKey: ["report", type, from, to],
    queryFn: () => api.get<{ data: FinanceReport }>(endpoint, { from, to }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: Boolean(current),
  });

  if (!current) notFound();

  return (
    <>
      <PageHeader title="Finance reports" description={current.about} />
      <RouteTabs label="Reports" tabs={REPORTS.map((r) => ({ href: `/billing/reports/${r.key}`, label: r.label }))} />
      <ReportToolbar endpoint={endpoint} from={from} to={to} onChange={setPeriod} showDates={type !== "outstanding"} />
      {query.isPending ? (
        <ReportSkeleton />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className={`report-body transition-opacity ${query.isFetching ? "is-refreshing opacity-60" : ""}`}>
          <ReportView report={query.data} />
        </div>
      )}
    </>
  );
}
