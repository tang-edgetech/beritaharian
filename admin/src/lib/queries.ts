"use client";

import type { PermissionGroup, Role } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<{ data: Role[] }>("admin/roles").then((r) => r.data),
    enabled,
    staleTime: 60_000,
  });
}

export function usePermissionGroups() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => api.get<{ data: PermissionGroup[] }>("admin/permissions").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export interface BillingConfig {
  tax_enabled: boolean;
  tax_label: string;
  default_tax_rate: number;
  payment_terms_days: number;
  expense_categories: string[];
  company_ready: boolean;
}

/** Tax on or off, payment terms and expense categories, from Settings › Billing. */
export function useBillingConfig() {
  return useQuery({
    queryKey: ["billing-config"],
    queryFn: () => api.get<{ data: BillingConfig }>("admin/billing/config").then((r) => r.data),
    staleTime: 60_000,
  });
}
