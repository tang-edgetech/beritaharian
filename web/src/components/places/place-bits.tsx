import type { CategoryColor, PlaceCard as PlaceCardData, SectorRef } from "@cendol/api-client";
import { distanceLabel } from "@cendol/map";
import {
  BedDouble,
  Landmark,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Star,
  Stethoscope,
  Store,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { toneFor } from "../news/category-tone";
import { ImagePlaceholder, MediaImage } from "../news/media-image";
import { placeHref } from "@/lib/place-links";

/* Small pieces shared by place lists, the map card and the place page. Safe on the server and in the browser. */

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "bed-double": BedDouble,
  landmark: Landmark,
  "shopping-bag": ShoppingBag,
  wrench: Wrench,
  stethoscope: Stethoscope,
  store: Store,
};

export function SectorIcon({ icon, className }: { icon: string | undefined; className?: string }) {
  const Icon = ICONS[icon ?? "store"] ?? Store;
  return <Icon className={className} aria-hidden />;
}

/** Five stars, filled to the rating. The number is spoken; the stars are decoration. */
export function Stars({ value, size = "sm", label = true }: { value: number; size?: "sm" | "md" | "lg"; label?: boolean }) {
  const px = size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-4";
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="star-rating inline-flex items-center gap-0.5" role="img" aria-label={label ? `${value.toFixed(1)} out of 5 stars` : undefined} aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="star-rating-star relative inline-flex">
          <Star className={`${px} text-santan-300 dark:text-santan-700`} aria-hidden />
          {rounded >= n - 0.5 ? (
            <span className={`absolute inset-0 overflow-hidden ${rounded >= n ? "w-full" : "w-1/2"}`}>
              <Star className={`${px} fill-marigold-400 text-marigold-500`} aria-hidden />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

export function SectorChip({ sector }: { sector: SectorRef | null }) {
  if (!sector) return null;
  const tone = toneFor(sector.color);
  return (
    <span className={`sector-chip inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold ${tone.chip}`}>
      <SectorIcon icon={sector.icon} className="size-3.5" />
      {sector.name}
    </span>
  );
}

export function OpenNowLine({ open, label }: { open: boolean | null; label: string | null }) {
  if (open === null || !label) return <span className="open-now-line is-unknown text-sm text-santan-500">Hours not given</span>;
  return (
    <span className={`open-now-line text-sm font-semibold ${open ? "is-open text-pandan-700 dark:text-pandan-300" : "is-closed text-satay-700 dark:text-satay-400"}`}>{label}</span>
  );
}

export function VerifiedVisit() {
  return (
    <span className="verified-visit-badge inline-flex items-center gap-1 rounded-full bg-pandan-100 px-2 py-0.5 text-xs font-bold text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100">
      <ShieldCheck className="size-3.5" aria-hidden />
      Verified visit
    </span>
  );
}

/** One place in a list. `selected` is set when its pin is chosen on the map. */
export function PlaceCardItem({ card, selected = false, compact = false }: { card: PlaceCardData; selected?: boolean; compact?: boolean }) {
  const image = card.photo ?? card.logo;
  const distance = distanceLabel(card.distance_m);
  return (
    <article
      id={`place-${card.id}`}
      className={[
        "place-card group relative flex gap-3 rounded-card border bg-white p-3 transition-shadow dark:bg-santan-900",
        selected ? "is-selected border-pandan-500 shadow-md ring-2 ring-pandan-200 dark:ring-pandan-900" : "border-santan-200 hover:shadow-md dark:border-santan-800",
      ].join(" ")}
    >
      <div className={`place-card-image shrink-0 overflow-hidden rounded-xl ${compact ? "size-20" : "size-24 sm:size-28"}`}>
        {image ? <MediaImage media={image} sizes="112px" className="size-full object-cover" /> : <ImagePlaceholder className="size-full" />}
      </div>
      <div className="place-card-body flex min-w-0 flex-1 flex-col gap-1">
        <SectorChip sector={card.sector} />
        <h3 className="place-card-title font-display text-lg leading-snug font-black text-gula-900 dark:text-coconut">
          <Link href={placeHref(card.sector?.slug, card.slug)} className="place-card-link after:absolute after:inset-0 hover:underline">
            {card.name}
          </Link>
        </h3>
        <div className="place-card-rating flex flex-wrap items-center gap-x-2 text-sm">
          {card.rating_count ? (
            <>
              <Stars value={card.rating_avg} />
              <span className="font-bold tabular-nums">{card.rating_avg.toFixed(1)}</span>
              <span className="text-santan-500">({card.rating_count})</span>
            </>
          ) : (
            <span className="text-santan-500">No reviews yet</span>
          )}
        </div>
        <OpenNowLine open={card.open_now} label={card.hours_today} />
        <p className="place-card-where flex items-center gap-1 truncate text-sm text-santan-600 dark:text-santan-300">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{[card.branch_label, card.area?.name ?? card.address].filter(Boolean).join(" · ")}</span>
          {distance ? <span className="shrink-0 font-semibold text-gula-900 dark:text-coconut">· {distance}</span> : null}
        </p>
      </div>
    </article>
  );
}

export const toneOf = (color: CategoryColor | undefined | null): CategoryColor => color ?? "marigold";
