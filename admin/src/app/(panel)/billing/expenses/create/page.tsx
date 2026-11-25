"use client";

import { ExpenseForm } from "@/components/billing/expense-form";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "next/navigation";

export default function CreateExpensePage() {
  const router = useRouter();
  return (
    <>
      <PageHeader back="/billing/expenses" backLabel="Expenses" title="Record expense" description="Attach the supplier's bill so the accountant has it." />
      <ExpenseForm onSaved={(expense) => router.push(`/billing/expenses/${expense.id}`)} />
    </>
  );
}
