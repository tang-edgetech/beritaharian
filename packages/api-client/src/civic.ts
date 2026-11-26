/* Civic reports: incidents readers send, the verifier queue, public alerts and police evidence packs. */

import type { CategoryColor, MediaItem } from "./types";

export type IncidentStatus = "new" | "needs_info" | "investigating" | "verified" | "unconfirmed" | "rejected" | "closed" | "withdrawn";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type EvidenceKind = "image" | "video" | "audio" | "document";
export type AlertState = "active" | "resolved";
export type IncidentQueue = "check" | "waiting" | "checking" | "mine" | "alerts" | "decided" | "all";
export type IncidentAction = "assign" | "unassign" | "request_info" | "investigate" | "verify" | "unconfirm" | "reject" | "close" | "reopen";
export type IncidentUpdateKind = "submitted" | "status" | "note" | "message" | "reply" | "evidence" | "assigned" | "alert" | "handover";

export interface IncidentTypeRef {
  slug: string;
  name: string;
  /** lucide icon name, e.g. "waves" */
  icon: string;
  color: CategoryColor;
}

export interface IncidentType extends IncidentTypeRef {
  description: string | null;
}

export interface AdminIncidentType extends IncidentType {
  default_severity: IncidentSeverity;
  is_active: boolean;
  position: number;
  incidents_count: number | null;
}

export interface AreaRef {
  slug: string;
  name: string;
}

// ---- public alerts ------------------------------------------------------

/** GET /public/alerts. Only staff-written text; never the reporter's own words. */
export interface AlertCard {
  ref: string;
  title: string;
  summary: string;
  type: IncidentTypeRef | null;
  severity: IncidentSeverity;
  state: AlertState;
  area: AreaRef | null;
  /** staff-written place name, e.g. "Jalan Hang Jebat" */
  place: string | null;
  latitude: number;
  longitude: number;
  distance_m: number | null;
  cover: MediaItem | null;
  occurred_at: string;
  published_at: string;
  resolved_at: string | null;
  updated_at: string;
}

export interface AlertPin {
  ref: string;
  title: string;
  type: string | null;
  color: CategoryColor | null;
  icon: string | null;
  severity: IncidentSeverity;
  state: AlertState;
  latitude: number;
  longitude: number;
}

export interface AlertDetail extends AlertCard {
  photos: MediaItem[];
  /** the reporter's name, or "A Cendol Satay reader" when they hid it */
  reported_by: string;
}

// ---- the reporter ---------------------------------------------------------

