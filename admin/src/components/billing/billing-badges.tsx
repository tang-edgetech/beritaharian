import { StatusBadge } from "@/components/status-badge";
import { INVOICE_STATUS, PAYMENT_STATUS } from "@/lib/billing";
import type { InvoiceStatus, PaymentKind, PaymentStatus } from "@cendol/api-client";

export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  if (overdue) return <StatusBadge tone="danger">Overdue</StatusBadge>;
  const item = INVOICE_STATUS[status];
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>;
}

export function PaymentStatusBadge({ status, kind }: { status: PaymentStatus; kind?: PaymentKind }) {
  const item = PAYMENT_STATUS[status];
  return (
    <span className="payment-status flex flex-wrap items-center gap-1">
      <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
      {kind === "refund" ? <StatusBadge tone="neutral">Refund</StatusBadge> : null}
    </span>
  );
}
