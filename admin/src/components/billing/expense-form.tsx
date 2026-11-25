"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, PAYMENT_METHODS, saveFile, senToInput, toSen, todayInMalaysia } from "@/lib/billing";
import { notify } from "@/lib/notify";
import { useBillingConfig } from "@/lib/queries";
import { ApiError, type Expense } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip } from "lucide-react";
import { useState, type FormEvent } from "react";

/** Record money spent, with the supplier's bill attached (PDF or photo). Sent as a file upload. */
export function ExpenseForm({ expense, onSaved }: { expense?: Expense; onSaved?: (expense: Expense) => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const config = useBillingConfig();
  const readOnly = !can("billing.manage") || Boolean(expense?.deleted_at);
  const [values, setValues] = useState({
    spent_on: expense?.spent_on ?? todayInMalaysia(),
    category: expense?.category ?? "",
    payee: expense?.payee ?? "",
    description: expense?.description ?? "",
    reference: expense?.reference ?? "",
    method: expense?.method ?? "bank_transfer",
    amount: expense ? senToInput(expense.amount_sen) : "",
    tax: expense?.tax_sen ? senToInput(expense.tax_sen) : "",
    notes: expense?.notes ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const total = toSen(values.amount) + toSen(values.tax);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.category) next.category = "Choose a category.";
    if (!values.payee.trim()) next.payee = "Please say who was paid.";
    if (!values.description.trim()) next.description = "Describe what it was for.";
    if (toSen(values.amount) <= 0) next.amount = "Enter an amount more than zero.";
    if (file && file.size > 8 * 1024 * 1024) next.attachment = "The bill must be smaller than 8 MB.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const result = await api.upload<{ message: string; data: Expense }>(expense ? `admin/billing/expenses/${expense.id}` : "admin/billing/expenses", {
        ...values,
        tax: values.tax || "0",
        reference: values.reference || null,
        notes: values.notes || null,
        attachment: file,
        remove_attachment: removeAttachment,
      });
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "expenses"] });
      queryClient.setQueryData(["expense", result.data.id], result.data);
      setFile(null);
      onSaved?.(result.data);
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="expense-form flex flex-col gap-6" onSubmit={submit} noValidate>
      <fieldset className="panel-card grid gap-5 sm:grid-cols-2" disabled={readOnly}>
        <legend className="sr-only">Expense</legend>
        <FormField id="expense-date" label="Date paid" error={errors.spent_on}>
          <Input id="expense-date" type="date" max={todayInMalaysia()} value={values.spent_on} onChange={(e) => set("spent_on", e.target.value)} />
        </FormField>
        <FormField id="expense-category" label="Category" error={errors.category} hint="Change the list in Settings › Billing.">
          <Select value={values.category} onValueChange={(v) => set("category", v)} disabled={readOnly}>
            <SelectTrigger id="expense-category" className="w-full" aria-invalid={Boolean(errors.category)}>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {(config.data?.expense_categories ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="expense-payee" label="Paid to" error={errors.payee}>
          <Input id="expense-payee" placeholder="e.g. Exabytes" value={values.payee} onChange={(e) => set("payee", e.target.value)} />
        </FormField>
        <FormField id="expense-reference" label="Their bill or receipt number (optional)">
          <Input id="expense-reference" value={values.reference} onChange={(e) => set("reference", e.target.value)} />
        </FormField>
        <FormField id="expense-description" label="What it was for" error={errors.description} className="sm:col-span-2">
          <Input id="expense-description" placeholder="e.g. cPanel hosting, 12 months" value={values.description} onChange={(e) => set("description", e.target.value)} />
        </FormField>
        <FormField id="expense-amount" label="Amount before tax (RM)" error={errors.amount}>
          <Input id="expense-amount" inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={Boolean(errors.amount)} />
        </FormField>
        <FormField id="expense-tax" label="Tax charged by the supplier (RM, optional)">
          <Input id="expense-tax" inputMode="decimal" value={values.tax} onChange={(e) => set("tax", e.target.value)} />
        </FormField>
        <FormField id="expense-method" label="Paid by">
          <Select value={values.method} onValueChange={(v) => set("method", v)} disabled={readOnly}>
            <SelectTrigger id="expense-method" className="w-full">
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
        <p className="self-end text-sm sm:text-right">
          Total paid: <strong className="tabular-nums">{formatMoney(total)}</strong>
        </p>
        <FormField
          id="expense-attachment"
          label="Supplier's bill (PDF or photo)"
          error={errors.attachment}
          hint="Kept privately for your records and the accountant. Up to 8 MB."
          className="sm:col-span-2"
        >
          <Input id="expense-attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </FormField>
        {expense?.has_attachment ? (
          <div className="expense-attachment-current flex flex-wrap items-center gap-3 text-sm sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={() => saveFile(`admin/billing/expenses/${expense.id}/attachment`)}>
              <Paperclip />
              {expense.attachment_name}
            </Button>
            {!readOnly ? (
              <span className="flex items-center gap-2">
                <Checkbox id="expense-remove-attachment" checked={removeAttachment} onCheckedChange={(v) => setRemoveAttachment(Boolean(v))} />
                <Label htmlFor="expense-remove-attachment" className="font-normal">
                  Remove the attached bill
                </Label>
              </span>
            ) : null}
          </div>
        ) : null}
        <FormField id="expense-notes" label="Notes (optional)" className="sm:col-span-2">
          <Textarea id="expense-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </fieldset>
      {!readOnly ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {expense ? "Save changes" : "Record expense"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
