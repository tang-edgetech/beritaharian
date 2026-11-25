"use client";

import { IconAction } from "@/components/icon-action";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveFile } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { CreditNote, Payment } from "@cendol/api-client";
import { Download, Eye } from "lucide-react";
import { PaymentStatusBadge } from "./billing-badges";
import { MoneyText } from "./money-text";

/** Payments and refunds recorded against one invoice. */
export function PaymentTable({ payments }: { payments: Payment[] }) {
  if (!payments.length) {
    return <p className="panel-card text-sm text-muted-foreground">No payments recorded yet.</p>;
  }
  return (
    <div className="payment-table overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Receipt no.</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id} className="payment-row">
              <TableCell className="whitespace-nowrap">{formatDate(p.paid_on)}</TableCell>
              <TableCell className="tabular-nums">{p.receipt_number ?? "—"}</TableCell>
              <TableCell>{p.method_label}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.reference ?? "—"}</TableCell>
              <TableCell>
                <PaymentStatusBadge status={p.status} kind={p.kind} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyText sen={p.kind === "refund" ? -p.amount_sen : p.amount_sen} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-0.5">
                  <IconAction icon={Eye} label="Open payment" href={`/billing/payments/${p.id}`} />
                  {p.status === "confirmed" ? (
                    <IconAction
                      icon={Download}
                      label={p.kind === "refund" ? "Download refund voucher" : "Download receipt"}
                      onClick={() => saveFile(`admin/billing/payments/${p.id}/receipt`)}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CreditNoteTable({ notes }: { notes: CreditNote[] }) {
  if (!notes.length) {
    return <p className="panel-card text-sm text-muted-foreground">No credit notes for this invoice.</p>;
  }
  return (
    <div className="credit-note-table overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Credit note no.</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notes.map((n) => (
            <TableRow key={n.id} className="credit-note-row">
              <TableCell className="whitespace-nowrap">{formatDate(n.issue_date)}</TableCell>
              <TableCell className="tabular-nums">{n.number}</TableCell>
              <TableCell className="text-sm">{n.reason}</TableCell>
              <TableCell className="text-right">
                <MoneyText sen={n.total_sen} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-0.5">
                  <IconAction icon={Eye} label="Open credit note" href={`/billing/credit-notes/${n.id}`} />
                  <IconAction icon={Download} label="Download PDF" onClick={() => saveFile(`admin/billing/credit-notes/${n.id}/pdf`)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
