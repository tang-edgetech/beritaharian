"use client";

import { PaymentStatusBadge } from "@/components/billing/billing-badges";
import { MoneyText } from "@/components/billing/money-text";
import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, openForPrint, saveFile } from "@/lib/billing";
import { formatDate, formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Payment } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Download, Paperclip, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function CheckPanel({ payment }: { payment: Payment }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["payment", payment.id] });
    await queryClient.invalidateQueries({ queryKey: ["listing"] });
    if (payment.invoice) await queryClient.invalidateQueries({ queryKey: ["invoice", payment.invoice.id] });
  }

  async function approve() {
    const ok = await confirm({
      title: `Confirm ${formatMoney(payment.amount_sen)}?`,
      description: "Only confirm after you have seen this money in the bank statement. It gets a receipt number and counts towards the invoice.",
      confirmLabel: "Confirm payment",
    });
    if (!ok) return;
    setBusy(true);
    try {
      notify.success((await api.post<{ message: string }>(`admin/billing/payments/${payment.id}/confirm`)).message);
      await refresh();
    } catch (err) {
      notify.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError("Please say why, so the person who recorded it knows what to fix.");
      return;
    }
    const ok = await confirm({ title: "Reject this payment?", description: "It won't count towards the invoice. This can't be undone.", confirmLabel: "Reject", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      notify.success((await api.post<{ message: string }>(`admin/billing/payments/${payment.id}/reject`, { reason })).message);
      await refresh();
    } catch (err) {
      notify.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="payment-check panel-card flex flex-col gap-4">
      <div>
        <h2 className="panel-card-title">Check this payment</h2>
        <p className="panel-card-description">Match the amount, date and reference against the bank statement.</p>
      </div>
      <FormField id="payment-reject-reason" label="Reason, if rejecting" error={error ?? undefined}>
        <Textarea id="payment-reject-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not found in the bank statement" />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} disabled={busy}>
          <CircleCheck />
          Confirm payment
        </Button>
        <Button variant="outline" onClick={reject} disabled={busy}>
          <CircleX />
          Reject
        </Button>
      </div>
    </section>
  );
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ["payment", id],
    queryFn: () => api.get<{ data: Payment }>(`admin/billing/payments/${id}`).then((r) => r.data),
  });
  const payment = query.data;
  const refund = payment?.kind === "refund";

  return (
    <>
      <PageHeader
        back="/billing/payments"
        backLabel="Payments"
        title={payment ? (payment.receipt_number ?? (refund ? "Refund waiting for check" : "Payment waiting for check")) : <Skeleton className="h-8 w-56" />}
        description={payment ? <PaymentStatusBadge status={payment.status} kind={payment.kind} /> : null}
        actions={
          payment?.status === "confirmed" ? (
            <>
              <Button variant="outline" onClick={() => openForPrint(`admin/billing/payments/${payment.id}/receipt`)}>
                <Printer />
                Print {refund ? "voucher" : "receipt"}
              </Button>
              <Button variant="outline" onClick={() => saveFile(`admin/billing/payments/${payment.id}/receipt`)}>
                <Download />
                PDF
              </Button>
            </>
          ) : null
        }
      />
      {query.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : payment ? (
        <div className="payment-detail grid gap-4 lg:grid-cols-2">
          <section className="panel-card flex flex-col gap-3">
            <h2 className="panel-card-title">{refund ? "Refund" : "Payment"}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd>
                <MoneyText sen={payment.amount_sen} className="font-heading text-lg font-bold" />
              </dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(payment.paid_on)}</dd>
              <dt className="text-muted-foreground">Method</dt>
              <dd>{payment.method_label}</dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd>{payment.reference ?? "—"}</dd>
              <dt className="text-muted-foreground">Invoice</dt>
              <dd>
                {payment.invoice ? (
                  <Link href={`/billing/invoices/${payment.invoice.id}/details`} className="font-medium underline-offset-4 hover:underline">
                    {payment.invoice.number}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Customer</dt>
              <dd>{payment.customer?.name ?? "—"}</dd>
              {payment.notes ? (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-line">{payment.notes}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Recorded by</dt>
              <dd>
                {payment.recorded_by ?? "—"}, {formatDateTime(payment.created_at)}
              </dd>
              {payment.confirmed_at ? (
                <>
                  <dt className="text-muted-foreground">Confirmed by</dt>
                  <dd>
                    {payment.confirmed_by ?? "—"}, {formatDateTime(payment.confirmed_at)}
                  </dd>
                </>
              ) : null}
              {payment.rejected_reason ? (
                <>
                  <dt className="text-muted-foreground">Rejected because</dt>
                  <dd>{payment.rejected_reason}</dd>
                </>
              ) : null}
            </dl>
            {payment.has_slip ? (
              <Button variant="outline" size="sm" className="self-start" onClick={() => saveFile(`admin/billing/payments/${payment.id}/slip`)}>
                <Paperclip />
                Download transfer slip
              </Button>
            ) : null}
          </section>
          {payment.status === "pending" && can("billing.approve") ? <CheckPanel payment={payment} /> : null}
          {payment.status === "pending" && !can("billing.approve") ? (
            <p className="panel-card text-sm text-muted-foreground">Waiting for someone with approval rights to check this payment.</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
