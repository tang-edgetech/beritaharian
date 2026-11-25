"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MALAYSIAN_STATES } from "@/lib/billing";
import { notify } from "@/lib/notify";
import { ApiError, type BillingCustomer } from "@cendol/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const optional = z.string().trim().max(190).optional();

const schema = z.object({
  name: z.string().trim().min(1, "Please enter the customer's name.").max(190),
  registration_no: optional,
  tax_id: optional,
  sst_no: optional,
  contact_person: optional,
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right.")]).optional(),
  phone: optional,
  address: z.object({
    line1: optional,
    line2: optional,
    postcode: z.string().trim().max(10).optional(),
    city: optional,
    state: optional,
    country: optional,
  }),
  notes: z.string().max(2000).optional(),
});

type Values = z.infer<typeof schema>;

const blankToNull = (value: string | undefined) => (value && value.trim() ? value.trim() : null);

/** Add or edit a customer: the details printed in the "Bill to" box of their documents. */
export function CustomerForm({ customer, onSaved }: { customer?: BillingCustomer; onSaved?: (customer: BillingCustomer) => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const readOnly = !can("billing.manage") || Boolean(customer?.deleted_at);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? "",
      registration_no: customer?.registration_no ?? "",
      tax_id: customer?.tax_id ?? "",
      sst_no: customer?.sst_no ?? "",
      contact_person: customer?.contact_person ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: {
        line1: customer?.address.line1 ?? "",
        line2: customer?.address.line2 ?? "",
        postcode: customer?.address.postcode ?? "",
        city: customer?.address.city ?? "Melaka",
        state: customer?.address.state ?? "Melaka",
        country: customer?.address.country ?? "Malaysia",
      },
      notes: customer?.notes ?? "",
    },
  });
  const { register, handleSubmit, control, setError, formState } = form;
  const errors = formState.errors;

  async function save(values: Values) {
    const payload = {
      name: values.name,
      registration_no: blankToNull(values.registration_no),
      tax_id: blankToNull(values.tax_id),
      sst_no: blankToNull(values.sst_no),
      contact_person: blankToNull(values.contact_person),
      email: blankToNull(values.email),
      phone: blankToNull(values.phone),
      address: Object.fromEntries(Object.entries(values.address).map(([k, v]) => [k, blankToNull(v)])),
      notes: blankToNull(values.notes),
    };
    try {
      const result = customer
        ? await api.put<{ message: string; data: BillingCustomer }>(`admin/billing/customers/${customer.id}`, payload)
        : await api.post<{ message: string; data: BillingCustomer }>("admin/billing/customers", payload);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["listing", "customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customer", result.data.id] });
      form.reset(values);
      onSaved?.(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        for (const [field, messages] of Object.entries(error.errors)) {
          setError(field as keyof Values, { message: messages[0] });
        }
      }
      notify.error(error);
    }
  }

  return (
    <form className="customer-form flex flex-col gap-6" onSubmit={handleSubmit(save)} noValidate>
      <fieldset className="customer-form-identity panel-card flex flex-col gap-5" disabled={readOnly}>
        <legend className="sr-only">Who they are</legend>
        <div>
          <h2 className="panel-card-title">Who they are</h2>
          <p className="panel-card-description">Printed in the &ldquo;Bill to&rdquo; box. Use the registered name for a company.</p>
        </div>
        <div className="customer-form-grid grid gap-5 sm:grid-cols-2">
          <FormField id="customer-name" label="Name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="customer-name" autoComplete="organization" aria-invalid={Boolean(errors.name)} {...register("name")} />
          </FormField>
          <FormField id="customer-registration" label="SSM or IC number (optional)" hint="Company or business registration number, or IC for a person.">
            <Input id="customer-registration" {...register("registration_no")} />
          </FormField>
          <FormField id="customer-tax-id" label="Tax number (TIN, optional)" hint="Needed later for LHDN e-invoices.">
            <Input id="customer-tax-id" {...register("tax_id")} />
          </FormField>
          <FormField id="customer-sst" label="SST number (optional)">
            <Input id="customer-sst" {...register("sst_no")} />
          </FormField>
          <FormField id="customer-contact" label="Contact person (optional)">
            <Input id="customer-contact" {...register("contact_person")} />
          </FormField>
          <FormField id="customer-email" label="Email (optional)" error={errors.email?.message} hint="Where invoices and receipts are sent.">
            <Input id="customer-email" type="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
          </FormField>
          <FormField id="customer-phone" label="Phone (optional)">
            <Input id="customer-phone" type="tel" {...register("phone")} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="customer-form-address panel-card flex flex-col gap-5" disabled={readOnly}>
        <legend className="sr-only">Address</legend>
        <h2 className="panel-card-title">Billing address</h2>
        <div className="customer-form-grid grid gap-5 sm:grid-cols-2">
          <FormField id="customer-line1" label="Address line 1" className="sm:col-span-2">
            <Input id="customer-line1" autoComplete="address-line1" {...register("address.line1")} />
          </FormField>
          <FormField id="customer-line2" label="Address line 2 (optional)" className="sm:col-span-2">
            <Input id="customer-line2" autoComplete="address-line2" {...register("address.line2")} />
          </FormField>
          <FormField id="customer-postcode" label="Postcode">
            <Input id="customer-postcode" inputMode="numeric" autoComplete="postal-code" {...register("address.postcode")} />
          </FormField>
          <FormField id="customer-city" label="Town or city">
            <Input id="customer-city" autoComplete="address-level2" {...register("address.city")} />
          </FormField>
          <FormField id="customer-state" label="State">
            <Controller
              control={control}
              name="address.state"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger id="customer-state" className="w-full">
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {MALAYSIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="customer-country" label="Country">
            <Input id="customer-country" autoComplete="country-name" {...register("address.country")} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="customer-form-notes panel-card flex flex-col gap-3" disabled={readOnly}>
        <legend className="sr-only">Notes</legend>
        <FormField id="customer-notes" label="Internal notes (optional)" hint="Only staff see this. It is never printed.">
          <Textarea id="customer-notes" rows={3} {...register("notes")} />
        </FormField>
      </fieldset>

      {!readOnly ? (
        <div className="customer-form-actions flex justify-end gap-2">
          <Button type="submit" disabled={formState.isSubmitting || (customer && !formState.isDirty)}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
            {customer ? "Save changes" : "Add customer"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
