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
import { notify } from "@/lib/notify";
import type { BillingCustomer, MessageResponse } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Building2, Eye, FilePlus2, ScrollText } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const FILTERS: ListingFilter[] = [
  { key: "owing", label: "Balance", type: "select", options: [{ value: "yes", label: "Owes us money" }, { value: "no", label: "Nothing owed" }] },
  { key: "trashed", label: "Archived", type: "select", options: [{ value: "with", label: "Include archived" }, { value: "only", label: "Only archived" }] },
];

export default function CustomersPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const columns = useMemo<ListingColumn<BillingCustomer>[]>(
    () => [
      {
        id: "name",
        header: "Customer",
        sortKey: "name",
        hideable: false,
        cell: (c) => (
          <Link href={`/billing/customers/${c.id}/details`} className="customer-cell flex min-w-0 flex-col">
            <span className="customer-cell-name truncate font-medium hover:underline">{c.name}</span>
            <span className="customer-cell-sub truncate text-xs text-muted-foreground">{c.registration_no ?? c.email ?? "—"}</span>
          </Link>
        ),
      },
      { id: "contact", header: "Contact", cell: (c) => <span className="text-sm">{c.contact_person ?? c.phone ?? "—"}</span> },
      { id: "email", header: "Email", hiddenByDefault: true, cell: (c) => c.email ?? "—" },
      { id: "invoices", header: "Invoices", sortKey: "invoices", className: "text-right", cell: (c) => <span className="tabular-nums">{c.invoices_count ?? 0}</span> },
      {
        id: "balance",
        header: "Owes",
        sortKey: "balance",
        className: "text-right",
        cell: (c) =>
          c.deleted_at ? <StatusBadge tone="neutral">Archived</StatusBadge> : <MoneyText sen={c.balance_sen} muted={!c.balance_sen} />,
      },
    ],
    [],
  );

  async function archive(c: BillingCustomer) {
    const ok = await confirm({
      title: `Archive ${c.name}?`,
      description: "They disappear from the customer list and can't get new invoices. Their old invoices stay in the records.",
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/billing/customers/${c.id}`)).message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "customers"] });
    } catch (error) {
      notify.error(error);
    }
  }

  async function restore(c: BillingCustomer) {
    try {
      notify.success((await api.post<MessageResponse>(`admin/billing/customers/${c.id}/restore`)).message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "customers"] });
    } catch (error) {
      notify.error(error);
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Businesses and people we bill. Their details are printed on invoices, receipts and statements."
        actions={
          can("billing.manage") ? (
            <Button asChild>
              <Link href="/billing/customers/create">
                <Building2 />
                Add customer
              </Link>
            </Button>
          ) : null
        }
      />
      <DataListing<BillingCustomer>
        name="customers"
        endpoint="admin/billing/customers"
        columns={columns}
        filters={FILTERS}
        getRowId={(c) => c.id}
        searchPlaceholder="Search by name, SSM number, email or phone"
        defaultSort="name"
        empty={{
          title: "No customers yet",
          description: "Add the first business you will invoice.",
          action: can("billing.manage") ? (
            <Button asChild size="sm">
              <Link href="/billing/customers/create">Add customer</Link>
            </Button>
          ) : undefined,
        }}
        rowActions={(c) => (
          <>
            <IconAction icon={Eye} label="View details" href={`/billing/customers/${c.id}/details`} />
            {can("billing.manage") && !c.deleted_at ? (
              <IconAction icon={FilePlus2} label="New invoice for this customer" href={`/billing/invoices/create?customer=${c.id}`} />
            ) : null}
            {can("billing.reports") ? <IconAction icon={ScrollText} label="Statement of account" href={`/billing/customers/${c.id}/statement`} /> : null}
            {can("billing.manage") && c.deleted_at ? <IconAction icon={ArchiveRestore} label="Restore" onClick={() => restore(c)} /> : null}
            {can("billing.manage") && !c.deleted_at ? <IconAction icon={Archive} label="Archive" danger onClick={() => archive(c)} /> : null}
          </>
        )}
      />
    </>
  );
}
