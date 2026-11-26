import type { AlertCard, AlertState, IncidentSeverity, IncidentTypeRef } from "@cendol/api-client";
import { distanceLabel } from "@cendol/map";
import {
  CarFront,
  CircleHelp,
  Construction,
  Droplets,
  Flame,
  Lamp,
  MapPin,
  PawPrint,
  ShieldAlert,
  Siren,
  Trash2,
  TriangleAlert,
  Waves,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ALERT_STATE, alertHref, SEVERITY } from "@/lib/alert-links";
import { formatDateTime } from "@/lib/format";
import { toneFor } from "../news/category-tone";
import { MediaImage } from "../news/media-image";

/* Small pieces shared by alert lists, the map card, the alert page and the report pages. Safe on the server and in the browser. */

const ICONS: Record<string, LucideIcon> = {
  waves: Waves,
  "car-front": CarFront,
  flame: Flame,
  construction: Construction,
  lamp: Lamp,
  droplets: Droplets,
  "trash-2": Trash2,
  "shield-alert": ShieldAlert,
  "paw-print": PawPrint,
  "circle-help": CircleHelp,
  siren: Siren,
  "triangle-alert": TriangleAlert,
};

export function IncidentIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Icon = ICONS[icon ?? ""] ?? TriangleAlert;
  return <Icon className={className} aria-hidden />;
}

/** The kind of incident as a coloured chip, e.g. "Flood". */
export function IncidentTypeChip({ type }: { type: IncidentTypeRef | null }) {
  if (!type) return null;
  return (
    <span className={`incident-type-chip inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold ${toneFor(type.color).chip}`}>
      <IncidentIcon icon={type.icon} className="size-3.5" />
      {type.name}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const s = SEVERITY[severity] ?? SEVERITY.medium;
  return <span className={`severity-badge is-${severity} inline-flex h-6 items-center rounded-full px-2 text-xs font-bold ${s.tone}`}>{s.label} severity</span>;
}

export function AlertStateBadge({ state }: { state: AlertState }) {
  const s = ALERT_STATE[state];
  return (
    <span className={`alert-state-badge is-${state} inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold ${s.tone}`}>
      {state === "active" ? <span className="size-1.5 rounded-full bg-red-600" aria-hidden /> : null}
      {s.label}
    </span>
  );
}

/** One alert in a list. `selected` is set when its pin is chosen on the map. */
export function AlertCardItem({ alert, selected = false, compact = false }: { alert: AlertCard; selected?: boolean; compact?: boolean }) {
  const distance = distanceLabel(alert.distance_m);
  const tone = toneFor(alert.type?.color);
  return (
    <article
      data-alert={alert.ref}
      className={[
        "alert-card group relative flex gap-3 rounded-card border bg-white p-3 transition-shadow dark:bg-santan-900",
        alert.state === "resolved" ? "is-resolved" : "is-active",
        selected ? "is-selected border-pandan-500 shadow-md ring-2 ring-pandan-200 dark:ring-pandan-900" : "border-santan-200 hover:shadow-md dark:border-santan-800",
      ].join(" ")}
    >
      <div className={`alert-card-image shrink-0 overflow-hidden rounded-xl ${compact ? "size-16" : "size-20 sm:size-24"}`}>
        {alert.cover ? (
          <MediaImage media={alert.cover} sizes="96px" className={`size-full object-cover ${alert.state === "resolved" ? "opacity-70 grayscale" : ""}`} />
        ) : (
          <span className={`alert-card-icon flex size-full items-center justify-center ${alert.state === "resolved" ? "bg-santan-100 text-santan-500 dark:bg-santan-800" : tone.chip}`}>
            <IncidentIcon icon={alert.type?.icon} className="size-8" />
          </span>
        )}
      </div>
      <div className="alert-card-body flex min-w-0 flex-1 flex-col gap-1">
        <div className="alert-card-badges flex flex-wrap items-center gap-1.5">
          <AlertStateBadge state={alert.state} />
          <SeverityBadge severity={alert.severity} />
        </div>
        <h3 className="alert-card-title font-display text-lg leading-snug font-black text-gula-900 dark:text-coconut">
          <Link href={alertHref(alert.ref)} className="alert-card-link after:absolute after:inset-0 hover:underline">
            {alert.title}
          </Link>
        </h3>
        {compact ? null : <p className="alert-card-summary line-clamp-2 text-sm text-santan-700 dark:text-santan-200">{alert.summary}</p>}
        <p className="alert-card-where flex items-center gap-1 text-sm text-santan-600 dark:text-santan-300">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{[alert.place, alert.area?.name].filter(Boolean).join(" · ") || "Melaka"}</span>
          {distance ? <span className="shrink-0 font-semibold text-gula-900 dark:text-coconut">· {distance}</span> : null}
        </p>
        <p className="alert-card-time text-xs text-santan-500">
          {alert.type?.name ? `${alert.type.name} · ` : ""}
          {alert.state === "resolved" && alert.resolved_at ? `Resolved ${formatDateTime(alert.resolved_at)}` : `Published ${formatDateTime(alert.published_at)}`}
        </p>
      </div>
    </article>
  );
}

/** The 999 reminder shown on the report pages. */
export function EmergencyBanner({ className }: { className?: string }) {
  return (
    <p className={`emergency-banner flex items-start gap-3 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white ${className ?? ""}`} role="note">
      <Siren className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        In an emergency, call <a href="tel:999" className="font-black underline underline-offset-2">999</a> first. Reports here are checked by our team and are not seen by the police or fire brigade straight away.
      </span>
    </p>
  );
}
