"use client";

import { MoneyText } from "@/components/billing/money-text";
import { DataListing, type ListingColumn, type ListingFilter } from "@/components/data-listing/data-listing";
import { IconAction } from "@/components/icon-action";
import { PageHeader } from "@/components/page-header";
import { saveFile } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { CreditNote } from "@cendol/api-client";
import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const FILTERS: ListingFilter[] = [
  { key: "issued_from", label: "On or after", type: "date" },
  { key: "issued_to", label: "On or before", type: "date" },
];

export default function CreditNotesPage() {
  const columns = useMemo<ListingColumn<CreditNote>[]>(
    () => [
      { id: "issue_date", header: "Date", sortKey: "issue_date", hideable: false, cell: (n) => <span className="text-sm whitespace-nowrap">{formatDate(n.issue_date)}</span> },
      {
        id: "number",
        header: "Credit note no.",
        sortKey: "number",
        cell: (n) => (
          <Link href={`/billing/credit-notes/${n.id}`} className="font-medium tabular-nums hover:underline">
            {n.number}
          </Link>
        ),
      },
      {
        id: "invoice",
        header: "Invoice",
        cell: (n) =>
          n.invoice ? (
            <Link href={`/billing/invoices/${n.invoice.id}/credit-notes`} className="text-sm tabular-nums hover:underline">
              {n.invoice.number}
            </Link>
          ) : (
            "—"
          ),
      },
      { id: "customer", header: "Customer", cell: (n) => <span className="text-sm">{n.customer?.name ?? "—"}</span> },
      { id: "reason", header: "Reason", cell: (n) => <span className="text-sm">{n.reason}</span> },
      { id: "total", header: "Amount", sortKey: "total", className: "text-right", cell: (n) => <MoneyText sen={n.total_sen} /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Credit notes"
        description="Reductions to issued invoices. To make one, open the invoice and choose More › Issue a credit note."
      />
      <DataListing<CreditNote>
        name="credit-notes"
        endpoint="admin/billing/credit-notes"
        columns={columns}
        filters={FILTERS}
        getRowId={(n) => n.id}
        searchPlaceholder="Search by number, invoice, reason or customer"
        defaultSort="-issue_date"
        empty={{ title: "No credit notes", description: "Credit notes appear here when an issued invoice is reduced." }}
        rowActions={(n) => (
          <>
            <IconAction icon={Eye} label="Open" href={`/billing/credit-notes/${n.id}`} />
            <IconAction icon={Download} label="Download PDF" onClick={() => saveFile(`admin/billing/credit-notes/${n.id}/pdf`)} />
          </>
        )}
      />
    </>
  );
}
