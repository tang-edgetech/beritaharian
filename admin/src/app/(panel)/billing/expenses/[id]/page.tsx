"use client";

import { ExpenseForm } from "@/components/billing/expense-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Expense } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["expense", id],
    queryFn: () => api.get<{ data: Expense }>(`admin/billing/expenses/${id}`).then((r) => r.data),
  });
  const expense = query.data;

  return (
    <>
      <PageHeader
        back="/billing/expenses"
        backLabel="Expenses"
        title={expense ? expense.number : <Skeleton className="h-8 w-48" />}
        description={
          expense ? (
            <span className="flex flex-wrap items-center gap-2">
              {expense.deleted_at ? <StatusBadge tone="neutral">In the bin</StatusBadge> : null}
              <span>
                Recorded {formatDateTime(expense.created_at)}
                {expense.recorded_by ? ` by ${expense.recorded_by}` : ""}
              </span>
            </span>
          ) : null
        }
      />
      {query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : expense ? (
        <ExpenseForm key={`${expense.id}-${expense.has_attachment}`} expense={expense} />
      ) : null}
    </>
  );
}
