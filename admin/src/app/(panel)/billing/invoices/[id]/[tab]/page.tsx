"use client";

import { InvoiceStatusBadge } from "@/components/billing/billing-badges";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { MoneyText } from "@/components/billing/money-text";
import { CreditNoteTable, PaymentTable } from "@/components/billing/payment-table";
import { useConfirm } from "@/components/confirm-dialog";
import { AuditListing } from "@/components/logs/audit-listing";
import { PageHeader } from "@/components/page-header";
import { RouteTabs } from "@/components/route-tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, openForPrint, saveFile } from "@/lib/billing";
import { formatDate, formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Invoice } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Banknote, ChevronDown, Copy, Download, FileMinus, Pencil, Printer, Send, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";

const TABS = ["details", "payments", "credit-notes", "activity"] as const;

function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const base = `/billing/invoices/${invoice.id}`;
  const open = invoice.status === "issued" || invoice.status === "partially_paid";
  const counted = invoice.status !== "draft" && invoice.status !== "void";
  const hasMoney = invoice.paid_sen > 0 || invoice.credited_sen > 0;

  async function issue() {
    const ok = await confirm({
      title: "Issue this invoice?",
      description: `It gets its official number and can't be edited afterwards. Total: ${formatMoney(invoice.total_sen)}.`,
      confirmLabel: "Issue invoice",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.post<{ message: string; data: Invoice }>(`admin/billing/invoices/${invoice.id}/issue`);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    try {
      const result = await api.post<{ message: string; data: Invoice }>(`admin/billing/invoices/${invoice.id}/duplicate`);
      notify.success(result.message);
      router.push(`/billing/invoices/${result.data.id}/edit`);
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <div className="invoice-actions flex flex-wrap items-center gap-2">
      {invoice.status === "draft" && can("billing.manage") ? (
        <>
          <Button asChild variant="outline">
            <Link href={`${base}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <Button onClick={issue} disabled={busy}>
            <Send />
            Issue
          </Button>
        </>
      ) : null}
      {open && invoice.balance_sen > 0 && can("billing.manage") ? (
        <Button asChild>
          <Link href={`${base}/record-payment`}>
            <Banknote />
            Record payment
          </Link>
        </Button>
      ) : null}
      {counted && invoice.balance_sen < 0 && can("billing.manage") ? (
        <Button asChild>
          <Link href={`${base}/record-payment?kind=refund`}>
            <Undo2 />
            Record refund
          </Link>
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => openForPrint(`admin/billing/invoices/${invoice.id}/pdf`)}>
        <Printer />
        Print
      </Button>
      <Button variant="outline" onClick={() => saveFile(`admin/billing/invoices/${invoice.id}/pdf`)}>
        <Download />
        PDF
      </Button>
      {can("billing.manage") || can("billing.approve") ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="invoice-more-actions">
              More
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {can("billing.manage") ? (
              <DropdownMenuItem onSelect={duplicate}>
                <Copy /> Copy as a new draft
              </DropdownMenuItem>
            ) : null}
            {counted && can("billing.approve") && invoice.total_sen > invoice.credited_sen ? (
              <DropdownMenuItem asChild>
                <Link href={`${base}/credit-note`}>
                  <FileMinus /> Issue a credit note
                </Link>
              </DropdownMenuItem>
            ) : null}
            {counted && can("billing.approve") ? (
              <>
                <DropdownMenuSeparator />
                {hasMoney ? (
                  <DropdownMenuItem disabled>
                    <Ban /> Can&apos;t void: it has payments or credits
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild variant="destructive">
                    <Link href={`${base}/void`}>
                      <Ban /> Void this invoice
                    </Link>
                  </DropdownMenuItem>
                )}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function InvoiceFacts({ invoice }: { invoice: Invoice }) {
  return (
    <aside className="invoice-facts panel-card flex flex-col gap-3 text-sm">
      <h2 className="panel-card-title">Record</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
        </dd>
        <dt className="text-muted-foreground">Owed now</dt>
        <dd>
          <MoneyText sen={invoice.balance_sen} className="font-semibold" />
        </dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>
          {formatDateTime(invoice.created_at)}
          {invoice.created_by ? ` by ${invoice.created_by}` : ""}
        </dd>
        {invoice.issued_at ? (
          <>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>
              {formatDateTime(invoice.issued_at)}
              {invoice.issued_by ? ` by ${invoice.issued_by}` : ""}
            </dd>
          </>
        ) : null}
        {invoice.voided_at ? (
          <>
            <dt className="text-muted-foreground">Voided</dt>
            <dd>
              {formatDate(invoice.voided_at)} · {invoice.void_reason}
            </dd>
          </>
        ) : null}
      </dl>
      {invoice.customer ? (
        <Button asChild variant="link" className="h-auto justify-start px-0">
          <Link href={`/billing/customers/${invoice.customer.id}/details`}>Open {invoice.customer.name}</Link>
        </Button>
      ) : null}
    </aside>
  );
}

export default function InvoiceDetailPage() {
  const { id, tab } = useParams<{ id: string; tab: string }>();
  const { can } = useAuth();

  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<{ data: Invoice }>(`admin/billing/invoices/${id}`).then((r) => r.data),
  });

  if (!TABS.includes(tab as (typeof TABS)[number])) notFound();

  const invoice = query.data;
  const tabs = [
    { href: `/billing/invoices/${id}/details`, label: "Invoice" },
    { href: `/billing/invoices/${id}/payments`, label: `Payments${invoice?.payments?.length ? ` (${invoice.payments.length})` : ""}` },
    { href: `/billing/invoices/${id}/credit-notes`, label: `Credit notes${invoice?.credit_notes?.length ? ` (${invoice.credit_notes.length})` : ""}` },
    ...(can("audit.view") ? [{ href: `/billing/invoices/${id}/activity`, label: "Activity" }] : []),
  ];

  return (
    <>
      <PageHeader
        back="/billing/invoices"
        backLabel="Invoices"
        title={invoice ? (invoice.number ?? "Draft invoice") : <Skeleton className="h-8 w-56" />}
        description={
          invoice ? (
            <span className="flex flex-wrap items-center gap-2">
              <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
              <span>{invoice.customer?.name}</span>
              <span aria-hidden>·</span>
              <span>Total {formatMoney(invoice.total_sen)}</span>
              {invoice.due_date && invoice.status !== "draft" ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Due {formatDate(invoice.due_date)}</span>
                </>
              ) : null}
            </span>
          ) : null
        }
        actions={invoice ? <InvoiceActions invoice={invoice} /> : null}
      />
      <RouteTabs tabs={tabs} label="Invoice sections" />
      {query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <div className="panel-card text-center">
          <p className="font-medium">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : invoice ? (
        <>
          {tab === "details" ? (
            <div className="invoice-detail grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <InvoiceDocument invoice={invoice} />
              <InvoiceFacts invoice={invoice} />
            </div>
          ) : null}
          {tab === "payments" ? <PaymentTable payments={invoice.payments ?? []} /> : null}
          {tab === "credit-notes" ? <CreditNoteTable notes={invoice.credit_notes ?? []} /> : null}
          {tab === "activity" ? <AuditListing name={`invoice-activity-${invoice.id}`} extraQuery={{ "filter[subject_invoice]": invoice.id }} showAreaFilter={false} /> : null}
        </>
      ) : null}
    </>
  );
}
