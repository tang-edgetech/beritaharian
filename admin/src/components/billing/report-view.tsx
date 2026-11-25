"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, openForPrint, saveFile } from "@/lib/billing";
import { formatDate, formatDateTime } from "@/lib/format";
import type { FinanceReport, ReportValueType } from "@cendol/api-client";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";
import { StatTile } from "./money-text";

function cellText(value: string | number | null | undefined, type: ReportValueType): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return formatMoney(Number(value), false);
  if (type === "date") return formatDate(String(value));
  if (type === "number") return Number(value).toLocaleString("en-MY");
  return String(value);
}

const numeric = (type: ReportValueType) => type === "money" || type === "number";

/** Draws a finance report exactly as the PDF prints it: summary figures, then each table with its totals. */
export function ReportView({ report }: { report: FinanceReport }) {
  return (
    <div className="report-view flex flex-col gap-6">
      <div className="report-view-heading flex flex-col gap-0.5">
        <h2 className="font-heading text-lg font-bold">{report.title}</h2>
        <p className="text-sm text-muted-foreground">
          {report.period} · prepared {formatDateTime(report.generated_at)}
        </p>
      </div>

      <div className="report-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {report.summary.map((item) => (
          <StatTile key={item.label} label={item.label}>
            {item.type === "money" ? formatMoney(item.value) : item.value.toLocaleString("en-MY")}
          </StatTile>
        ))}
      </div>

      {report.tables.map((table) => (
        <section key={table.title} className="report-table flex flex-col gap-2">
          <h3 className="report-table-title font-heading text-base font-bold">{table.title}</h3>
          <div className="report-table-wrapper overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((column) => (
                    <TableHead key={column.key} className={numeric(column.type) ? "text-right" : undefined}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.length ? (
                  table.rows.map((row, index) => (
                    <TableRow key={index} className="report-row">
                      {table.columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={[
                            numeric(column.type) ? "text-right tabular-nums" : "",
                            column.type === "money" && Number(row[column.key]) < 0 ? "text-destructive" : "",
                            "whitespace-nowrap",
                          ].join(" ")}
                        >
                          {cellText(row[column.key], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.columns.length} className="py-8 text-center text-muted-foreground">
                      Nothing in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {table.totals && table.rows.length ? (
                <TableFooter>
                  <TableRow className="report-totals font-semibold">
                    {table.columns.map((column, index) => (
                      <TableCell key={column.key} className={numeric(column.type) ? "text-right tabular-nums whitespace-nowrap" : undefined}>
                        {table.totals && column.key in table.totals ? cellText(table.totals[column.key], column.type) : index === 0 ? "Total" : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </section>
      ))}

      <p className="report-note text-xs text-muted-foreground">Amounts in Malaysian Ringgit (RM). {report.note}</p>
    </div>
  );
}

interface ReportToolbarProps {
  /** API path that returns the report; ?format=pdf|csv gives the files. */
  endpoint: string;
  from: string;
  to: string;
  onChange?: (range: { from: string; to: string }) => void;
  /** Outstanding is always "as of today", so it has no dates to pick. */
  showDates?: boolean;
}

/** Period picker plus Print, PDF and spreadsheet buttons for a report. */
export function ReportToolbar({ endpoint, from, to, onChange, showDates = true }: ReportToolbarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const query = { from, to };

  async function run(kind: string, task: () => Promise<void>) {
    setBusy(kind);
    await task();
    setBusy(null);
  }

  const presets = (() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const y = today.getFullYear();
    const m = today.getMonth();
    return [
      { label: "This month", from: iso(new Date(y, m, 1)), to: iso(today) },
      { label: "Last month", from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
      { label: "This year", from: `${y}-01-01`, to: iso(today) },
      { label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    ];
  })();

  return (
    <div className="report-toolbar panel-card flex flex-col gap-4">
      {showDates ? (
        <div className="report-period flex flex-wrap items-end gap-3">
          <FormField id="report-from" label="From">
            <Input id="report-from" type="date" value={from} max={to} onChange={(e) => e.target.value && onChange?.({ from: e.target.value, to })} />
          </FormField>
          <FormField id="report-to" label="To">
            <Input id="report-to" type="date" value={to} min={from} onChange={(e) => e.target.value && onChange?.({ from, to: e.target.value })} />
          </FormField>
          <div className="report-presets flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant={preset.from === from && preset.to === to ? "secondary" : "ghost"}
                onClick={() => onChange?.({ from: preset.from, to: preset.to })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This report always shows what is owed as of today.</p>
      )}
      <div className="report-exports flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => run("print", () => openForPrint(endpoint, { ...query, format: "pdf" }))}>
          <Printer />
          Print
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => run("pdf", () => saveFile(endpoint, { ...query, format: "pdf" }))}>
          <Download />
          {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => run("csv", () => saveFile(endpoint, { ...query, format: "csv" }))}>
          <FileSpreadsheet />
          {busy === "csv" ? "Preparing…" : "Spreadsheet (CSV)"}
        </Button>
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="report-skeleton flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
