import { AlertStateBadge, IncidentTypeChip, SeverityBadge } from "@/components/civic/alert-bits";
import { MediaImage } from "@/components/news/media-image";
import { ShareButtons } from "@/components/news/share-buttons";
import { alertHref } from "@/lib/alert-links";
import { getAlert } from "@/lib/alerts";
import { formatDateTime } from "@/lib/format";
import { directionsUrl } from "@/lib/place-links";
import type { RouteParams } from "@/types/routes";
import { MapView } from "@cendol/map";
import { ArrowLeft, CheckCircle2, Clock, MapPin, Navigation, Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = { params: RouteParams<"ref"> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params;
  const alert = await getAlert(decodeURIComponent(ref));
  if (!alert || alert === "not-found") return { title: "Alert not found", robots: { index: false } };
  const where = [alert.place, alert.area?.name].filter(Boolean).join(", ") || "Melaka";
  const title = `${alert.state === "resolved" ? "Resolved: " : ""}${alert.title}`;
  const description = `${alert.summary} (${where})`.slice(0, 160);
  const image = alert.photos[0]?.large ?? alert.cover?.large;
  return {
    title,
    description,
    alternates: { canonical: alertHref(alert.ref) },
    openGraph: { type: "article", title, description, publishedTime: alert.published_at, images: image ? [{ url: image, alt: alert.photos[0]?.alt ?? alert.title }] : undefined },
  };
}

export default function AlertPage({ params }: Props) {
  return (
    <Suspense fallback={<AlertSkeleton />}>
      <AlertContent params={params} />
    </Suspense>
  );
}

async function AlertContent({ params }: Props) {
  const { ref } = await params;
  const alert = await getAlert(decodeURIComponent(ref));
  if (alert === "not-found") notFound();
  if (!alert) {
    return (
      <div className="site-container py-16">
        <h1 className="page-heading">This alert is taking a moment</h1>
        <p className="page-lead mt-2">We couldn&apos;t load it. Please refresh in a minute.</p>
      </div>
    );
  }

  const resolved = alert.state === "resolved";
  const where = [alert.place, alert.area?.name].filter(Boolean).join(" · ") || "Melaka";

  return (
    <article className={`alert-page site-container flex max-w-4xl flex-col gap-6 py-6 ${resolved ? "is-resolved" : "is-active"}`}>
      <Link href="/alerts" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        All alerts
      </Link>

      <header className="alert-header flex flex-col gap-3">
        <div className="alert-header-badges flex flex-wrap items-center gap-2">
          <AlertStateBadge state={alert.state} />
          <IncidentTypeChip type={alert.type} />
          <SeverityBadge severity={alert.severity} />
        </div>
        <h1 className="page-heading">{alert.title}</h1>
        <p className="alert-where flex items-center gap-1.5 font-semibold text-santan-700 dark:text-santan-200">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {where}
        </p>
        {resolved && alert.resolved_at ? (
          <p className="alert-resolved-note flex items-center gap-2 rounded-xl bg-pandan-50 px-4 py-3 text-sm font-semibold text-pandan-900 dark:bg-pandan-950 dark:text-pandan-100">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            Resolved on {formatDateTime(alert.resolved_at)}. Kept here for the record.
          </p>
        ) : null}
      </header>

      <div className="alert-body grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="alert-main flex min-w-0 flex-col gap-5">
          <p className="alert-summary text-lg leading-relaxed text-santan-900 dark:text-santan-100">{alert.summary}</p>

          {alert.photos.length ? (
            <section className="alert-photos flex flex-col gap-2" aria-label="Photos">
              <h2 className="font-display text-lg font-black text-gula-900 dark:text-coconut">
                Photos
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {alert.photos.map((photo) => (
                  <li key={photo.id} className="alert-photo overflow-hidden rounded-xl bg-santan-100 dark:bg-santan-900">
                    <a href={photo.large ?? photo.card ?? "#"} target="_blank" rel="noopener noreferrer" title="Open the full photo">
                      <MediaImage media={photo} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-square size-full object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-santan-500">Photos are shown blurred to protect the privacy of the people and vehicles in them.</p>
            </section>
          ) : null}

          <dl className="alert-facts grid gap-3 rounded-card border border-santan-200 bg-white p-4 text-sm sm:grid-cols-2 dark:border-santan-800 dark:bg-santan-900">
            <Fact icon={<Clock className="size-4" aria-hidden />} label="Happened">
              {formatDateTime(alert.occurred_at)}
            </Fact>
            <Fact icon={<Clock className="size-4" aria-hidden />} label="Published">
              {formatDateTime(alert.published_at)}
            </Fact>
            {alert.updated_at !== alert.published_at ? (
              <Fact icon={<Clock className="size-4" aria-hidden />} label="Last updated">
                {formatDateTime(alert.updated_at)}
              </Fact>
            ) : null}
            <Fact icon={<UserRound className="size-4" aria-hidden />} label="Reported by">
              {alert.reported_by}
            </Fact>
          </dl>

          <div className="alert-share flex flex-col gap-2">
            <h2 className="text-sm font-bold text-gula-900 dark:text-coconut">Share this alert</h2>
            <ShareButtons title={alert.title} path={alertHref(alert.ref)} />
          </div>
        </div>

        <aside className="alert-side flex flex-col gap-3">
          <MapView
            label={`Map showing where: ${where}`}
            pins={[{ id: alert.ref, latitude: alert.latitude, longitude: alert.longitude, label: alert.title, tone: resolved ? "santan" : (alert.type?.color ?? "satay") }]}
            center={{ latitude: alert.latitude, longitude: alert.longitude }}
            zoom={15}
            selectedId={alert.ref}
            className="alert-map h-64 rounded-card border border-santan-200 lg:h-80 dark:border-santan-800"
          />
          <a
            href={directionsUrl(alert.latitude, alert.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="alert-directions inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-santan-300 px-4 text-sm font-bold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"
          >
            <Navigation className="size-4" aria-hidden />
            Open in maps
          </a>
          <div className="alert-report-similar flex flex-col gap-2 rounded-card bg-marigold-50 p-4 dark:bg-gula-900">
            <p className="text-sm text-gula-900 dark:text-marigold-100">Seeing the same thing, or something new nearby?</p>
            <Link href="/report" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-satay-500 px-4 text-sm font-bold text-white hover:bg-satay-700">
              <Plus className="size-4" aria-hidden />
              Report something similar
            </Link>
          </div>
          <p className="alert-ref text-xs text-santan-500">Reference {alert.ref}</p>
        </aside>
      </div>
    </article>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="alert-fact flex items-start gap-2">
      <span className="mt-0.5 text-santan-500">{icon}</span>
      <div>
        <dt className="text-xs font-semibold text-santan-500">{label}</dt>
        <dd className="font-semibold text-gula-900 dark:text-coconut">{children}</dd>
      </div>
    </div>
  );
}

function AlertSkeleton() {
  return (
    <div className="alert-page site-container flex max-w-4xl flex-col gap-4 py-6" aria-busy>
      <div className="h-6 w-40 animate-pulse rounded-full bg-santan-200 dark:bg-santan-800" />
      <div className="h-12 w-3/4 animate-pulse rounded-xl bg-santan-200 dark:bg-santan-800" />
      <div className="h-64 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" />
    </div>
  );
}
