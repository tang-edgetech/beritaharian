"use client";

import { errorMessage, Field, fieldErrors, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { readerApi, rememberReturn, useReader } from "@/lib/auth";
import { insideMelaka, myReportHref } from "@/lib/alert-links";
import type { ReportLimits } from "@/lib/alerts";
import type { IncidentType, MyReportDetail } from "@cendol/api-client";
import { MapView, type MapPoint } from "@cendol/map";
import { ArrowLeft, Camera, EyeOff, Loader2, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { toneFor } from "../news/category-tone";
import { CheckField, TextAreaField } from "../places/form-bits";
import { setFlash } from "../site/flash-message";
import { EmergencyBanner, IncidentIcon } from "./alert-bits";
import { EvidencePicker, filesError } from "./evidence-picker";

const noop = () => () => {};

/** "2026-11-26T14:05" in the reader's own clock, for <input type="datetime-local">. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** /report: signed-out readers see what it's for; signed-in readers get the map-first form. */
export function ReportPageBody({ types, limits }: { types: IncidentType[]; limits: ReportLimits }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reader = useReader();

  return (
    <div className="report-page site-container flex max-w-3xl flex-col gap-5 py-6">
      <Link href="/alerts" className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        Alerts in Melaka
      </Link>
      <header className="report-header flex flex-col gap-1.5">
        <h1 className="page-heading">Report something</h1>
        <p className="page-lead">Floods, road damage, fires, blocked drains: tell us what you saw and where. Our team checks every report before anything is shown to the public.</p>
      </header>
      <EmergencyBanner />
      {!hydrated ? <div className="h-96 animate-pulse rounded-card bg-santan-100 dark:bg-santan-900" aria-busy /> : reader ? <ReportForm types={types} limits={limits} /> : <SignedOut />}
    </div>
  );
}

function SignedOut() {
  const router = useRouter();
  return (
    <section className="report-signed-out flex flex-col gap-5 rounded-card border border-santan-200 bg-white p-5 sm:p-7 dark:border-santan-800 dark:bg-santan-900" aria-labelledby="report-signed-out-title">
      <h2 id="report-signed-out-title" className="font-display text-xl font-black text-gula-900 dark:text-coconut">
        How it works
      </h2>
      <ul className="report-steps flex flex-col gap-3 text-sm">
        <Step icon={<MapPin className="size-5" aria-hidden />} title="Drop a pin">
          Tap the map where it happened, or use your phone&apos;s location.
        </Step>
        <Step icon={<Camera className="size-5" aria-hidden />} title="Add photos and details">
          Photos, short videos, voice notes or a PDF help our team check faster.
        </Step>
        <Step icon={<ShieldCheck className="size-5" aria-hidden />} title="We check it">
          A verifier looks at every report. If it checks out, we post an alert in our own words, with blurred photos.
        </Step>
        <Step icon={<EyeOff className="size-5" aria-hidden />} title="Your name, your choice">
          You can hide your name from the public. Your own words, files and contact details are never shown.
        </Step>
      </ul>
      <p className="text-sm text-santan-600 dark:text-santan-300">You need to sign in so we can tell you what happens with your report.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            rememberReturn("/report");
            router.push("/login");
          }}
          className="report-sign-in inline-flex h-11 items-center rounded-full bg-gula-900 px-5 font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900"
        >
          Sign in to report
        </button>
        <button
          type="button"
          onClick={() => {
            rememberReturn("/report");
            router.push("/register");
          }}
          className="report-register inline-flex h-11 items-center rounded-full border border-santan-300 px-5 font-semibold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800"
        >
          Create an account
        </button>
      </div>
    </section>
  );
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="report-step flex gap-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-marigold-100 text-gula-900 dark:bg-gula-800 dark:text-marigold-200">{icon}</span>
      <span className="flex flex-col">
        <span className="font-bold text-gula-900 dark:text-coconut">{title}</span>
        <span className="text-santan-600 dark:text-santan-300">{children}</span>
      </span>
    </li>
  );
}

