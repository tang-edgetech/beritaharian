/* Places directory (Peta Melaka): sectors, places, branches, reviews, claims. */

import type { CategoryColor, MediaItem } from "./types";

export type SectorFieldType = "boolean" | "text" | "number" | "select" | "multiselect";
export type BusinessStatus = "pending" | "active" | "suspended";
export type ReviewStatus = "pending" | "held" | "returned" | "visible" | "removed";
export type ProofKind = "receipt" | "checkin";
export type ClaimStatus = "pending" | "approved" | "rejected";
export type ReviewReportReason = "fake" | "offensive" | "personal" | "unrelated" | "other";
export type ContactKey = "phone" | "whatsapp" | "email" | "website" | "facebook" | "instagram" | "tiktok";
export type SubRatingKey = "service" | "value" | "cleanliness";
export type DetailValue = boolean | number | string | string[];

/** Lighter pages used by the directory endpoints. */
export interface SimplePage<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from?: number | null; to?: number | null };
}

export interface SectorField {
  key: string;
  label: string;
  type: SectorFieldType;
  options?: string[];
  unit?: string;
  filterable?: boolean;
}

export interface SectorRef {
  slug: string;
  name: string;
  color: CategoryColor;
  /** lucide icon name, e.g. "utensils" */
  icon: string;
}

export interface Sector extends SectorRef {
  description: string | null;
  fields: SectorField[];
  is_active: boolean;
  position: number;
  places_count: number | null;
}

export interface AreaPoint {
  slug: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AreaPointGroup extends AreaPoint {
  children: AreaPoint[];
}

/** One branch in a list: a chain shows once per shop. `id` is the branch id. */
export interface PlaceCard {
  id: string;
  business_id: string;
  slug: string;
  name: string;
  summary: string | null;
  sector: SectorRef | null;
  area: { slug: string; name: string } | null;
  branch_label: string | null;
  branch_count: number | null;
  address: string;
  latitude: number;
  longitude: number;
  rating_avg: number;
  rating_count: number;
  is_claimed: boolean;
  logo: MediaItem | null;
  photo: MediaItem | null;
  /** null when the place hasn't given opening hours */
  open_now: boolean | null;
  hours_today: string | null;
  distance_m: number | null;
}

export interface PlacePin {
  id: string;
  slug: string;
  name: string;
  sector: string | null;
  color: CategoryColor;
  latitude: number;
  longitude: number;
  rating_avg: number;
}

export interface HoursRow {
  /** 0 Sunday ... 6 Saturday */
  day: number;
  /** "HH:MM" */
  opens: string;
  /** "HH:MM" or "24:00"; a time not after `opens` means past midnight */
  closes: string;
}

export interface WeekDay {
  day: number;
  name: string;
  periods: { opens: string; closes: string; label: string }[];
}

export interface PlaceLocation {
  id: string;
  label: string | null;
  address: string;
  postcode: string | null;
  area: { slug: string; name: string } | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  hours_note: string | null;
  is_primary: boolean;
  open_now: boolean | null;
  hours_today: string | null;
  week: WeekDay[];
  /** only in admin and owner responses */
  hours?: HoursRow[];
}

export interface PlaceDetailValue {
  key: string;
  label: string;
  type: SectorFieldType;
  value: DetailValue;
  display: string;
}

export interface PublicReview {
  id: string;
  rating: number;
  sub_ratings: Partial<Record<SubRatingKey, number>>;
  title: string | null;
  body: string;
  visited_on: string | null;
  author_name: string;
  is_verified_visit: boolean;
  helpful_count: number;
  branch_label: string | null;
  photos: MediaItem[];
  reply: { body: string; created_at: string | null } | null;
  published_at: string | null;
}

export interface PlaceDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sector: SectorRef | null;
  details: PlaceDetailValue[];
  contacts: Partial<Record<ContactKey, string>>;
  rating_avg: number;
  rating_count: number;
  rating_breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  sub_ratings: Record<SubRatingKey, number | null>;
  is_claimed: boolean;
  logo: MediaItem | null;
  photos: MediaItem[];
  locations: PlaceLocation[];
  reviews: PublicReview[];
  updated_at: string | null;
}

