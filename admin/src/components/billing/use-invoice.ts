"use client";

import { api } from "@/lib/api";
import type { Invoice } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";

/** One invoice with its lines, payments and credit notes. Shared cache key with the invoice page. */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<{ data: Invoice }>(`admin/billing/invoices/${id}`).then((r) => r.data),
  });
}
