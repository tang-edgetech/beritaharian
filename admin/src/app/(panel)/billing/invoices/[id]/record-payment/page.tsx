"use client";

import { useInvoice } from "@/components/billing/use-invoice";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, PAYMENT_METHODS, senToInput, toSen, todayInMalaysia } from "@/lib/billing";
import { notify } from "@/lib/notify";
import { ApiError, type Invoice, type Payment } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

function PaymentForm({ invoice, refund }: { invoice: Invoice; refund: boolean }) {
  const { can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const limit = refund ? -invoice.balance_sen : invoice.balance_sen;
  const [values, setValues] = useState({
    amount: senToInput(Math.max(0, limit)),
    method: "bank_transfer",
    reference: "",
    paid_on: todayInMalaysia(),
    notes: "",
    confirm: can("billing.approve"),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amount = toSen(values.amount);
    if (amount <= 0) next.amount = "Enter an amount more than zero.";
    else if (amount > limit) next.amount = `That is more than ${formatMoney(limit)}.`;
    if (!values.paid_on) next.paid_on = "Choose the date.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const result = await api.post<{ message: string; data: Payment }>(`admin/billing/invoices/${invoice.id}/payments`, {
        kind: refund ? "refund" : "payment",
        method: values.method,
        reference: values.reference || null,
        amount: values.amount,
        paid_on: values.paid_on,
        notes: values.notes || null,
        confirm: values.confirm,
      });
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      await queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      router.push(`/billing/invoices/${invoice.id}/payments`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
        if (error.code === "AMOUNT_TOO_HIGH") setErrors({ amount: error.message });
      }
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="payment-form flex flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card grid gap-5 sm:grid-cols-2">
        <div className="payment-form-summary rounded-lg bg-muted px-4 py-3 text-sm sm:col-span-2">
          {refund ? (
            <>
              The customer has paid <strong>{formatMoney(limit)}</strong> more than they owe on {invoice.number}, usually after a credit note.
              Record the money you send back here.
            </>
          ) : (
            <>
              {invoice.number} for {invoice.customer?.name}: <strong>{formatMoney(limit)}</strong> still owed of {formatMoney(invoice.total_sen)}.
            </>
          )}
        </div>
        <FormField id="payment-amount" label={refund ? "Amount refunded (RM)" : "Amount received (RM)"} error={errors.amount}>
          <Input id="payment-amount" inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={Boolean(errors.amount)} />
        </FormField>
        <FormField id="payment-date" label={refund ? "Date paid out" : "Date received"} error={errors.paid_on} hint="As shown on the bank statement.">
          <Input id="payment-date" type="date" max={todayInMalaysia()} value={values.paid_on} onChange={(e) => set("paid_on", e.target.value)} />
        </FormField>
        <FormField id="payment-method" label="Method">
          <Select value={values.method} onValueChange={(v) => set("method", v)}>
            <SelectTrigger id="payment-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="payment-reference" label="Bank or cheque reference (optional)" hint="Helps match it against the bank statement.">
          <Input id="payment-reference" value={values.reference} onChange={(e) => set("reference", e.target.value)} />
        </FormField>
        <FormField id="payment-notes" label="Notes (optional)" className="sm:col-span-2">
          <Textarea id="payment-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
        {can("billing.approve") ? (
          <div className="payment-form-confirm flex items-start gap-3 sm:col-span-2">
            <Checkbox id="payment-confirm" checked={values.confirm} onCheckedChange={(v) => set("confirm", Boolean(v))} />
            <Label htmlFor="payment-confirm" className="flex flex-col items-start gap-0.5 font-normal">
              <span className="font-medium">I have checked this against the bank statement</span>
              <span className="text-xs text-muted-foreground">
                It counts straight away and gets its {refund ? "voucher" : "receipt"} number. Leave unticked if someone else should check it first.
              </span>
            </Label>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">Someone with approval rights will check this before it counts and the receipt is issued.</p>
        )}
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {refund ? "Record refund" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}

export default function RecordPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const refund = useSearchParams().get("kind") === "refund";
  const query = useInvoice(id);
  const invoice = query.data;
  const allowed = invoice && (refund ? invoice.balance_sen < 0 : invoice.balance_sen > 0) && invoice.status !== "void" && invoice.status !== "draft";

  return (
    <>
      <PageHeader back={`/billing/invoices/${id}/payments`} backLabel="Invoice payments" title={refund ? "Record a refund" : "Record a payment"} />
      {query.isPending ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : invoice && allowed ? (
        <PaymentForm invoice={invoice} refund={refund} />
      ) : (
        <p className="panel-card">{refund ? "Nothing needs refunding on this invoice." : "Nothing is owed on this invoice, so there is no payment to record."}</p>
      )}
    </>
  );
}
