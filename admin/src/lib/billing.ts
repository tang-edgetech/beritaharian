import type { InvoiceStatus, PaymentMethod, PaymentStatus, Query } from "@cendol/api-client";
import type { StatusTone } from "@/components/status-badge";
import { api } from "./api";
import { notify } from "./notify";

const ringgit = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123450 -> "RM 1,234.50" (negative amounts keep their minus sign). */
export function formatMoney(sen: number | null | undefined, withSymbol = true): string {
  const value = sen ?? 0;
  const text = ringgit.format(Math.abs(value) / 100);
  return `${value < 0 ? "-" : ""}${withSymbol ? "RM " : ""}${text}`;
}

/** "12.5" -> 1250. Empty or invalid input counts as zero. */
export function toSen(input: string | number | null | undefined): number {
  const value = typeof input === "number" ? input : Number(String(input ?? "").replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** 1250 -> "12.50", for form inputs. */
export function senToInput(sen: number | null | undefined): string {
  return ((sen ?? 0) / 100).toFixed(2);
}

/** Today in Malaysia as YYYY-MM-DD. */
export function todayInMalaysia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
}

export function firstOfMonth(): string {
  return `${todayInMalaysia().slice(0, 8)}01`;
}

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  issued: { label: "Awaiting payment", tone: "warning" },
  partially_paid: { label: "Partly paid", tone: "warning" },
  paid: { label: "Paid", tone: "good" },
  credited: { label: "Credited", tone: "good" },
  void: { label: "Void", tone: "danger" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting for check", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "good" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "duitnow", label: "DuitNow" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "ewallet", label: "E-wallet" },
  { value: "other", label: "Other" },
];

export const MALAYSIAN_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak",
  "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya",
];

/** Downloads a PDF or CSV from the API and saves it with the server's file name. */
export async function saveFile(path: string, query?: Query): Promise<void> {
  try {
    const { blob, filename } = await api.download(path, query);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (error) {
    notify.error(error, "We couldn't prepare that file. Please try again.");
  }
}

/** Opens a PDF in a new tab, ready for the browser's Print button. */
export async function openForPrint(path: string, query?: Query): Promise<void> {
  // open the tab straight away (inside the click) so pop-up blockers allow it
  const tab = window.open("", "_blank");
  try {
    const { blob } = await api.download(path, query);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    notify.error(error, "We couldn't prepare that file. Please try again.");
  }
}
