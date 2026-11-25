"use client";

import { InvoiceListing } from "@/components/billing/invoice-listing";
import { StatTile } from "@/components/billing/money-text";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/billing";
import { useBillingConfig } from "@/lib/queries";
import type { BillingSummary } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, TriangleAlert } from "lucide-react";
import Link from "next/link";

function SummaryTiles() {
  const summary = useQuery({
    queryKey: ["billing-summary"],
    queryFn: () => api.get<{ data: BillingSummary }>("admin/billing/summary").then((r) => r.data),
  });
  const s = summary.data;

  if (!s) {
    return (
      <div className="billing-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="billing-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/billing/invoices?status=open" className="billing-summary-link rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
        <StatTile label="Waiting for payment">{formatMoney(s.outstanding_sen)}</StatTile>
      </Link>
      <Link href="/billing/invoices?overdue=yes" className="billing-summary-link rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
        <StatTile label={`Overdue (${s.overdue_count})`} tone={s.overdue_sen > 0 ? "danger" : undefined}>
          {formatMoney(s.overdue_sen)}
        </StatTile>
      </Link>
      <Link href="/billing/payments" className="billing-summary-link rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
        <StatTile label="Received this month" tone="good">
          {formatMoney(s.received_this_month_sen)}
        </StatTile>
      </Link>
      <Link href="/billing/payments?status=pending" className="billing-summary-link rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
        <StatTile label="Payments to check" tone={s.pending_payments ? "warning" : undefined}>
          {s.pending_payments}
        </StatTile>
      </Link>
    </div>
  );
}

export default function InvoicesPage() {
  const { can } = useAuth();
  const config = useBillingConfig();

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Drafts can be changed. Once issued, an invoice keeps its number and is corrected only with a credit note or by voiding it."
        actions={
          can("billing.manage") ? (
            <Button asChild>
              <Link href="/billing/invoices/create">
                <FilePlus2 />
                New invoice
              </Link>
            </Button>
          ) : null
        }
      />
      {config.data && !config.data.company_ready ? (
        <div className="company-setup-notice flex flex-wrap items-center gap-3 rounded-xl border border-marigold-300 bg-marigold-50 px-4 py-3 text-sm dark:border-marigold-800 dark:bg-marigold-900/30">
          <TriangleAlert className="size-4 text-marigold-700" />
          <span className="flex-1">Your business address and bank account aren&apos;t set yet, so invoices won&apos;t show how to pay.</span>
          {can("settings.manage") ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/company">Add company details</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <SummaryTiles />
      <InvoiceListing />
    </>
  );
}