function ReportForm({ types, limits }: { types: IncidentType[]; limits: ReportLimits }) {
  const router = useRouter();
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [focus, setFocus] = useState<(MapPoint & { zoom?: number }) | null>(null);
  const [locating, setLocating] = useState(false);
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [{ now, monthAgo }] = useState(() => {
    const d = new Date();
    return { now: localInput(d), monthAgo: localInput(new Date(d.getTime() - 30 * 86400000)) };
  });
  const [occurred, setOccurred] = useState(now);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function placePin(p: MapPoint) {
    setPoint(p);
    setErrors((e) => ({ ...e, latitude: insideMelaka(p.latitude, p.longitude) ? "" : "Please drop the pin inside Melaka." }));
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setErrors((e) => ({ ...e, latitude: "This browser can't share your location. Tap the map where it happened instead." }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { latitude: Math.round(pos.coords.latitude * 1e6) / 1e6, longitude: Math.round(pos.coords.longitude * 1e6) / 1e6 };
        placePin(p);
        setFocus({ ...p, zoom: 17 });
      },
      () => {
        setLocating(false);
        setErrors((e) => ({ ...e, latitude: "We couldn't get your location. Check that location is allowed for this site, or tap the map instead." }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!point) local.latitude = "Please tap the map where it happened, or use your location.";
    else if (!insideMelaka(point.latitude, point.longitude)) local.latitude = "Please drop the pin inside Melaka.";
    if (!type) local.type = "Please choose what kind of thing happened.";
    const when = occurred ? new Date(occurred) : null;
    if (!when || Number.isNaN(when.getTime())) local.occurred_at = "Please say when it happened.";
    else if (when.getTime() > Date.now() + 5 * 60000) local.occurred_at = "The time can't be in the future.";
    else if (when.getTime() < Date.now() - 30 * 86400000) local.occurred_at = "We can only take reports of things from the last 30 days.";
    if (title.trim().length < 5) local.title = "Please give a short title (at least 5 characters).";
    if (description.trim().length < 20) local.description = "Please describe what happened in a little more detail (at least 20 characters).";
    if (!consent) local.consent = "Please confirm you have read how we use your report.";
    setErrors(local);
    if (Object.keys(local).length || !point || !when) {
      setMessage("Please check the highlighted parts of the form.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const fields: Record<string, string | number | boolean | Blob | null> = {
      type,
      latitude: point.latitude.toFixed(6),
      longitude: point.longitude.toFixed(6),
      address: address.trim() || null,
      occurred_at: when.toISOString(),
      title: title.trim(),
      description: description.trim(),
      is_anonymous: anonymous,
      consent: true,
    };
    files.forEach((f, i) => (fields[`files[${i}]`] = f));

    try {
      const result = await readerApi.upload<{ message: string; data: MyReportDetail }>("me/reports", fields);
      setFlash(result.message);
      router.push(myReportHref(result.data.ref));
    } catch (error) {
      const found = fieldErrors(error);
      setErrors({ ...found, latitude: found.latitude ?? found.longitude ?? "" });
      setMessage(errorMessage(error));
      setBusy(false);
    }
  }

  const pinError = errors.latitude;

  return (
    <form className="report-form flex flex-col gap-6" onSubmit={submit} noValidate>
      {message ? <FormMessage>{message}</FormMessage> : null}

      <section className="report-where flex flex-col gap-2" aria-labelledby="report-where-title">
        <h2 id="report-where-title" className="font-display text-xl font-black text-gula-900 dark:text-coconut">
          1. Where did it happen?
        </h2>
        <p className="text-sm text-santan-600 dark:text-santan-300">Tap the map to drop a pin, then drag it to the exact spot.</p>
        <div className="report-map-holder relative -mx-4 sm:mx-0">
          <MapView
            label="Map for choosing where it happened"
            picker={{ value: point, onChange: placePin }}
            focus={focus}
            className={`report-map h-[50dvh] min-h-72 sm:h-96 sm:rounded-card sm:border ${pinError ? "has-error sm:border-red-500" : "sm:border-santan-200 dark:sm:border-santan-800"}`}
          />
          <button
            type="button"
            onClick={locateMe}
            title="Put the pin where I am now"
            className="report-locate absolute top-3 right-3 z-[500] inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-gula-900 shadow-md hover:bg-santan-100 dark:bg-santan-900 dark:text-coconut"
          >
            {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            Use my location
          </button>
        </div>
        {pinError ? (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {pinError}
          </p>
        ) : point ? (
          <p className="text-xs text-santan-500">Pin placed. Drag it if it isn&apos;t quite right.</p>
        ) : null}
        <Field id="report-address" label="Near… (optional)" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="e.g. opposite the Jonker Walk night market entrance" error={errors.address} />
      </section>

      <fieldset className="report-type flex flex-col gap-2" aria-describedby={errors.type ? "report-type-error" : undefined}>
        <legend className="mb-2 font-display text-xl font-black text-gula-900 dark:text-coconut">2. What kind of thing?</legend>
        <div className="report-type-grid grid gap-2 sm:grid-cols-2">
          {types.map((t) => {
            const checked = type === t.slug;
            return (
              <label
                key={t.slug}
                className={`report-type-option flex cursor-pointer gap-3 rounded-xl border p-3 focus-within:ring-2 focus-within:ring-pandan-400 ${checked ? "is-checked border-pandan-600 bg-pandan-50 dark:bg-pandan-950" : "border-santan-300 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-900"}`}
              >
                <input type="radio" name="report-type" value={t.slug} checked={checked} onChange={() => setType(t.slug)} className="sr-only" />
                <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${toneFor(t.color).chip}`}>
                  <IncidentIcon icon={t.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold text-gula-900 dark:text-coconut">{t.name}</span>
                  {t.description ? <span className="text-sm text-santan-600 dark:text-santan-300">{t.description}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
        {errors.type ? (
          <p id="report-type-error" className="text-sm text-red-700 dark:text-red-400" role="alert">
            {errors.type}
          </p>
        ) : null}
      </fieldset>

      <section className="report-details flex flex-col gap-4" aria-labelledby="report-details-title">
        <h2 id="report-details-title" className="font-display text-xl font-black text-gula-900 dark:text-coconut">
          3. What happened?
        </h2>
        <Field id="report-occurred" label="When did it happen?" type="datetime-local" value={occurred} min={monthAgo} max={now} onChange={(e) => setOccurred(e.target.value)} error={errors.occurred_at} hint="Leave as it is if it's happening now." />
        <Field id="report-title" label="Short title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Road flooded outside the school" error={errors.title} />
        <TextAreaField
          id="report-description"
          label="What did you see?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={6}
          error={errors.description}
          hint={`${description.trim().length} of at least 20 characters. Say what you saw, how bad it is, and whether it's still happening.`}
        />
        <EvidencePicker label="Photos, videos, voice notes or PDF (optional)" files={files} onChange={setFiles} maxFiles={limits.maxFiles} maxFileMb={limits.maxFileMb} error={filesError(errors)} />
      </section>

      <section className="report-privacy flex flex-col gap-4" aria-labelledby="report-privacy-title">
        <h2 id="report-privacy-title" className="font-display text-xl font-black text-gula-900 dark:text-coconut">
          4. Your privacy
        </h2>
        <CheckField
          id="report-anonymous"
          label="Hide my name from the public"
          checked={anonymous}
          onChange={setAnonymous}
          hint="If we post an alert, the public sees “A Cendol Satay reader” instead of your name. Our verifiers still see your name so they can contact you."
        />
        <div className="report-consent-notice flex flex-col gap-2 rounded-xl bg-santan-100 p-4 text-sm text-santan-700 dark:bg-santan-950 dark:text-santan-200">
          <p className="font-bold text-gula-900 dark:text-coconut">How we use your report</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>We keep what you send: the pin, the time, your words and files, and your account details.</li>
            <li>Our verifiers check it. If it checks out, we post an alert in our own words with blurred photos. Your words, files and contact details are never shown to the public.</li>
            <li>We may share your report with the police or other authorities when it is needed and lawful.</li>
            <li>If a report is rejected or you withdraw it, its files are deleted after {limits.purgeDays} days.</li>
          </ul>
          <p>
            Read our full{" "}
            <Link href="/privacy" className="font-semibold text-pandan-700 underline underline-offset-4 dark:text-pandan-300">
              privacy notice
            </Link>
            .
          </p>
        </div>
        <CheckField id="report-consent" label="I have read how my report is used and agree to it." checked={consent} onChange={setConsent} error={errors.consent} />
      </section>

      <SubmitButton busy={busy}>{busy ? "Sending…" : "Send report"}</SubmitButton>
    </form>
  );
}
