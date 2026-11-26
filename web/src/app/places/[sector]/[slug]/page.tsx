import { toneFor } from "@/components/news/category-tone";
import { ImagePlaceholder, MediaImage } from "@/components/news/media-image";
import { OpenNowLine, SectorChip, Stars } from "@/components/places/place-bits";
import { PlaceActions } from "@/components/places/place-actions";
import { ReviewItem } from "@/components/places/review-item";
import { FlashMessage } from "@/components/site/flash-message";
import { directionsUrl, osmUrl, placeHref, ratingText, telUrl, webUrl, whatsappUrl } from "@/lib/place-links";
import { getPlace } from "@/lib/places";
import type { RouteParams } from "@/types/routes";
import type { CategoryColor, PlaceDetail, PlaceLocation } from "@cendol/api-client";
import { MapView } from "@cendol/map";
import { ArrowLeft, AtSign, Clock, Globe, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = { params: RouteParams<"sector" | "slug"> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place || place === "not-found") return { title: "Place not found" };
  const where = place.locations[0]?.area?.name ?? "Melaka";
  const description = (place.description ?? `${place.sector?.name ?? "Place"} in ${where}.`).slice(0, 160);
  return {
    title: `${place.name}, ${where}`,
    description,
    alternates: { canonical: placeHref(place.sector?.slug, place.slug) },
    openGraph: { type: "website", title: place.name, description, images: place.photos[0]?.large ? [{ url: place.photos[0].large, alt: place.photos[0].alt }] : undefined },
  };
}

export default function PlacePage({ params }: Props) {
  return (
    <Suspense fallback={<PlaceSkeleton />}>
      <PlaceContent params={params} />
    </Suspense>
  );
}

