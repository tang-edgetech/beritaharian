"use client";

import { CustomerForm } from "@/components/billing/customer-form";
import { InvoiceListing } from "@/components/billing/invoice-listing";
import { MoneyText } from "@/components/billing/money-text";
import { ReportSkeleton, ReportToolbar, ReportView } from "@/components/billing/report-view";
import { useReportPeriod } from "@/components/billing/use-report-period";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BillingCustomer, FinanceReport } from "@cendol/api-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

const TABS = ["details", "invoices", "statement"] as const;

function StatementTab({ customer }: { customer: BillingCustomer }) {
  const { from, to, setPeriod } = useReportPeriod();
  const endpoint = `admin/billing/customers/${customer.id}/statement`;
  const query = useQuery({
    queryKey: ["statement", customer.id, from, to],
    queryFn: () => api.get<{ data: FinanceReport }>(endpoint, { from, to }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="customer-statement flex flex-col gap-5">
      <ReportToolbar endpoint={endpoint} from={from} to={to} onChange={setPeriod} />
      {query.isPending ? <ReportSkeleton /> : query.isError ? <p className="panel-card">{query.error.message}</p> : <ReportView report={query.data} />}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id, tab } = useParams<{ id: string; tab: string }>();
  const { can } = useAuth();

  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get<{ data: BillingCustomer }>(`admin/billing/customers/${id}`).then((r) => r.data),
  });

  if (!TABS.includes(tab as (typeof TABS)[number])) notFound();

  const customer = query.data;
  const tabs = [
    { href: `/billing/customers/${id}/details`, label: "Details" },
    { href: `/billing/customers/${id}/invoices`, label: "Invoices" },
    ...(can("billing.reports") ? [{ href: `/billing/customers/${id}/statement`, label: "Statement" }] : []),
  ];

  return (
    <>
      <PageHeader
        back="/billing/customers"
        backLabel="Customers"
        title={customer ? customer.name : <Skeleton className="h-8 w-64" />}
        description={
          customer ? (
            <span className="flex flex-wrap items-center gap-2">
              {customer.deleted_at ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
              <span>
                Owes <MoneyText sen={customer.balance_sen} className="font-semibold text-foreground" />
              </span>
              <span aria-hidden>·</span>
              <span>{customer.invoices_count ?? 0} invoices</span>
            </span>
          ) : null
        }
        actions={
          customer && can("billing.manage") && !customer.deleted_at ? (
            <Button asChild>
              <Link href={`/billing/invoices/create?customer=${customer.id}`}>
                <FilePlus2 />
                New invoice
              </Link>
            </Button>
          ) : null
        }
      />
      <RouteTabs tabs={tabs} label="Customer sections" />
      {query.isPending ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : customer ? (
        <>
          {tab === "details" ? <CustomerForm key={customer.id} customer={customer} /> : null}
          {tab === "invoices" ? <InvoiceListing name={`customer-invoices-${customer.id}`} extraQuery={{ "filter[customer]": customer.id }} hideCustomer /> : null}
          {tab === "statement" ? <StatementTab customer={customer} /> : null}
        </>
      ) : null}
    </>
  );
}
