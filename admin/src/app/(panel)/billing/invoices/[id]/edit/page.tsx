"use client";

import { InvoiceForm } from "@/components/billing/invoice-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Invoice } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<{ data: Invoice }>(`admin/billing/invoices/${id}`).then((r) => r.data),
  });
  const invoice = query.data;

  return (
    <>
      <PageHeader back={`/billing/invoices/${id}/details`} backLabel="Invoice" title="Edit draft invoice" />
      {query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : invoice && invoice.status !== "draft" ? (
        <div className="panel-card flex flex-col items-start gap-3">
          <p className="font-medium">Invoice {invoice.number} has been issued, so it can no longer be edited.</p>
          <p className="text-sm text-muted-foreground">To correct it, issue a credit note, or void it if no payment has been made yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/billing/invoices/${id}/details`}>Back to the invoice</Link>
          </Button>
        </div>
      ) : invoice ? (
        <InvoiceForm key={invoice.id} invoice={invoice} onSaved={(saved) => router.push(`/billing/invoices/${saved.id}/details`)} />
      ) : null}
    </>
  );
}
