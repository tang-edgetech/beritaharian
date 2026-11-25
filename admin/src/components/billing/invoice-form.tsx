"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { IconAction } from "@/components/icon-action";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatMoney, senToInput, toSen, todayInMalaysia } from "@/lib/billing";
import { notify } from "@/lib/notify";
import { useBillingConfig } from "@/lib/queries";
import { ApiError, type CustomerOption, type Invoice } from "@cendol/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CustomerPicker } from "./customer-picker";

const amount = z.string().trim().refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter an amount like 150 or 150.50.");

const lineSchema = z.object({
  description: z.string().trim().min(1, "Describe this line.").max(500),
  quantity: z.string().trim().refine((v) => Number(v) > 0, "More than 0."),
  unit: z.string().trim().max(20),
  unit_price: amount.refine((v) => v !== "", "Enter a price."),
  discount: amount,
  tax_rate: z.string().trim().refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 100), "0 to 100."),
});

const schema = z.object({
  customer: z.custom<CustomerOption | null>().refine((v) => Boolean(v), "Please choose who this invoice is for."),
  issue_date: z.string(),
  due_date: z.string(),
  reference: z.string().trim().max(120),
  notes: z.string().max(1000),
  terms: z.string().max(2000),
  lines: z.array(lineSchema).min(1, "Add at least one line."),
});

type Values = z.infer<typeof schema>;
type LineValues = Values["lines"][number];

/** Same arithmetic as the server, so the totals shown are the totals that get saved. */
export function lineTotals(line: Pick<LineValues, "quantity" | "unit_price" | "discount" | "tax_rate">, taxEnabled: boolean) {
  const gross = Math.round((Number(line.quantity) || 0) * toSen(line.unit_price));
  const discount = Math.min(toSen(line.discount), gross);
  const net = gross - discount;
  const tax = taxEnabled ? Math.round((net * (Number(line.tax_rate) || 0)) / 100) : 0;
  return { gross, discount, net, tax };
}

const blankLine = (taxRate: number): LineValues => ({ description: "", quantity: "1", unit: "", unit_price: "", discount: "", tax_rate: String(taxRate) });

interface InvoiceFormProps {
  invoice?: Invoice;
  initialCustomer?: CustomerOption | null;
  onSaved: (invoice: Invoice) => void;
}

