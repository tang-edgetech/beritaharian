import { formatMoney } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { DocumentParty, Invoice } from "@cendol/api-client";

function Party({ label, party, registrationLabel = "Reg. no." }: { label: string; party: DocumentParty | null | undefined; registrationLabel?: string }) {
  return (
    <div className="document-party flex flex-col gap-0.5 rounded-lg border p-4 text-sm">
      <span className="document-party-label text-[0.68rem] font-semibold tracking-widest text-muted-foreground uppercase">{label}</span>
      {party ? (
        <>
          <span className="document-party-name font-heading text-base font-bold">{party.name}</span>
          {party.registration_no ? <span className="text-xs text-muted-foreground">{registrationLabel} {party.registration_no}</span> : null}
          {party.tax_id ? <span className="text-xs text-muted-foreground">TIN {party.tax_id}</span> : null}
          {party.address?.map((line) => <span key={line}>{line}</span>)}
          {party.contact_person ? <span>Attn: {party.contact_person}</span> : null}
          {party.email ? <span className="text-muted-foreground">{party.email}</span> : null}
        </>
      ) : (
        <span className="text-muted-foreground">Filled in when the invoice is issued.</span>
      )}
    </div>
  );
}

/**
 * On-screen version of the invoice, laid out like the printed PDF.
 * Drafts show the customer's current details; issued invoices show the details frozen at issue.
 */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const lines = invoice.lines ?? [];
  const hasDiscount = invoice.discount_sen > 0;
  const hasTax = invoice.tax_sen > 0;
  const taxLabel = invoice.seller?.tax_label ?? "SST";
  const buyer = invoice.buyer ?? (invoice.customer ? { name: invoice.customer.name } : null);

  return (
    <article className="invoice-document panel-card flex flex-col gap-6" aria-label="Invoice preview">
      <div className="invoice-document-parties grid gap-4 md:grid-cols-2">
        <Party label="From" party={invoice.seller} />
        <Party label="Bill to" party={buyer} registrationLabel="Reg. / IC no." />
      </div>

      <dl className="invoice-document-facts grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {[
          ["Invoice no.", invoice.number ?? "Given when issued"],
          ["Your reference", invoice.reference ?? "—"],
          ["Invoice date", formatDate(invoice.issue_date)],
          ["Due date", invoice.due_date ? formatDate(invoice.due_date) : "From payment terms"],
        ].map(([label, value]) => (
          <div key={label} className="invoice-document-fact flex justify-between gap-4 border-b pb-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="invoice-document-lines overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-pandan-700 text-left text-xs tracking-wide text-coconut uppercase">
            <tr>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit price</th>
              {hasDiscount ? <th className="px-3 py-2 text-right">Discount</th> : null}
              {hasTax ? <th className="px-3 py-2 text-right">{taxLabel}</th> : null}
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {lines.map((line, index) => (
              <tr key={line.id} className="invoice-document-line border-t even:bg-muted/40">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {line.quantity} {line.unit}
                </td>
                <td className="px-3 py-2 text-right">{formatMoney(line.unit_price_sen, false)}</td>
                {hasDiscount ? <td className="px-3 py-2 text-right">{line.discount_sen ? formatMoney(line.discount_sen, false) : "—"}</td> : null}
                {hasTax ? <td className="px-3 py-2 text-right">{line.tax_sen ? `${formatMoney(line.tax_sen, false)} (${line.tax_rate}%)` : "—"}</td> : null}
                <td className="px-3 py-2 text-right">{formatMoney(line.amount_sen + line.tax_sen, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="invoice-document-totals ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-y-1.5 text-sm tabular-nums [&>dd]:pl-6">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right">{formatMoney(invoice.subtotal_sen)}</dd>
        {hasDiscount ? (
          <>
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-right">-{formatMoney(invoice.discount_sen)}</dd>
          </>
        ) : null}
        {hasTax ? (
          <>
            <dt className="text-muted-foreground">{taxLabel}</dt>
            <dd className="text-right">{formatMoney(invoice.tax_sen)}</dd>
          </>
        ) : null}
        <dt className="invoice-document-grand rounded-l-md bg-marigold-100 px-2 py-1.5 font-heading text-base font-extrabold dark:bg-marigold-900/50">Total</dt>
        <dd className="rounded-r-md bg-marigold-100 px-2 py-1.5 text-right font-heading text-base font-extrabold dark:bg-marigold-900/50">
          {formatMoney(invoice.total_sen)}
        </dd>
        {invoice.credited_sen ? (
          <>
            <dt className="text-muted-foreground">Less credit notes</dt>
            <dd className="text-right">-{formatMoney(invoice.credited_sen)}</dd>
          </>
        ) : null}
        {invoice.paid_sen ? (
          <>
            <dt className="text-muted-foreground">Less payments received</dt>
            <dd className="text-right">-{formatMoney(invoice.paid_sen)}</dd>
          </>
        ) : null}
        {invoice.refunded_sen ? (
          <>
            <dt className="text-muted-foreground">Add refunds paid</dt>
            <dd className="text-right">{formatMoney(invoice.refunded_sen)}</dd>
          </>
        ) : null}
        {invoice.status !== "draft" ? (
          <>
            <dt className="font-semibold">{invoice.balance_sen < 0 ? "We owe the customer" : "Balance due"}</dt>
            <dd className={`text-right font-semibold ${invoice.balance_sen < 0 ? "text-destructive" : ""}`}>{formatMoney(Math.abs(invoice.balance_sen))}</dd>
          </>
        ) : null}
      </dl>

      {invoice.notes || invoice.terms ? (
        <div className="invoice-document-notes grid gap-4 text-sm md:grid-cols-2">
          {invoice.notes ? <p className="rounded-lg border-l-4 border-marigold-400 bg-marigold-50 px-4 py-2 whitespace-pre-line dark:bg-marigold-900/30">{invoice.notes}</p> : null}
          {invoice.terms ? <p className="text-xs whitespace-pre-line text-muted-foreground">{invoice.terms}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
