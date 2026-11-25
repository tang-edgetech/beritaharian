"use client";

import { PaymentStatusBadge } from "@/components/billing/billing-badges";
import { MoneyText } from "@/components/billing/money-text";
import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PAYMENT_METHODS, saveFile } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { MessageResponse, Payment } from "@cendol/api-client";
import { CircleCheck, Download, Eye } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const FILTERS: ListingFilter[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "pending", label: "Waiting for check" },
      { value: "confirmed", label: "Confirmed" },
      { value: "rejected", label: "Rejected" },
    ],
  },
  { key: "kind", label: "Type", type: "select", options: [{ value: "payment", label: "Money in" }, { value: "refund", label: "Refunds" }] },
  { key: "method", label: "Method", type: "select", options: PAYMENT_METHODS },
  { key: "paid_from", label: "On or after", type: "date" },
  { key: "paid_to", label: "On or before", type: "date" },
];

export default function PaymentsPage() {
  const { can } = useAuth();

  const columns = useMemo<ListingColumn<Payment>[]>(
    () => [
      { id: "paid_on", header: "Date", sortKey: "paid_on", hideable: false, cell: (p) => <span className="text-sm whitespace-nowrap">{formatDate(p.paid_on)}</span> },
      {
        id: "receipt_number",
        header: "Receipt no.",
        sortKey: "receipt_number",
        cell: (p) => (
          <Link href={`/billing/payments/${p.id}`} className="font-medium tabular-nums hover:underline">
            {p.receipt_number ?? "Not yet"}
          </Link>
        ),
      },
      {
        id: "invoice",
        header: "Invoice",
        cell: (p) =>
          p.invoice ? (
            <Link href={`/billing/invoices/${p.invoice.id}/payments`} className="text-sm tabular-nums hover:underline">
              {p.invoice.number}
            </Link>
          ) : (
            "—"
          ),
      },
      { id: "customer", header: "Customer", cell: (p) => <span className="text-sm">{p.customer?.name ?? "—"}</span> },
      { id: "method", header: "Method", cell: (p) => <span className="text-sm">{p.method_label}</span> },
      { id: "reference", header: "Reference", hiddenByDefault: true, cell: (p) => p.reference ?? "—" },
      { id: "status", header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} kind={p.kind} /> },
      {
        id: "amount",
        header: "Amount",
        sortKey: "amount",
        className: "text-right",
        cell: (p) => <MoneyText sen={p.kind === "refund" ? -p.amount_sen : p.amount_sen} />,
      },
    ],
    [],
  );

  const bulkActions: BulkAction[] = can("billing.approve")
    ? [
        {
          key: "confirm",
          label: "Confirm",
          icon: CircleCheck,
          confirm: (n) => ({
            title: `Confirm ${n} ${n === 1 ? "payment" : "payments"}?`,
            description: "Only do this after matching them against the bank statement. Each gets its receipt number and counts towards its invoice.",
            confirmLabel: "Confirm",
          }),
          run: (ids) => api.post<MessageResponse>("admin/billing/payments/bulk", { action: "confirm", ids }),
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received and refunds paid. Payments waiting for a check don't count until someone with approval rights confirms them."
      />
      <DataListing<Payment>
        name="payments"
        endpoint="admin/billing/payments"
        columns={columns}
        filters={FILTERS}
        getRowId={(p) => p.id}
        searchPlaceholder="Search by receipt, invoice, reference or customer"
        defaultSort="-paid_on"
        bulkActions={bulkActions}
        canSelectRow={(p) => p.status === "pending"}
        empty={{ title: "No payments yet", description: "Record a payment from the invoice it pays." }}
        rowActions={(p) => (
          <>
            <IconAction icon={Eye} label="Open" href={`/billing/payments/${p.id}`} />
            {p.status === "confirmed" ? (
              <IconAction
                icon={Download}
                label={p.kind === "refund" ? "Download refund voucher" : "Download receipt"}
                onClick={() => saveFile(`admin/billing/payments/${p.id}/receipt`)}
              />
            ) : null}
          </>
        )}
      />
    </>
  );
}
