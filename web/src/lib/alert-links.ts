import type { AlertState, IncidentSeverity, IncidentStatus } from "@cendol/api-client";

/* Filters, addresses and plain-word labels for civic alerts and reports. Safe on the server and in the browser. */

export type AlertStateFilter = "active" | "resolved";

export interface AlertFilters {
  type?: string;
  area?: string;
  state?: AlertStateFilter;
  q?: string;
  page?: number;
}

/** The API's query string for these filters. The reader's location is added separately and never goes in the page address. */
export function alertQuery(filters: AlertFilters, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  params.set("state", filters.state ?? "active");
  if (filters.type) params.set("type", filters.type);
  if (filters.area) params.set("area", filters.area);
  if (filters.q) params.set("q", filters.q);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export function alertFiltersFromSearch(search: Record<string, string | string[] | undefined>): AlertFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  return {
    type: one(search.type) || undefined,
    area: one(search.area) || undefined,
    state: one(search.state) === "resolved" ? "resolved" : "active",
    q: one(search.q) || undefined,
    page: Math.max(1, Number(one(search.page)) || 1),
  };
}

/** The page address for a set of filters (what goes in the browser's address bar). */
export function alertsAddress(filters: AlertFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.area) params.set("area", filters.area);
  if (filters.state === "resolved") params.set("state", "resolved");
  if (filters.q) params.set("q", filters.q);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const search = params.toString();
  return search ? `/alerts?${search}` : "/alerts";
}

export const alertHref = (ref: string) => `/alerts/${encodeURIComponent(ref)}`;
export const myReportHref = (ref: string) => `/account/reports/${encodeURIComponent(ref)}`;

export const SEVERITY: Record<IncidentSeverity, { label: string; tone: string }> = {
  low: { label: "Low", tone: "bg-santan-100 text-santan-700 dark:bg-santan-800 dark:text-santan-100" },
  medium: { label: "Medium", tone: "bg-marigold-100 text-marigold-800 dark:bg-marigold-900 dark:text-marigold-100" },
  high: { label: "High", tone: "bg-satay-500 text-white" },
  critical: { label: "Critical", tone: "bg-red-700 text-white" },
};

export const ALERT_STATE: Record<AlertState, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  resolved: { label: "Resolved", tone: "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100" },
};

/** Colour for the reader's own report status (the words themselves come from the API). */
export function reportStatusTone(status: IncidentStatus): string {
  switch (status) {
    case "needs_info":
      return "bg-marigold-100 text-marigold-900 dark:bg-marigold-900 dark:text-marigold-100";
    case "verified":
    case "closed":
      return "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100";
    case "rejected":
    case "unconfirmed":
    case "withdrawn":
      return "bg-santan-200 text-santan-700 dark:bg-santan-800 dark:text-santan-200";
    default:
      return "bg-gula-100 text-gula-800 dark:bg-gula-800 dark:text-gula-100";
  }
}

/** Where a report is on the simple progress line: 0 sent, 1 being checked, 2 decided. */
export function reportStep(status: IncidentStatus): number {
  if (status === "new" || status === "needs_info") return 0;
  if (status === "investigating") return 1;
  return 2;
}

/** Melaka with a margin: the same box the API checks. */
export const MELAKA_BOUNDS = { lat: [1.85, 2.6], lng: [101.9, 102.7] } as const;
export const insideMelaka = (lat: number, lng: number) =>
  lat >= MELAKA_BOUNDS.lat[0] && lat <= MELAKA_BOUNDS.lat[1] && lng >= MELAKA_BOUNDS.lng[0] && lng <= MELAKA_BOUNDS.lng[1];

/** "2.4 MB" */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
