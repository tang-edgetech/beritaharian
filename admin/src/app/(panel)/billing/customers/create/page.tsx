"use client";

import { CustomerForm } from "@/components/billing/customer-form";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "next/navigation";

export default function CreateCustomerPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader back="/billing/customers" backLabel="Customers" title="Add customer" description="You can invoice them straight after saving." />
      <CustomerForm onSaved={(customer) => router.push(`/billing/customers/${customer.id}/details`)} />
    </>
  );
}
