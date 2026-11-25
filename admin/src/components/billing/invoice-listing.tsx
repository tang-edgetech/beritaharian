"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { DataListing, type BulkAction, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { saveFile } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Invoice, MessageResponse, Query } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Eye, Pencil, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { InvoiceStatusBadge } from "./billing-badges";
import { MoneyText } from "./money-text";

const FILTERS: ListingFilter[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "open", label: "Waiting for money (any)" },
      { value: "draft", label: "Draft" },
      { value: "issued", label: "Awaiting payment" },
      { value: "partially_paid", label: "Partly paid" },
      { value: "paid", label: "Paid" },
      { value: "credited", label: "Credited" },
      { value: "void", label: "Void" },
    ],
  },
  { key: "overdue", label: "Overdue", type: "select", options: [{ value: "yes", label: "Only overdue" }] },
  { key: "issued_from", label: "Issued on or after", type: "date" },
  { key: "issued_to", label: "Issued on or before", type: "date" },
];

const bulk = (action: string) => (ids: string[]) => api.post<MessageResponse>("admin/billing/invoices/bulk", { action, ids });

/** The invoice list, used on the Invoices page and on each customer's Invoices tab. */
export function InvoiceListing({ name = "invoices", extraQuery, hideCustomer }: { name?: string; extraQuery?: Query; hideCustomer?: boolean }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();

  const columns = useMemo<ListingColumn<Invoice>[]>(
    () => [
      {
        id: "number",
        header: "Invoice",
        sortKey: "number",
        hideable: false,
        cell: (i) => (
          <Link href={`/billing/invoices/${i.id}/details`} className="invoice-cell flex min-w-0 flex-col">
            <span className={`invoice-cell-number font-medium tabular-nums hover:underline ${i.number ? "" : "text-muted-foreground italic"}`}>
              {i.number ?? "Draft"}
            </span>
            {i.reference ? <span className="invoice-cell-reference truncate text-xs text-muted-foreground">{i.reference}</span> : null}
          </Link>
        ),
      },
      ...(hideCustomer
        ? []
        : [
            {
              id: "customer",
              header: "Customer",
              cell: (i: Invoice) =>
                i.customer ? (
                  <Link href={`/billing/customers/${i.customer.id}/details`} className="text-sm hover:underline">
                    {i.customer.name}
                  </Link>
                ) : (
                  "—"
                ),
            },
          ]),
      { id: "status", header: "Status", cell: (i) => <InvoiceStatusBadge status={i.status} overdue={i.is_overdue} /> },
      { id: "issue_date", header: "Date", sortKey: "issue_date", cell: (i) => <span className="text-sm whitespace-nowrap">{formatDate(i.issue_date)}</span> },
      { id: "due_date", header: "Due", sortKey: "due_date", cell: (i) => <span className="text-sm whitespace-nowrap">{formatDate(i.due_date)}</span> },
      { id: "total", header: "Total", sortKey: "total", className: "text-right", cell: (i) => <MoneyText sen={i.total_sen} /> },
      {
        id: "balance",
        header: "Owed",
        sortKey: "balance",
        className: "text-right",
        cell: (i) => <MoneyText sen={i.balance_sen} muted={i.balance_sen === 0} />,
      },
      { id: "created_at", header: "Created", sortKey: "created_at", hiddenByDefault: true, cell: (i) => formatDate(i.created_at) },
    ],
    [hideCustomer],
  );

  const bulkActions: BulkAction[] = can("billing.manage")
    ? [
        {
          key: "issue_drafts",
          label: "Issue drafts",
          icon: Send,
          confirm: (n) => ({
            title: `Issue ${n} ${n === 1 ? "invoice" : "invoices"}?`,
            description: "Only drafts are issued. Each gets its official number and can no longer be edited.",
            confirmLabel: "Issue",
          }),
          run: bulk("issue_drafts"),
        },
        {
          key: "delete_drafts",
          label: "Delete drafts",
          icon: Trash2,
          danger: true,
          confirm: (n) => ({
            title: `Delete ${n} ${n === 1 ? "draft" : "drafts"}?`,
            description: "Only drafts are deleted. Issued invoices are always kept.",
            confirmLabel: "Delete drafts",
            danger: true,
          }),
          run: bulk("delete_drafts"),
        },
      ]
    : [];

  async function duplicate(invoice: Invoice) {
    try {
      const result = await api.post<{ message: string; data: Invoice }>(`admin/billing/invoices/${invoice.id}/duplicate`);
      notify.success(result.message);
      router.push(`/billing/invoices/${result.data.id}/edit`);
    } catch (error) {
      notify.error(error);
    }
  }

  async function removeDraft(invoice: Invoice) {
    const ok = await confirm({ title: "Delete this draft?", description: "Drafts have no number yet, so nothing is lost from the records.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/billing/invoices/${invoice.id}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["listing", name] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <DataListing<Invoice>
      name={name}
      endpoint="admin/billing/invoices"
      columns={columns}
      filters={FILTERS}
      extraQuery={extraQuery}
      getRowId={(i) => i.id}
      searchPlaceholder="Search by invoice number, reference or customer"
      defaultSort="-created_at"
      bulkActions={bulkActions}
      empty={{
        title: "No invoices yet",
        description: "Create an invoice when a business books a promotion.",
        action: can("billing.manage") ? (
          <Button asChild size="sm">
            <Link href="/billing/invoices/create">New invoice</Link>
          </Button>
        ) : undefined,
      }}
      rowActions={(i) => (
        <>
          <IconAction icon={Eye} label="Open" href={`/billing/invoices/${i.id}/details`} />
          {i.status === "draft" && can("billing.manage") ? <IconAction icon={Pencil} label="Edit draft" href={`/billing/invoices/${i.id}/edit`} /> : null}
          <IconAction icon={Download} label="Download PDF" onClick={() => saveFile(`admin/billing/invoices/${i.id}/pdf`)} />
          {can("billing.manage") ? <IconAction icon={Copy} label="Make a copy as a new draft" onClick={() => duplicate(i)} /> : null}
          {i.status === "draft" && can("billing.manage") ? <IconAction icon={Trash2} label="Delete draft" danger onClick={() => removeDraft(i)} /> : null}
        </>
      )}
    />
  );
}