export function InvoiceForm({ invoice, initialCustomer, onSaved }: InvoiceFormProps) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const config = useBillingConfig();
  const taxEnabled = config.data?.tax_enabled ?? false;
  const taxLabel = config.data?.tax_label ?? "SST";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer: invoice?.customer ? { id: invoice.customer.id, name: invoice.customer.name, email: null, registration_no: null } : (initialCustomer ?? null),
      issue_date: invoice?.issue_date ?? todayInMalaysia(),
      due_date: invoice?.due_date ?? "",
      reference: invoice?.reference ?? "",
      notes: invoice?.notes ?? "",
      terms: invoice?.terms ?? "",
      lines: invoice?.lines?.length
        ? invoice.lines.map((l) => ({
            description: l.description,
            quantity: String(l.quantity),
            unit: l.unit ?? "",
            unit_price: senToInput(l.unit_price_sen),
            discount: l.discount_sen ? senToInput(l.discount_sen) : "",
            tax_rate: String(l.tax_rate),
          }))
        : [blankLine(0)],
    },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const errors = formState.errors;
  const lines = useFieldArray({ control, name: "lines" });
  const watchedLines = useWatch({ control, name: "lines" });

  const totals = (watchedLines ?? []).reduce(
    (sum, line) => {
      const t = lineTotals(line, taxEnabled);
      return { gross: sum.gross + t.gross, discount: sum.discount + t.discount, tax: sum.tax + t.tax };
    },
    { gross: 0, discount: 0, tax: 0 },
  );
  const grandTotal = totals.gross - totals.discount + totals.tax;

  async function save(values: Values, issue: boolean) {
    if (issue) {
      const ok = await confirm({
        title: "Issue this invoice?",
        description: `It gets its official number and can't be edited afterwards. Total: ${formatMoney(grandTotal)}. Mistakes are fixed with a credit note or by voiding it.`,
        confirmLabel: "Issue invoice",
      });
      if (!ok) return;
    }
    const payload = {
      customer_id: values.customer!.id,
      issue_date: values.issue_date || null,
      due_date: values.due_date || null,
      reference: values.reference || null,
      notes: values.notes || null,
      terms: values.terms || null,
      issue,
      lines: values.lines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unit: line.unit || null,
        unit_price: line.unit_price,
        discount: line.discount || 0,
        tax_rate: taxEnabled ? Number(line.tax_rate) || 0 : 0,
      })),
    };
    try {
      const result = invoice
        ? await api.put<{ message: string; data: Invoice }>(`admin/billing/invoices/${invoice.id}`, payload)
        : await api.post<{ message: string; data: Invoice }>("admin/billing/invoices", payload);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice", result.data.id] });
      await queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      onSaved(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        for (const [field, messages] of Object.entries(error.errors)) {
          setError((field === "customer_id" ? "customer" : field) as keyof Values, { message: messages[0] });
        }
      }
      notify.error(error);
    }
  }

  const submitting = formState.isSubmitting;

  return (
    <form className="invoice-form flex flex-col gap-6" onSubmit={handleSubmit((v) => save(v, false))} noValidate>
      <section className="invoice-form-header panel-card grid gap-5 md:grid-cols-2">
        <FormField id="invoice-customer" label="Bill to" error={errors.customer?.message as string | undefined} className="md:col-span-2">
          <Controller
            control={control}
            name="customer"
            render={({ field }) => <CustomerPicker id="invoice-customer" value={field.value} onChange={field.onChange} invalid={Boolean(errors.customer)} />}
          />
        </FormField>
        <FormField id="invoice-issue-date" label="Invoice date" hint="Usually today. The number is given when you issue it.">
          <Input id="invoice-issue-date" type="date" {...register("issue_date")} />
        </FormField>
        <FormField
          id="invoice-due-date"
          label="Due date (optional)"
          error={errors.due_date?.message}
          hint={`Leave empty for ${config.data?.payment_terms_days ?? 14} days after the invoice date.`}
        >
          <Input id="invoice-due-date" type="date" {...register("due_date")} />
        </FormField>
        <FormField id="invoice-reference" label="Reference (optional)" hint="The customer's PO number or campaign name. Printed on the invoice." className="md:col-span-2">
          <Input id="invoice-reference" {...register("reference")} />
        </FormField>
      </section>

      <section className="invoice-form-lines panel-card flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="panel-card-title">What you are charging for</h2>
            <p className="panel-card-description">
              Drag the handle to change the order.{" "}
              {taxEnabled ? `${taxLabel} is worked out per line.` : "Tax is off. Turn it on in Settings › Billing once you are registered for SST."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => lines.append(blankLine(config.data?.default_tax_rate ?? 0))}>
            <Plus />
            Add line
          </Button>
        </div>
        {errors.lines?.root?.message || errors.lines?.message ? <p className="field-error">{errors.lines?.root?.message ?? errors.lines?.message}</p> : null}

        <SortableList
          items={lines.fields}
          getId={(field) => field.id}
          handleLabel={(field) => `Move line ${lines.fields.findIndex((f) => f.id === field.id) + 1}`}
          onReorder={(next) => {
            // the list reports the new order; turn it back into the single move that produced it
            const first = next.findIndex((f, index) => f.id !== lines.fields[index].id);
            if (first === -1) return;
            const cameFrom = lines.fields.findIndex((f) => f.id === next[first].id);
            const wentTo = next.findIndex((f) => f.id === lines.fields[first].id);
            if (cameFrom === first + 1) lines.move(first, wentTo); // a line moved down
            else lines.move(cameFrom, first); // a line moved up
          }}
          renderItem={(field) => {
            const index = lines.fields.findIndex((f) => f.id === field.id);
            const lineErrors = errors.lines?.[index];
            const t = lineTotals(watchedLines?.[index] ?? field, taxEnabled);
            return (
              <div className="invoice-line grid flex-1 gap-3 py-3 pr-2 sm:grid-cols-12">
                <div className="sm:col-span-12 lg:col-span-4">
                  <Label htmlFor={`line-${index}-description`} className="sr-only">
                    Description
                  </Label>
                  <Textarea
                    id={`line-${index}-description`}
                    rows={1}
                    placeholder="e.g. Pinned post on home page, 1 week"
                    aria-invalid={Boolean(lineErrors?.description)}
                    className="min-h-9"
                    {...register(`lines.${index}.description`)}
                  />
                  {lineErrors?.description ? <p className="field-error mt-1">{lineErrors.description.message}</p> : null}
                </div>
                <LineInput id={`line-${index}-quantity`} label="Qty" className="sm:col-span-2 lg:col-span-1" error={lineErrors?.quantity?.message}>
                  <Input id={`line-${index}-quantity`} inputMode="decimal" {...register(`lines.${index}.quantity`)} />
                </LineInput>
                <LineInput id={`line-${index}-unit`} label="Unit" className="sm:col-span-2 lg:col-span-1">
                  <Input id={`line-${index}-unit`} placeholder="week" {...register(`lines.${index}.unit`)} />
                </LineInput>
                <LineInput id={`line-${index}-price`} label="Price (RM)" className="sm:col-span-3 lg:col-span-2" error={lineErrors?.unit_price?.message}>
                  <Input id={`line-${index}-price`} inputMode="decimal" placeholder="0.00" {...register(`lines.${index}.unit_price`)} />
                </LineInput>
                <LineInput id={`line-${index}-discount`} label="Discount (RM)" className="sm:col-span-2 lg:col-span-1" error={lineErrors?.discount?.message}>
                  <Input id={`line-${index}-discount`} inputMode="decimal" placeholder="0.00" {...register(`lines.${index}.discount`)} />
                </LineInput>
                {taxEnabled ? (
                  <LineInput id={`line-${index}-tax`} label={`${taxLabel} %`} className="sm:col-span-1" error={lineErrors?.tax_rate?.message}>
                    <Input id={`line-${index}-tax`} inputMode="decimal" {...register(`lines.${index}.tax_rate`)} />
                  </LineInput>
                ) : null}
                <div className="invoice-line-total flex items-start justify-between gap-2 sm:col-span-2 lg:col-span-2">
                  <span className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Amount</span>
                    <span className="font-medium tabular-nums">{formatMoney(t.net + t.tax)}</span>
                  </span>
                  <IconAction icon={Trash2} label="Remove this line" danger disabled={lines.fields.length === 1} onClick={() => lines.remove(index)} />
                </div>
              </div>
            );
          }}
        />

        <dl className="invoice-form-totals ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatMoney(totals.gross)}</dd>
          {totals.discount ? (
            <>
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-right">-{formatMoney(totals.discount)}</dd>
            </>
          ) : null}
          {taxEnabled ? (
            <>
              <dt className="text-muted-foreground">{taxLabel}</dt>
              <dd className="text-right">{formatMoney(totals.tax)}</dd>
            </>
          ) : null}
          <dt className="border-t pt-1 font-heading text-base font-bold">Total</dt>
          <dd className="border-t pt-1 text-right font-heading text-base font-bold">{formatMoney(grandTotal)}</dd>
        </dl>
      </section>

      <section className="invoice-form-notes panel-card grid gap-5 md:grid-cols-2">
        <FormField id="invoice-notes" label="Note to the customer (optional)" hint="Leave empty to use the standard note from Settings › Billing.">
          <Textarea id="invoice-notes" rows={3} {...register("notes")} />
        </FormField>
        <FormField id="invoice-terms" label="Terms (optional)" hint="Leave empty to use the standard terms.">
          <Textarea id="invoice-terms" rows={3} {...register("terms")} />
        </FormField>
      </section>

      <div className="invoice-form-actions flex flex-wrap justify-end gap-2">
        <Button type="submit" variant="outline" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Save draft
        </Button>
        <Button type="button" disabled={submitting} onClick={handleSubmit((v) => save(v, true))}>
          <Send />
          Save and issue
        </Button>
      </div>
    </form>
  );
}

function LineInput({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`invoice-line-field flex flex-col gap-1 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="field-error text-xs">{error}</p> : null}
    </div>
  );
}
