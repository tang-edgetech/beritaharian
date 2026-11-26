"use client";

import {
  ApiError,
  type AdminIncidentDetail,
  type AdminIncidentType,
  type IncidentQueue,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentSummary,
  type PersonRef,
} from "@cendol/api-client";
import type { StatusTone } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { api, tokenStore } from "./api";
import { useAuth } from "./auth";


/** Colours for the status badge. The words come from the API's status_label. */
export const INCIDENT_STATUS_TONE: Record<IncidentStatus, StatusTone> = {
  new: "warning",
  needs_info: "neutral",
  investigating: "warning",
  verified: "good",
  unconfirmed: "neutral",
  rejected: "danger",
  closed: "neutral",
  withdrawn: "neutral",
};

/** For the status filter; the API's own labels are used on badges. */
export const INCIDENT_STATUS_OPTIONS: { value: IncidentStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "needs_info", label: "Waiting for reporter" },
  { value: "investigating", label: "Checking" },
  { value: "verified", label: "Verified" },
  { value: "unconfirmed", label: "Could not confirm" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
  { value: "withdrawn", label: "Withdrawn by the reporter" },
];

export const OPEN_STATUSES: IncidentStatus[] = ["new", "needs_info", "investigating"];

export const SEVERITY: Record<IncidentSeverity, { label: string; hint: string }> = {
  low: { label: "Low", hint: "A nuisance. No danger to people." },
  medium: { label: "Medium", hint: "Gets in the way of daily life, e.g. a blocked lane." },
  high: { label: "High", hint: "A risk to people or property. Avoid the area." },
  critical: { label: "Critical", hint: "Danger to life. Emergency services involved." },
};

export const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];

export const QUEUES: { key: IncidentQueue; label: string; description: string; count?: (s: IncidentSummary) => number }[] = [
  { key: "check", label: "To check", description: "New reports nobody has looked at yet. Oldest first.", count: (s) => s.to_check },
  { key: "waiting", label: "Waiting for reporter", description: "We asked the reporter a question. Replies bring a report back with a “Reporter replied” badge.", count: (s) => s.waiting },
  { key: "checking", label: "Checking", description: "Reports someone is checking now.", count: (s) => s.checking },
  { key: "mine", label: "Mine", description: "Open reports assigned to you.", count: (s) => s.mine },
  { key: "alerts", label: "Alerts", description: "Reports published as public alerts, live or resolved.", count: (s) => s.live_alerts },
  {
    key: "decided",
    label: "Decided",
    description: "Verified, unconfirmed, rejected, closed and withdrawn reports.",
    count: (s) => s.statuses.verified + s.statuses.unconfirmed + s.statuses.rejected + s.statuses.closed + s.statuses.withdrawn,
  },
  { key: "all", label: "All", description: "Every report, whatever its status.", count: (s) => Object.values(s.statuses).reduce((a, b) => a + b, 0) },
];

/** Lucide icon names offered for incident types; any lucide name works. */
export const INCIDENT_ICON_SUGGESTIONS = [
  "waves",
  "car-front",
  "flame",
  "construction",
  "lamp",
  "droplets",
  "trash-2",
  "shield-alert",
  "paw-print",
  "circle-help",
  "tree-pine",
  "zap",
  "wind",
  "traffic-cone",
  "volume-2",
  "building",
  "bus",
  "siren",
];

/** The public site's page for an alert. */
export function publicAlertUrl(ref: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/alerts/${ref}`;
}

export function incidentUrl(ref: string, tab = "overview"): string {
  return `/incidents/${ref}/${tab}`;
}

export function useIncidentSummary() {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["incident-summary"],
    queryFn: () => api.get<{ data: IncidentSummary }>("admin/incidents/summary").then((r) => r.data),
    enabled: ["incidents.view", "incidents.verify", "incidents.export"].some((p) => can(p)),
    refetchInterval: 60_000,
  });
}

export function useIncident(ref: string | null | undefined) {
  return useQuery({
    queryKey: ["incident", ref],
    queryFn: () => api.get<{ data: AdminIncidentDetail }>(`admin/incidents/${ref}`).then((r) => r.data),
    enabled: Boolean(ref),
  });
}

export function useIncidentTypes(enabled = true) {
  return useQuery({
    queryKey: ["incident-types"],
    queryFn: () => api.get<{ data: AdminIncidentType[] }>("admin/incident-types").then((r) => r.data),
    staleTime: 60_000,
    enabled,
  });
}

export function useVerifiers(enabled = true) {
  return useQuery({
    queryKey: ["incident-verifiers"],
    queryFn: () => api.get<{ data: PersonRef[] }>("admin/incidents/verifiers").then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled,
  });
}

interface AreaGroup {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
}

/** Districts and towns, for the area filter. */
export function useAreas() {
  return useQuery({
    queryKey: ["public-areas"],
    queryFn: () => api.get<{ data: AreaGroup[] }>("public/areas").then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

/** "2.4 MB" */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Straight-line distance in metres between two points. */
export function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function metresText(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Sends several files in one request as files[] (the shared client's upload() takes one value per field).
 * Errors come back as the same ApiError the rest of the admin uses.
 */
export async function uploadFiles<T>(path: string, files: File[]): Promise<T> {
  const form = new FormData();
  files.forEach((file) => form.append("files[]", file));
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
  } catch {
    throw new ApiError(0, { message: "We can't reach the server. Please check your connection and try again.", code: "NETWORK_ERROR" });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data && typeof data.message === "string" ? data : { message: "Something went wrong on our side. Please try again in a moment.", code: "SERVER_ERROR" },
    );
  }
  return data as T;
}

/** Saves a downloaded file (blob) with its name. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Thrown when the person cancels a popup, so listings stay quiet (notify ignores AbortError). */
export function cancelled(): Error {
  const error = new Error("Cancelled");
  error.name = "AbortError";
  return error;
}

/**
 * Is this person the signed-in user? Report people carry number ids, which the summary's `me` matches
 * (only used for hints and shortcuts; the server checks the real rules).
 */
export function useIsMe(): (person: PersonRef | null | undefined) => boolean {
  const summary = useIncidentSummary();
  const me = summary.data?.me;
  return (person) => Boolean(person && me !== undefined && person.id === me);
}