export interface MyReport {
  ref: string;
  title: string;
  type: IncidentTypeRef | null;
  area: AreaRef | null;
  status: IncidentStatus;
  /** plain words for the reporter: "Received", "We need more information", "Being checked"... */
  status_label: string;
  needs_reply: boolean;
  is_alert: boolean;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface MyReportFile {
  id: string;
  name: string;
  kind: EvidenceKind;
  size: number;
  received_at: string;
  /** false once deleted (withdrawn, or the retention period passed) */
  kept: boolean;
}

export interface MyReportTimelineItem {
  id: number;
  kind: IncidentUpdateKind;
  from: "you" | "team" | "system";
  status: string | null;
  body: string | null;
  files: string[];
  at: string;
}

export interface MyReportDetail extends MyReport {
  description: string;
  address: string | null;
  latitude: number;
  longitude: number;
  is_anonymous: boolean;
  decision_note: string | null;
  /** when rejected as a duplicate of a public alert, its reference */
  duplicate_of: string | null;
  can_reply: boolean;
  can_withdraw: boolean;
  files: MyReportFile[];
  timeline: MyReportTimelineItem[];
}

export interface MyReportsPage {
  data: MyReport[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  limits: { max_files: number; extensions: string[] };
}

/** POST /me/reports as multipart form data (files[] for photos, videos, voice notes or PDFs). */
export interface ReportInput {
  type: string;
  latitude: number;
  longitude: number;
  address?: string;
  occurred_at: string;
  title: string;
  description: string;
  is_anonymous?: boolean;
  consent: boolean;
}

// ---- staff ----------------------------------------------------------------

export interface PersonRef {
  id: number;
  name: string;
}

export interface AdminIncident {
  id: string;
  ref: string;
  title: string;
  type: IncidentTypeRef | null;
  area: AreaRef | null;
  status: IncidentStatus;
  status_label: string;
  severity: IncidentSeverity;
  latitude: number;
  longitude: number;
  address: string | null;
  reporter: PersonRef | null;
  is_anonymous: boolean;
  assignee: PersonRef | null;
  evidence_count: number;
  is_alert: boolean;
  /** back in the queue after the reporter answered a question */
  reporter_replied: boolean;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentEvidence {
  id: string;
  kind: EvidenceKind;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  exif: { make?: string; model?: string; software?: string; taken_at?: string; width?: number; height?: number; latitude?: number; longitude?: number };
  captured_at: string | null;
  source: "reporter" | "staff";
  uploader: PersonRef | null;
  uploader_ip: string | null;
  received_at: string;
  kept: boolean;
  purged_at: string | null;
}

export interface IncidentTimelineItem {
  id: number;
  kind: IncidentUpdateKind;
  by: (PersonRef & { is_reporter: boolean }) | null;
  from_status: IncidentStatus | null;
  to_status: IncidentStatus | null;
  to_label: string | null;
  body: string | null;
  visible_to_reporter: boolean;
  files: string[];
  at: string;
}

export interface EvidenceHandover {
  id: string;
  agency: string;
  officer_name: string;
  officer_id: string | null;
  police_report_no: string;
  notes: string | null;
  files: number;
  pack_size: number;
  manifest_sha256: string;
  pack_sha256: string;
  has_pack: boolean;
  exported_by: PersonRef | null;
  created_at: string;
}

export interface NearbyIncident {
  ref: string;
  title: string;
  type: IncidentTypeRef | null;
  status: IncidentStatus;
  status_label: string;
  distance_m: number;
  latitude: number;
  longitude: number;
  occurred_at: string;
}

export interface AdminIncidentDetail extends Omit<AdminIncident, "reporter"> {
  description: string;
  reporter: (PersonRef & { email: string | null; phone: string | null; reports_count: number; confirmed_count: number }) | null;
  checklist: Record<string, boolean>;
  checklist_items: { key: string; label: string }[];
  decision_note: string | null;
  decided_by: PersonRef | null;
  decided_at: string | null;
  duplicate_of: string | null;
  submitted_ip: string | null;
  consented_at: string | null;
  alert: {
    title: string | null;
    summary: string | null;
    place: string | null;
    published_at: string | null;
    resolved_at: string | null;
    photos: MediaItem[];
  };
  evidence: IncidentEvidence[];
  timeline: IncidentTimelineItem[];
  handovers: EvidenceHandover[];
  nearby: NearbyIncident[];
  deleted_at: string | null;
}

export interface IncidentSummary {
  to_check: number;
  waiting: number;
  checking: number;
  mine: number;
  live_alerts: number;
  /** the signed-in person's number id, to compare with reporter and assignee ids */
  me: number;
  /** usual police station from Settings › Reports, for the handover form */
  default_agency: string;
  statuses: Record<IncidentStatus, number>;
}

/** POST /admin/incidents/{ref}/action */
export interface IncidentActionInput {
  action: IncidentAction;
  user?: number | null;
  /** required for request_info, unconfirm, reject and reopen; the reporter sees it (except reopen) */
  message?: string;
  note?: string;
  severity?: IncidentSeverity;
  checklist?: Record<string, boolean>;
  publish_alert?: boolean;
  public_title?: string;
  public_summary?: string;
  public_address?: string;
  duplicate_of?: string;
}

/** PUT /admin/incidents/{ref}/alert */
export interface AlertInput {
  public_title?: string | null;
  public_summary?: string | null;
  public_address?: string | null;
  severity?: IncidentSeverity;
  published?: boolean;
}

/** POST /admin/incidents/{ref}/handovers */
export interface HandoverInput {
  agency: string;
  officer_name: string;
  officer_id?: string;
  police_report_no: string;
  notes?: string;
  /** evidence ids to include; all files when left out */
  evidence?: string[];
}

export interface IncidentTypeInput {
  name: string;
  description?: string;
  slug?: string;
  icon: string;
  color: CategoryColor;
  default_severity: IncidentSeverity;
  is_active?: boolean;
}
