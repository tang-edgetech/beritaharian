"use client";

import { InvoiceForm } from "@/components/billing/invoice-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { BillingCustomer } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

export default function CreateInvoicePage() {
  const router = useRouter();
  const customerId = useSearchParams().get("customer");

  // "New invoice" from a customer's page arrives with ?customer=… already chosen
  const customer = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => api.get<{ data: BillingCustomer }>(`admin/billing/customers/${customerId}`).then((r) => r.data),
    enabled: Boolean(customerId),
  });

  return (
    <>
      <PageHeader
        back="/billing/invoices"
        backLabel="Invoices"
        title="New invoice"
        description="Save it as a draft while you check it. Issuing gives it the next invoice number and locks it."
      />
      {customerId && customer.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <InvoiceForm
          initialCustomer={
            customer.data ? { id: customer.data.id, name: customer.data.name, email: customer.data.email, registration_no: customer.data.registration_no } : null
          }
          onSaved={(invoice) => router.push(`/billing/invoices/${invoice.id}/details`)}
        />
      )}
    </>
  );
}
