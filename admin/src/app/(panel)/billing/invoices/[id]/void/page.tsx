"use client";

import { useInvoice } from "@/components/billing/use-invoice";
import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/billing";
import { notify } from "@/lib/notify";
import type { Invoice } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function VoidForm({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Please say why this invoice is being voided.");
      return;
    }
    const ok = await confirm({
      title: `Void ${invoice.number}?`,
      description: "The customer no longer owes this amount. The invoice and its number stay in the records, marked VOID. This can't be undone.",
      confirmLabel: "Void invoice",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.post<{ message: string }>(`admin/billing/invoices/${invoice.id}/void`, { reason });
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      router.push(`/billing/invoices/${invoice.id}/details`);
    } catch (err) {
      notify.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="void-form flex flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card flex flex-col gap-4">
        <p className="text-sm">
          Void an invoice that should never have been issued, for example the wrong customer or a duplicate. {invoice.number} for{" "}
          {invoice.customer?.name}, {formatMoney(invoice.total_sen)}.
        </p>
        <FormField id="void-reason" label="Reason" error={error ?? undefined} hint="Printed on the voided invoice and kept in the audit log.">
          <Textarea id="void-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(error)} />
        </FormField>
      </section>
      <div className="flex justify-end">
        <Button type="submit" variant="destructive" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Ban />}
          Void invoice
        </Button>
      </div>
    </form>
  );
}

export default function VoidInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const query = useInvoice(id);
  const invoice = query.data;
  const allowed = invoice && invoice.status !== "draft" && invoice.status !== "void" && invoice.paid_sen === 0 && invoice.credited_sen === 0;

  return (
    <>
      <PageHeader back={`/billing/invoices/${id}/details`} backLabel="Invoice" title="Void invoice" />
      {query.isPending ? (
        <Skeleton className="h-60 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : invoice && allowed ? (
        <VoidForm invoice={invoice} />
      ) : (
        <p className="panel-card">This invoice can&apos;t be voided. Drafts can simply be deleted; invoices with payments or credit notes need a credit note instead.</p>
      )}
    </>
  );
}
