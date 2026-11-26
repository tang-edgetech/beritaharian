"use client";

import type {
  AreaPointGroup,
  BusinessStatus,
  ClaimStatus,
  ContactKey,
  DirectorySummary,
  ProofKind,
  ReviewStatus,
  Sector,
  SectorFieldType,
  SubRatingKey,
} from "@cendol/api-client";
import type { StatusTone } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";

export const BUSINESS_STATUS: Record<BusinessStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting for approval", tone: "warning" },
  active: { label: "On the map", tone: "good" },
  suspended: { label: "Taken off the map", tone: "danger" },
};

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Receipt to check", tone: "warning" },
  held: { label: "Held for a read", tone: "warning" },
  returned: { label: "Sent back", tone: "neutral" },
  visible: { label: "Shown", tone: "good" },
  removed: { label: "Taken down", tone: "danger" },
};

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Turned down", tone: "neutral" },
};

export const PROOF_LABEL: Record<ProofKind, string> = {
  receipt: "Receipt photo",
  checkin: "Check-in at the place",
};

/** The automatic checks, in plain words. */
export const FLAG_LABEL: Record<string, string> = {
  blocked_words: "Uses a word on the blocked list",
  link: "Contains a web link",
  personal_info: "Looks like it shares a phone number or e-mail",
  duplicate: "Same text as another review by this person",
};

export const SUB_RATING_LABEL: Record<SubRatingKey, string> = {
  service: "Service",
  value: "Value for money",
  cleanliness: "Cleanliness",
};

export const CONTACT_FIELDS: { key: ContactKey; label: string; placeholder: string; type?: string }[] = [
  { key: "phone", label: "Phone", placeholder: "06-123 4567" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "60123456789" },
  { key: "email", label: "E-mail", placeholder: "hello@example.com", type: "email" },
  { key: "website", label: "Website", placeholder: "https://…" },
  { key: "facebook", label: "Facebook", placeholder: "Page link or name" },
  { key: "instagram", label: "Instagram", placeholder: "@handle" },
  { key: "tiktok", label: "TikTok", placeholder: "@handle" },
];

export const FIELD_TYPES: { value: SectorFieldType; label: string; hint: string }[] = [
  { value: "boolean", label: "Yes or no", hint: "e.g. Halal, Free parking" },
  { value: "select", label: "One choice", hint: "e.g. Price range" },
  { value: "multiselect", label: "Several choices", hint: "e.g. Cuisine" },
  { value: "number", label: "Number", hint: "e.g. Rooms, Seats" },
  { value: "text", label: "Short text", hint: "e.g. Speciality" },
];

/** Common lucide icon names for sectors; any lucide name works. */
export const SECTOR_ICON_SUGGESTIONS = ["utensils", "coffee", "bed-double", "landmark", "shopping-bag", "wrench", "stethoscope", "car", "graduation-cap", "church", "trees", "store"];

/** The public site's address for a place. */
export function publicPlaceUrl(sector: string | null | undefined, slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/places/${sector ?? "all"}/${slug}`;
}

export function useSectors() {
  return useQuery({
    queryKey: ["directory-sectors"],
    queryFn: () => api.get<{ data: Sector[] }>("admin/directory/sectors").then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useDirectoryAreas() {
  return useQuery({
    queryKey: ["directory-areas"],
    queryFn: () => api.get<{ data: AreaPointGroup[] }>("admin/directory/areas").then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

export const DIRECTORY_PERMISSIONS = ["directory.manage", "directory.claims", "reviews.moderate"];

export function useDirectorySummary() {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["directory-summary"],
    queryFn: () => api.get<{ data: DirectorySummary }>("admin/directory/summary").then((r) => r.data),
    enabled: DIRECTORY_PERMISSIONS.some((p) => can(p)),
    refetchInterval: 60_000,
  });
}

/** "4.5" with one decimal, or "—" when there are no reviews. */
export function ratingText(avg: number, count: number): string {
  return count ? avg.toFixed(1) : "—";
}
