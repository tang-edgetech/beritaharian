/* Shapes returned by the Laravel API. Keep in sync with app/Http/Resources and controllers. */

export interface ApiErrorBody {
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export interface MessageResponse {
  message: string;
}

export type UserStatus = "active" | "suspended" | "banned";

export interface RoleSummary {
  name: string;
  label: string;
}

export interface UserProfile {
  display_name: string | null;
  avatar_path: string | null;
  user_type: "local" | "tourist" | null;
  preferred_locale: string | null;
  bio: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  is_verified: boolean;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  two_factor_enabled: boolean;
  roles?: RoleSummary[];
  permissions?: string[];
  profile?: UserProfile;
  last_login_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export type AuthResult =
  | { status: "verification_required"; message: string; token: string; destination: string | null }
  | { status: "two_factor_required"; message: string; token: string }
  | { status: "authenticated"; message: string; token: string; two_factor_setup_required: boolean; user: User };

export interface MeResponse {
  user: User;
  two_factor_setup_required: boolean;
}

/** Laravel resource-collection pagination */
export interface Paginated<T> {
  data: T[];
  links?: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { current_page: number; from: number | null; last_page: number; per_page: number; to: number | null; total: number };
}

/** Plain Laravel paginator (used by the log endpoints) */
export interface PlainPaginated<T> {
  data: T[];
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface Role {
  name: string;
  label: string;
  description: string | null;
  is_system: boolean;
  is_locked: boolean;
  position: number;
  users_count: number | null;
  permissions: string[];
}

export interface PermissionGroup {
  group: string;
  label: string;
  permissions: { name: string; label: string }[];
}

export interface AuditEntry {
  id: number;
  area: string;
  event: string | null;
  description: string;
  by: { id: string | null; name: string };
  subject: { type: string; label: string } | null;
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  created_at: string;
}

export interface LoginEntry {
  id: number;
  identifier: string;
  user: { id: string; name: string } | null;
  succeeded: boolean;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Session {
  id: number;
  device: string;
  is_current: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface TwoFactorSetup {
  secret: string;
  qr_svg: string;
  otpauth_url: string;
}

export type SettingsGroup = "general" | "security" | "company" | "billing" | "extra";
export type SettingsValues = Record<string, unknown>;

/* ------------------------------------------------------------------ billing
   Money is always whole sen (RM 12.50 = 1250). */

export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "credited" | "void";
export type PaymentStatus = "pending" | "confirmed" | "rejected";
export type PaymentKind = "payment" | "refund";
export type PaymentMethod = "bank_transfer" | "duitnow" | "cash" | "cheque" | "card" | "ewallet" | "other";

export interface Address {
  line1: string | null;
  line2: string | null;
  postcode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface BillingCustomer {
  id: string;
  name: string;
  registration_no: string | null;
  tax_id: string | null;
  sst_no: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: Address;
  address_lines: string[];
  notes: string | null;
  invoices_count?: number;
  balance_sen?: number;
  created_at: string;
  deleted_at: string | null;
}

export interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
  registration_no: string | null;
}

/** Party details frozen on an issued document. */
export interface DocumentParty {
  name: string;
  registration_no?: string | null;
  tax_id?: string | null;
  sst_no?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string[];
  bank?: { name: string | null; account_name: string | null; account_no: string | null };
  tax_label?: string;
}

export interface InvoiceLine {
  id: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price_sen: number;
  discount_sen: number;
  tax_rate: number;
  tax_sen: number;
  amount_sen: number;
}

export interface Payment {
  id: string;
  receipt_number: string | null;
  kind: PaymentKind;
  method: PaymentMethod;
  method_label: string;
  reference: string | null;
  amount_sen: number;
  paid_on: string;
  status: PaymentStatus;
  has_slip: boolean;
  notes: string | null;
  rejected_reason: string | null;
  invoice?: { id: string; number: string | null };
  customer?: { id: string; name: string };
  recorded_by?: string | null;
  confirmed_by?: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface CreditNote {
  id: string;
  number: string;
  issue_date: string;
  reason: string;
  description: string;
  subtotal_sen: number;
  tax_rate: number;
  tax_sen: number;
  total_sen: number;
  invoice?: { id: string; number: string | null };
  customer?: { id: string; name: string };
  issued_by?: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  is_overdue: boolean;
  customer?: { id: string; name: string };
  issue_date: string | null;
  due_date: string | null;
  reference: string | null;
  currency: string;
  subtotal_sen: number;
  discount_sen: number;
  tax_sen: number;
  total_sen: number;
  paid_sen: number;
  refunded_sen: number;
  credited_sen: number;
  balance_sen: number;
  notes: string | null;
  terms: string | null;
  seller: DocumentParty | null;
  buyer: DocumentParty | null;
  lines?: InvoiceLine[];
  payments?: Payment[];
  credit_notes?: CreditNote[];
  issued_at: string | null;
  issued_by?: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  number: string;
  spent_on: string;
  category: string;
  payee: string;
  description: string;
  reference: string | null;
  method: PaymentMethod;
  method_label: string;
  amount_sen: number;
  tax_sen: number;
  total_sen: number;
  has_attachment: boolean;
  attachment_name: string | null;
  notes: string | null;
  recorded_by?: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface BillingSummary {
  outstanding_sen: number;
  overdue_sen: number;
  overdue_count: number;
  drafts: number;
  received_this_month_sen: number;
  pending_payments: number;
}

export type ReportValueType = "text" | "date" | "money" | "number";

export interface ReportTable {
  title: string;
  columns: { key: string; label: string; type: ReportValueType }[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, number> | null;
}

export interface FinanceReport {
  key: string;
  title: string;
  period: string;
  from: string;
  to: string;
  generated_at: string;
  note: string | null;
  summary: { label: string; value: number; type: ReportValueType }[];
  tables: ReportTable[];
  customer?: DocumentParty;
}
