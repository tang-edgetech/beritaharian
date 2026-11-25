"use client";

import { MoneyText } from "@/components/billing/money-text";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { openForPrint, saveFile } from "@/lib/billing";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CreditNote } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["credit-note", id],
    queryFn: () => api.get<{ data: CreditNote }>(`admin/billing/credit-notes/${id}`).then((r) => r.data),
  });
  const note = query.data;

  return (
    <>
      <PageHeader
        back="/billing/credit-notes"
        backLabel="Credit notes"
        title={note ? note.number : <Skeleton className="h-8 w-56" />}
        description={note ? `${note.customer?.name ?? ""} · ${formatDate(note.issue_date)}` : null}
        actions={
          note ? (
            <>
              <Button variant="outline" onClick={() => openForPrint(`admin/billing/credit-notes/${note.id}/pdf`)}>
                <Printer />
                Print
              </Button>
              <Button variant="outline" onClick={() => saveFile(`admin/billing/credit-notes/${note.id}/pdf`)}>
                <Download />
                PDF
              </Button>
            </>
          ) : null
        }
      />
      {query.isPending ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : note ? (
        <section className="credit-note-detail panel-card flex max-w-2xl flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Invoice</dt>
            <dd>
              {note.invoice ? (
                <Link href={`/billing/invoices/${note.invoice.id}/details`} className="font-medium hover:underline">
                  {note.invoice.number}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Reason</dt>
            <dd>{note.reason}</dd>
            <dt className="text-muted-foreground">Credited</dt>
            <dd>{note.description}</dd>
            <dt className="text-muted-foreground">Before tax</dt>
            <dd>
              <MoneyText sen={note.subtotal_sen} />
            </dd>
            {note.tax_sen ? (
              <>
                <dt className="text-muted-foreground">Tax ({note.tax_rate}%)</dt>
                <dd>
                  <MoneyText sen={note.tax_sen} />
                </dd>
              </>
            ) : null}
            <dt className="font-semibold">Total credit</dt>
            <dd>
              <MoneyText sen={note.total_sen} className="font-heading text-lg font-bold" />
            </dd>
            <dt className="text-muted-foreground">Issued by</dt>
            <dd>
              {note.issued_by ?? "—"}, {formatDateTime(note.created_at)}
            </dd>
          </dl>
        </section>
      ) : null}
    </>
  );
}
