"use client";

import { MoneyText } from "@/components/billing/money-text";
import { useConfirm } from "@/components/confirm-dialog";
import { DataListing, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PAYMENT_METHODS, saveFile } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useBillingConfig } from "@/lib/queries";
import type { Expense, MessageResponse } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Eye, Paperclip, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export default function ExpensesPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const config = useBillingConfig();

  const filters = useMemo<ListingFilter[]>(
    () => [
      { key: "category", label: "Category", type: "select", options: (config.data?.expense_categories ?? []).map((c) => ({ value: c, label: c })) },
      { key: "method", label: "Paid by", type: "select", options: PAYMENT_METHODS },
      { key: "spent_from", label: "On or after", type: "date" },
      { key: "spent_to", label: "On or before", type: "date" },
      { key: "trashed", label: "Bin", type: "select", options: [{ value: "with", label: "Include the bin" }, { value: "only", label: "Only the bin" }] },
    ],
    [config.data],
  );

  const columns = useMemo<ListingColumn<Expense>[]>(
    () => [
      { id: "spent_on", header: "Date", sortKey: "spent_on", hideable: false, cell: (e) => <span className="text-sm whitespace-nowrap">{formatDate(e.spent_on)}</span> },
      {
        id: "payee",
        header: "Paid to",
        sortKey: "payee",
        cell: (e) => (
          <Link href={`/billing/expenses/${e.id}`} className="expense-cell flex min-w-0 flex-col">
            <span className="truncate font-medium hover:underline">{e.payee}</span>
            <span className="truncate text-xs text-muted-foreground">{e.description}</span>
          </Link>
        ),
      },
      { id: "number", header: "Expense no.", sortKey: "number", cell: (e) => <span className="text-sm tabular-nums">{e.number}</span> },
      { id: "category", header: "Category", sortKey: "category", cell: (e) => <span className="text-sm">{e.category}</span> },
      { id: "method", header: "Paid by", hiddenByDefault: true, cell: (e) => e.method_label },
      {
        id: "bill",
        header: "Bill",
        cell: (e) =>
          e.deleted_at ? (
            <StatusBadge tone="neutral">In the bin</StatusBadge>
          ) : e.has_attachment ? (
            <IconAction icon={Paperclip} label="Download the bill" onClick={() => saveFile(`admin/billing/expenses/${e.id}/attachment`)} />
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          ),
      },
      { id: "total", header: "Total", sortKey: "total", className: "text-right", cell: (e) => <MoneyText sen={e.total_sen} /> },
    ],
    [],
  );

  async function remove(e: Expense) {
    const ok = await confirm({
      title: `Move ${e.number} to the bin?`,
      description: "It stops counting in reports. You can restore it from the Bin filter.",
      confirmLabel: "Move to bin",
      danger: true,
    });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/billing/expenses/${e.id}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "expenses"] });
    } catch (error) {
      notify.error(error);
    }
  }

  async function restore(e: Expense) {
    try {
      notify.success((await api.post<MessageResponse>(`admin/billing/expenses/${e.id}/restore`)).message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "expenses"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Money the business spends, with each supplier's bill attached. Used in the Income and expenses report."
        actions={
          can("billing.manage") ? (
            <Button asChild>
              <Link href="/billing/expenses/create">
                <ReceiptText />
                Record expense
              </Link>
            </Button>
          ) : null
        }
      />
      <DataListing<Expense>
        name="expenses"
        endpoint="admin/billing/expenses"
        columns={columns}
        filters={filters}
        getRowId={(e) => e.id}
        searchPlaceholder="Search by supplier, description or number"
        defaultSort="-spent_on"
        empty={{ title: "No expenses recorded", description: "Record hosting, printing, transport and other costs here." }}
        rowActions={(e) => (
          <>
            <IconAction icon={Eye} label="Open" href={`/billing/expenses/${e.id}`} />
            {can("billing.manage") && e.deleted_at ? <IconAction icon={ArchiveRestore} label="Restore" onClick={() => restore(e)} /> : null}
            {can("billing.manage") && !e.deleted_at ? <IconAction icon={Trash2} label="Move to bin" danger onClick={() => remove(e)} /> : null}
          </>
        )}
      />
    </>
  );
}