/** A reader's own review, with its status. */
export interface MyReview extends PublicReview {
  status: ReviewStatus;
  moderation_note: string | null;
  proof: ProofKind | null;
  place: { slug: string; name: string; sector: string | null };
  created_at: string | null;
}

/** GET /me/places/{slug} */
export interface MyPlaceStatus {
  my_review: MyReview | null;
  my_claim: { status: ClaimStatus; decision_note: string | null; created_at: string | null } | null;
  is_manager: boolean;
  /** review ids I marked helpful */
  voted: string[];
  /** review ids I reported */
  reported: string[];
}

/** Admin and owner view of a listing. */
export interface BusinessListItem {
  id: string;
  slug: string;
  name: string;
  status: BusinessStatus;
  sector: SectorRef | null;
  area: { slug: string; name: string } | null;
  address: string | null;
  branch_count: number;
  is_claimed: boolean;
  rating_avg: number;
  rating_count: number;
  logo: MediaItem | null;
  created_by: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  /** owner list only: visible reviews without a reply */
  open_reviews?: number;
}

export interface BusinessFull extends BusinessListItem {
  description: string;
  ssm_number: string | null;
  details: Record<string, DetailValue>;
  contacts: Partial<Record<ContactKey, string>>;
  submitted_note: string | null;
  moderation_note: string | null;
  approved_at: string | null;
  photos: MediaItem[];
  locations: (PlaceLocation & { hours: HoursRow[] })[];
  members: { id: number; name: string; email: string; role: string }[];
  pending_claims: number;
  /** owner endpoint only */
  sector_fields?: SectorField[];
}

/** What the admin and owner forms send for a branch. */
export interface LocationInput {
  id?: string;
  label?: string | null;
  address: string;
  postcode?: string | null;
  area?: string | null;
  latitude: number;
  longitude: number;
  phone?: string | null;
  hours_note?: string | null;
  is_primary?: boolean;
  hours: HoursRow[];
}

export interface BusinessInput {
  sector: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  ssm_number?: string | null;
  status?: BusinessStatus;
  details: Record<string, DetailValue>;
  contacts: Partial<Record<ContactKey, string>>;
  locations: LocationInput[];
}

export interface BusinessClaim {
  id: string;
  status: ClaimStatus;
  role: "owner" | "manager";
  ssm_number: string | null;
  phone: string;
  note: string | null;
  has_document: boolean;
  decision_note: string | null;
  decided_at: string | null;
  decided_by: { id: number; name: string } | null;
  user: { id: number; name: string; email: string } | null;
  place: { id: string; slug: string; name: string; sector: string | null; ssm_number: string | null; is_claimed: boolean } | null;
  created_at: string | null;
  /** detail endpoint only */
  other_claims?: BusinessClaim[];
  managers?: { id: number; name: string; email: string; role: string }[];
}

export interface AdminReview extends PublicReview {
  status: ReviewStatus;
  flags: string[];
  is_anonymous: boolean;
  open_reports: number;
  moderation_note: string | null;
  moderated_at: string | null;
  moderator: { id: number; name: string } | null;
  writer: { id: number; name: string; email: string } | null;
  place: { id: string; slug: string; name: string; sector: string | null } | null;
  proof: { kind: ProofKind; status: "pending" | "confirmed" | "rejected"; distance_m: number | null; has_file: boolean; verified_at: string | null } | null;
  created_at: string | null;
  deleted_at: string | null;
  /** detail endpoint only */
  reports?: {
    id: number;
    reason: ReviewReportReason;
    reason_label: string;
    note: string | null;
    status: "open" | "resolved";
    by: { id: number; name: string } | null;
    is_manager: boolean;
    created_at: string | null;
  }[];
}

export interface DirectorySummary {
  places: number;
  new_places: number;
  claims: number;
  reviews_to_check: number;
  reported_reviews: number;
}

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
}

/** GET /me/businesses */
export interface MyBusinesses {
  places: BusinessListItem[];
  claims: BusinessClaim[];
}
