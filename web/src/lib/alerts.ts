import type { AlertCard, AlertDetail, AlertPin, IncidentType, SimplePage } from "@cendol/api-client";
import { cacheLife, cacheTag } from "next/cache";
import { alertQuery, type AlertFilters } from "./alert-links";

/*
  Verified civic alerts for the public site, fetched on the server and cached for a minute.
  The API asks the site to drop "alerts" / "alert-{ref}" / "alert-types" as soon as an alert changes.
  "Near me" is fetched in the browser instead, so the reader's location never reaches a cached page.
*/

const API = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

type Result<T> = { ok: true; data: T } | { ok: false; status: number };

async function getJson<T>(path: string): Promise<Result<T>> {
  try {
    const response = await fetch(`${API}/${path}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

function lifetime(ok: boolean) {
  if (ok) cacheLife("minutes");
  else cacheLife("seconds");
}

export async function getAlertTypes(): Promise<IncidentType[]> {
  "use cache";
  cacheTag("alert-types");
  const result = await getJson<{ data: IncidentType[] }>("public/alert-types");
  lifetime(result.ok);
  return result.ok ? result.data.data : [];
}

export async function getAlerts(filters: AlertFilters, perPage = 20): Promise<SimplePage<AlertCard> | null> {
  "use cache";
  cacheTag("alerts");
  const result = await getJson<SimplePage<AlertCard>>(`public/alerts?${alertQuery(filters, { per_page: perPage })}`);
  lifetime(result.ok);
  return result.ok ? result.data : null;
}

export async function getAlertPins(filters: AlertFilters): Promise<AlertPin[]> {
  "use cache";
  cacheTag("alerts");
  const result = await getJson<{ data: AlertPin[] }>(`public/alerts/pins?${alertQuery({ ...filters, page: undefined })}`);
  lifetime(result.ok);
  return result.ok ? result.data.data : [];
}

export async function getAlert(ref: string): Promise<AlertDetail | "not-found" | null> {
  "use cache";
  cacheTag("alerts", `alert-${ref}`);
  const result = await getJson<{ data: AlertDetail }>(`public/alerts/${encodeURIComponent(ref)}`);
  lifetime(result.ok || (!result.ok && result.status === 404));
  if (result.ok) return result.data.data;
  return result.status === 404 ? "not-found" : null;
}

export interface ReportLimits {
  maxFiles: number;
  maxFileMb: number;
  purgeDays: number;
}

/** File limits for the report form, from the public settings (safe defaults if the API is away). */
export async function getReportLimits(): Promise<ReportLimits> {
  "use cache";
  cacheTag("settings");
  const result = await getJson<{ data: { reports?: { max_files?: number; max_file_mb?: number; purge_rejected_days?: number } } }>("settings/public");
  lifetime(result.ok);
  const r = result.ok ? (result.data.data.reports ?? {}) : {};
  return { maxFiles: r.max_files ?? 6, maxFileMb: r.max_file_mb ?? 25, purgeDays: r.purge_rejected_days ?? 180 };
}
