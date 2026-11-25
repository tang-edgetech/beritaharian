import { formatMoney } from "@/lib/billing";

/** A ringgit amount, right-aligned digits that line up in columns. */
export function MoneyText({ sen, className, muted }: { sen: number | null | undefined; className?: string; muted?: boolean }) {
  return (
    <span
      className={[
        "money-text whitespace-nowrap tabular-nums",
        (sen ?? 0) < 0 ? "is-negative text-destructive" : "",
        muted ? "text-muted-foreground" : "",
        className ?? "",
      ].join(" ")}
    >
      {formatMoney(sen)}
    </span>
  );
}

/** A labelled figure for the tops of finance pages. */
export function StatTile({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "warning" | "danger" | "good" }) {
  const toneClass =
    tone === "danger"
      ? "is-danger border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
      : tone === "warning"
        ? "is-warning border-marigold-200 bg-marigold-50 dark:border-marigold-900 dark:bg-marigold-900/30"
        : tone === "good"
          ? "is-good border-pandan-200 bg-pandan-50 dark:border-pandan-900 dark:bg-pandan-950/40"
          : "bg-card";
  return (
    <div className={`stat-tile flex min-w-0 flex-col gap-1 rounded-xl border p-4 ${toneClass}`}>
      <span className="stat-tile-label text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="stat-tile-value font-heading text-xl font-extrabold tabular-nums">{children}</span>
    </div>
  );
}
