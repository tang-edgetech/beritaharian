import { alertHref } from "@/lib/alert-links";
import { getAlerts } from "@/lib/alerts";
import { ArrowRight, Siren } from "lucide-react";
import Link from "next/link";
import { IncidentIcon } from "./alert-bits";

/** Up to three active alerts for the Kopitiam Board. Draws nothing when all is quiet. */
export async function LiveAlertsStrip() {
  const page = await getAlerts({ state: "active" }, 3);
  const alerts = page?.data ?? [];
  if (!alerts.length) return null;
  const total = page?.meta.total ?? alerts.length;

  return (
    <section className="live-alerts-strip site-container" aria-label="Live alerts">
      <div className="flex flex-col gap-2 rounded-card border border-satay-500/40 bg-gula-50 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 dark:bg-gula-900">
        <Link href="/alerts" className="live-alerts-label inline-flex shrink-0 items-center gap-1.5 text-xs font-black tracking-widest text-satay-700 uppercase hover:underline dark:text-satay-400">
          <Siren className="size-4" aria-hidden />
          Live alerts
        </Link>
        <ul className="live-alerts-list flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:gap-5">
          {alerts.map((a) => (
            <li key={a.ref} className="min-w-0">
              <Link href={alertHref(a.ref)} className="live-alert-link flex min-w-0 items-center gap-1.5 text-sm font-semibold text-gula-900 hover:underline dark:text-coconut">
                <IncidentIcon icon={a.type?.icon} className="size-4 shrink-0 text-satay-700 dark:text-satay-400" />
                <span className="truncate">{a.title}</span>
                {a.area ? <span className="shrink-0 text-xs font-normal text-santan-500">· {a.area.name}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/alerts" className="live-alerts-more inline-flex shrink-0 items-center gap-1 text-sm font-bold text-satay-700 hover:underline dark:text-satay-400">
          {total > alerts.length ? `All ${total}` : "See all"}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
