"use client";

import { useInvoice } from "@/components/billing/use-invoice";
import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatMoney, toSen, todayInMalaysia } from "@/lib/billing";
import { notify } from "@/lib/notify";
import { useBillingConfig } from "@/lib/queries";
import { ApiError, type CreditNote, type Invoice } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function CreditNoteForm({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const config = useBillingConfig();
  const taxEnabled = config.data?.tax_enabled ?? false;
  const room = invoice.total_sen - invoice.credited_sen;
  const [values, setValues] = useState({ issue_date: todayInMalaysia(), reason: "", description: "", amount: "", tax_rate: String(config.data?.default_tax_rate ?? 0) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const subtotal = toSen(values.amount);
  const tax = taxEnabled ? Math.round((subtotal * (Number(values.tax_rate) || 0)) / 100) : 0;
  const total = subtotal + tax;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.reason.trim()) next.reason = "Please give the reason.";
    if (!values.description.trim()) next.description = "Please describe what is being credited.";
    if (subtotal <= 0) next.amount = "Enter an amount more than zero.";
    else if (total > room) next.amount = `Up to ${formatMoney(room)} can still be credited on this invoice.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    const ok = await confirm({
      title: `Issue a credit note for ${formatMoney(total)}?`,
      description: `It gets its own number and reduces ${invoice.number}. Credit notes can't be edited or deleted.`,
      confirmLabel: "Issue credit note",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const result = await api.post<{ message: string; data: CreditNote }>(`admin/billing/invoices/${invoice.id}/credit-notes`, {
        ...values,
        tax_rate: taxEnabled ? Number(values.tax_rate) || 0 : 0,
      });
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      router.push(`/billing/invoices/${invoice.id}/credit-notes`);
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="credit-note-form flex flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card grid gap-5 sm:grid-cols-2">
        <p className="rounded-lg bg-muted px-4 py-3 text-sm sm:col-span-2">
          Use a credit note to reduce {invoice.number} (total {formatMoney(invoice.total_sen)}), for example when a campaign ends early or a price was wrong.
          If the customer has already paid, record a refund afterwards.
        </p>
        <FormField id="credit-reason" label="Reason" error={errors.reason} hint="Printed on the credit note." className="sm:col-span-2">
          <Input id="credit-reason" placeholder="e.g. Campaign ended a week early" value={values.reason} onChange={(e) => set("reason", e.target.value)} />
        </FormField>
        <FormField id="credit-description" label="What is being credited" error={errors.description} className="sm:col-span-2">
          <Input id="credit-description" placeholder="e.g. 1 week of pinned post not used" value={values.description} onChange={(e) => set("description", e.target.value)} />
        </FormField>
        <FormField id="credit-amount" label="Amount before tax (RM)" error={errors.amount} hint={`Up to ${formatMoney(room)} can be credited.`}>
          <Input id="credit-amount" inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={Boolean(errors.amount)} />
        </FormField>
        {taxEnabled ? (
          <FormField id="credit-tax" label={`${config.data?.tax_label ?? "SST"} rate (%)`}>
            <Input id="credit-tax" inputMode="decimal" value={values.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} />
          </FormField>
        ) : null}
        <FormField id="credit-date" label="Date">
          <Input id="credit-date" type="date" max={todayInMalaysia()} value={values.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
        </FormField>
        <p className="self-end text-sm sm:text-right">
          Total credit: <strong className="tabular-nums">{formatMoney(total)}</strong>
        </p>
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Issue credit note
        </Button>
      </div>
    </form>
  );
}

export default function CreateCreditNotePage() {
  const { id } = useParams<{ id: string }>();
  const query = useInvoice(id);
  const invoice = query.data;
  const allowed = invoice && invoice.status !== "draft" && invoice.status !== "void" && invoice.total_sen > invoice.credited_sen;

  return (
    <>
      <PageHeader back={`/billing/invoices/${id}/credit-notes`} backLabel="Invoice credit notes" title="Issue a credit note" />
      {query.isPending ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : invoice && allowed ? (
        <CreditNoteForm invoice={invoice} />
      ) : (
        <p className="panel-card">This invoice can&apos;t take a credit note: it is a draft, void, or already fully credited.</p>
      )}
    </>
  );
}