async function PlaceContent({ params }: Props) {
  const { sector, slug } = await params;
  const place = await getPlace(slug);
  if (place === "not-found") notFound();
  if (!place) {
    return (
      <div className="site-container py-16">
        <h1 className="page-heading">This place is taking a moment</h1>
        <p className="page-lead mt-2">We couldn&apos;t load it. Please refresh in a minute.</p>
      </div>
    );
  }
  // the place moved to another sector: send readers (and search engines) to the right address
  if (place.sector && place.sector.slug !== sector) permanentRedirect(placeHref(place.sector.slug, place.slug));

  const base = placeHref(place.sector?.slug, place.slug);
  const tone = toneFor(place.sector?.color);
  const primary = place.locations[0];
  const structured = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: place.name,
    description: place.description ?? undefined,
    image: place.photos.map((p) => p.large).filter(Boolean),
    telephone: place.contacts.phone ?? primary?.phone ?? undefined,
    url: place.contacts.website ? webUrl(place.contacts.website) : undefined,
    address: primary ? { "@type": "PostalAddress", streetAddress: primary.address, postalCode: primary.postcode ?? undefined, addressLocality: primary.area?.name, addressRegion: "Melaka", addressCountry: "MY" } : undefined,
    geo: primary ? { "@type": "GeoCoordinates", latitude: primary.latitude, longitude: primary.longitude } : undefined,
    aggregateRating: place.rating_count ? { "@type": "AggregateRating", ratingValue: place.rating_avg, reviewCount: place.rating_count, bestRating: 5, worstRating: 1 } : undefined,
  };

  return (
    <article className="place-page flex flex-col gap-8 pt-4 pb-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />

      <div className="site-container flex flex-col gap-4">
        <Link href={place.sector ? `/places/${place.sector.slug}` : "/places"} className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
          <ArrowLeft className="size-4" aria-hidden />
          {place.sector ? `All ${place.sector.name.toLowerCase()}` : "All places"}
        </Link>
        <FlashMessage />
        <PhotoStrip place={place} />
      </div>

      <div className="site-container grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="place-main flex min-w-0 flex-col gap-8">
          <header className="place-header flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {place.logo ? <MediaImage media={place.logo} sizes="64px" className="size-14 shrink-0 rounded-xl border border-santan-200 object-cover dark:border-santan-800" /> : null}
              <SectorChip sector={place.sector} />
            </div>
            <h1 className="place-title font-display text-3xl leading-tight font-black text-balance text-gula-900 sm:text-4xl dark:text-coconut">{place.name}</h1>
            <a href="#reviews" className="place-rating-line inline-flex flex-wrap items-center gap-2 self-start hover:underline">
              {place.rating_count ? <Stars value={place.rating_avg} size="md" /> : null}
              <span className="font-bold">{ratingText(place.rating_avg, place.rating_count)}</span>
            </a>
            {primary ? <OpenNowLine open={primary.open_now} label={primary.hours_today} /> : null}
            {place.description ? <p className="place-description text-lg whitespace-pre-line text-santan-700 dark:text-santan-200">{place.description}</p> : null}
          </header>

          {place.details.length ? (
            <section className="place-details flex flex-col gap-3" aria-labelledby="details-title">
              <h2 id="details-title" className={`border-b-2 border-gula-900 pb-1 font-display text-xl font-black dark:border-santan-200`}>
                Good to know
              </h2>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {place.details.map((d) => (
                  <div key={d.key} className="place-detail flex justify-between gap-3 border-b border-dotted border-santan-300 py-1.5 dark:border-santan-700">
                    <dt className="text-santan-600 dark:text-santan-300">{d.label}</dt>
                    <dd className="text-right font-semibold">{d.display}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="place-branches flex flex-col gap-4" aria-labelledby="branches-title">
            <h2 id="branches-title" className="border-b-2 border-gula-900 pb-1 font-display text-xl font-black dark:border-santan-200">
              {place.locations.length > 1 ? `${place.locations.length} branches` : "Where & when"}
            </h2>
            {place.locations.map((location) => (
              <Branch key={location.id} location={location} name={place.name} tone={place.sector?.color} />
            ))}
          </section>

          <section id="reviews" className="place-reviews flex scroll-mt-20 flex-col gap-2" aria-labelledby="reviews-title">
            <div className="flex items-end justify-between gap-3 border-b-2 border-gula-900 pb-1 dark:border-santan-200">
              <h2 id="reviews-title" className="font-display text-xl font-black">
                Reviews
              </h2>
              {place.rating_count > place.reviews.length ? (
                <Link href={`${base}/reviews`} className={`text-sm font-bold ${tone.text} hover:underline`}>
                  All {place.rating_count} reviews
                </Link>
              ) : null}
            </div>
            {place.rating_count ? <RatingSummary place={place} /> : null}
            {place.reviews.length ? (
              <div className="place-review-list flex flex-col">
                {place.reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} slug={place.slug} />
                ))}
              </div>
            ) : (
              <p className="rounded-card bg-santan-100 p-5 text-santan-600 dark:bg-santan-900 dark:text-santan-300">No reviews yet. Been here? Be the first to say how it was.</p>
            )}
            <p className="text-xs text-santan-500">Every review here comes with proof of a visit: a receipt checked by our team or a check-in at the place.</p>
          </section>
        </div>

        <aside className="place-side flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
          <PlaceActions slug={place.slug} placeId={place.id} base={base} isClaimed={place.is_claimed} />
          <Contacts place={place} />
        </aside>
      </div>
    </article>
  );
}

function PhotoStrip({ place }: { place: PlaceDetail }) {
  const [first, ...rest] = place.photos;
  if (!first) {
    return <ImagePlaceholder className="place-photo-placeholder h-36 w-full rounded-card sm:h-48" />;
  }
  return (
    <div className="place-photos grid gap-2 sm:grid-cols-[2fr_1fr]">
      <MediaImage media={first} sizes="(min-width: 640px) 66vw, 100vw" priority className="aspect-[16/10] w-full rounded-card object-cover sm:aspect-auto sm:h-80" />
      {rest.length ? (
        <ul className="place-photos-more flex gap-2 overflow-x-auto sm:grid sm:grid-cols-2 sm:overflow-visible">
          {rest.slice(0, 4).map((p) => (
            <li key={p.id} className="shrink-0">
              <a href={p.large ?? p.card ?? "#"} target="_blank" rel="noreferrer" title="Open the full photo" className="block">
                <MediaImage media={p} sizes="(min-width: 640px) 16vw, 40vw" className="h-28 w-40 rounded-xl object-cover sm:h-[9.75rem] sm:w-full" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Branch({ location, name, tone }: { location: PlaceLocation; name: string; tone?: CategoryColor }) {
  const openDays = location.week.filter((d) => d.periods.length);
  return (
    <div className="place-branch grid gap-4 rounded-card border border-santan-200 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] dark:border-santan-800">
      <div className="flex min-w-0 flex-col gap-3">
        {location.label ? <h3 className="font-display text-lg font-extrabold">{location.label}</h3> : null}
        <p className="flex gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-santan-500" aria-hidden />
          <span>
            {location.address}
            {location.postcode ? `, ${location.postcode}` : ""}
            {location.area ? (
              <>
                {" · "}
                <Link href={`/places?area=${location.area.slug}`} className="font-semibold text-pandan-700 hover:underline dark:text-pandan-300">
                  {location.area.name}
                </Link>
              </>
            ) : null}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={directionsUrl(location.latitude, location.longitude)} target="_blank" rel="noreferrer" className="branch-directions inline-flex h-9 items-center gap-1.5 rounded-full bg-pandan-700 px-4 text-sm font-bold text-white hover:bg-pandan-800">
            <Navigation className="size-4" aria-hidden />
            Directions
          </a>
          <a href={osmUrl(location.latitude, location.longitude)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-santan-300 px-3 text-sm font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
            Bigger map
          </a>
          {location.phone ? (
            <a href={telUrl(location.phone)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-santan-300 px-3 text-sm font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              <Phone className="size-4" aria-hidden />
              {location.phone}
            </a>
          ) : null}
        </div>
        <div className="branch-hours flex flex-col gap-2">
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-santan-500" aria-hidden />
            <OpenNowLine open={location.open_now} label={location.hours_today} />
          </p>
          {openDays.length ? (
            <table className="branch-week w-full max-w-sm text-sm">
              <caption className="sr-only">Opening hours</caption>
              <tbody>
                {location.week.map((day) => (
                  <tr key={day.day} className="border-b border-dotted border-santan-200 last:border-b-0 dark:border-santan-800">
                    <th scope="row" className="py-1 pr-4 text-left font-semibold">
                      {day.name}
                    </th>
                    <td className="py-1 text-right tabular-nums">{day.periods.length ? day.periods.map((p) => p.label).join(", ") : <span className="text-santan-500">Closed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {location.hours_note ? <p className="text-sm text-santan-600 dark:text-santan-300">{location.hours_note}</p> : null}
        </div>
      </div>
      <MapView
        label={`Map showing ${name}${location.label ? `, ${location.label}` : ""}`}
        pins={[{ id: location.id, latitude: location.latitude, longitude: location.longitude, label: name, tone: tone ?? "marigold" }]}
        center={{ latitude: location.latitude, longitude: location.longitude }}
        zoom={16}
        selectedId={location.id}
        className="branch-map h-56 rounded-xl sm:h-full sm:min-h-56"
      />
    </div>
  );
}

function RatingSummary({ place }: { place: PlaceDetail }) {
  const total = place.rating_count || 1;
  const subs = (Object.entries(place.sub_ratings) as [string, number | null][]).filter(([, v]) => v !== null);
  const labels: Record<string, string> = { service: "Service", value: "Value for money", cleanliness: "Cleanliness" };
  return (
    <div className="rating-summary grid gap-6 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <div className="flex flex-col items-start gap-1">
        <span className="font-display text-5xl font-black tabular-nums">{place.rating_avg.toFixed(1)}</span>
        <Stars value={place.rating_avg} size="md" />
        <span className="text-sm text-santan-500">{place.rating_count} {place.rating_count === 1 ? "review" : "reviews"}</span>
      </div>
      <ul className="rating-bars flex flex-col gap-1">
        {(["5", "4", "3", "2", "1"] as const).map((n) => (
          <li key={n} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm">
            <Link href={`${placeHref(place.sector?.slug, place.slug)}/reviews?rating=${n}`} className="font-semibold hover:underline" title={`Show ${n}-star reviews`}>
              {n}★
            </Link>
            <meter className="rating-bar h-2.5 w-full" min={0} max={total} value={place.rating_breakdown[n]} aria-label={`${place.rating_breakdown[n]} ${n}-star reviews`} />
            <span className="text-right text-santan-500 tabular-nums">{place.rating_breakdown[n]}</span>
          </li>
        ))}
      </ul>
      {subs.length ? (
        <dl className="sub-ratings flex flex-col gap-1 text-sm">
          {subs.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-santan-600 dark:text-santan-300">{labels[key] ?? key}</dt>
              <dd className="font-bold tabular-nums">{value?.toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function Contacts({ place }: { place: PlaceDetail }) {
  const c = place.contacts;
  const items: { key: string; href: string; label: string; icon: ReactNode; primary?: boolean }[] = [];
  if (c.whatsapp) items.push({ key: "whatsapp", href: whatsappUrl(c.whatsapp), label: "WhatsApp", icon: <MessageCircle className="size-4" aria-hidden />, primary: true });
  if (c.phone) items.push({ key: "phone", href: telUrl(c.phone), label: `Call ${c.phone}`, icon: <Phone className="size-4" aria-hidden /> });
  if (c.website) items.push({ key: "website", href: webUrl(c.website), label: "Website", icon: <Globe className="size-4" aria-hidden /> });
  if (c.email) items.push({ key: "email", href: `mailto:${c.email}`, label: c.email, icon: <AtSign className="size-4" aria-hidden /> });
  for (const social of ["facebook", "instagram", "tiktok"] as const) {
    const value = c[social];
    if (value) items.push({ key: social, href: webUrl(value.includes(".") ? value : `${social}.com/${value.replace(/^@/, "")}`), label: social[0].toUpperCase() + social.slice(1), icon: <Globe className="size-4" aria-hidden /> });
  }
  if (!items.length) return null;
  return (
    <section className="place-contacts flex flex-col gap-3 rounded-card border border-santan-200 p-4 dark:border-santan-800" aria-labelledby="contacts-title">
      <h2 id="contacts-title" className="font-display text-lg font-black">
        Get in touch
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              className={[
                "place-contact inline-flex h-10 w-full items-center gap-2 rounded-full px-4 text-sm font-bold",
                item.primary ? "bg-[#1f9d55] text-white hover:bg-[#188046]" : "border border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800",
              ].join(" ")}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlaceSkeleton() {
  return (
    <div className="place-page site-container flex flex-col gap-6 pt-6" aria-busy>
      <div className="h-64 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
      <div className="h-10 w-2/3 animate-pulse rounded-xl bg-santan-200 dark:bg-santan-800" />
      <div className="h-40 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
    </div>
  );
}
