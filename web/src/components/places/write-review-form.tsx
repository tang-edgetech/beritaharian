"use client";

import { errorMessage, Field, fieldErrors, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { readerApi, useRequireReader } from "@/lib/auth";
import { refreshPlaceStatus } from "@/lib/place-status";
import type { PlaceDetail } from "@cendol/api-client";
import { distanceLabel } from "@cendol/map";
import { Camera, Check, Loader2, LocateFixed, Receipt, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { setFlash } from "../site/flash-message";
import { CheckField, FormPage, SelectField, StarPicker, TextAreaField } from "./form-bits";

const SUBS = [
  { key: "service", label: "Service" },
  { key: "value", label: "Value for money" },
  { key: "cleanliness", label: "Cleanliness" },
] as const;

function isoDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(d);
}

export function WriteReviewForm({ place, base }: { place: PlaceDetail; base: string }) {
  const router = useRouter();
  const ready = useRequireReader(`${base}/write-review`);
  const [rating, setRating] = useState(0);
  const [subs, setSubs] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visited, setVisited] = useState(() => isoDate(new Date()));
  const [location, setLocation] = useState(place.locations[0]?.id ?? "");
  const [anonymous, setAnonymous] = useState(false);
  const [proof, setProof] = useState<"checkin" | "receipt">("checkin");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [here, setHere] = useState<{ latitude: number; longitude: number; distance: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  const [{ today, yearAgo }] = useState(() => {
    const now = new Date();
    return { today: isoDate(now), yearAgo: isoDate(new Date(now.getTime() - 365 * 86400000)) };
  });

  function checkIn() {
    if (!("geolocation" in navigator)) {
      setErrors((e) => ({ ...e, latitude: "This browser can't share your location. Please add a receipt photo instead." }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const nearest = Math.min(...place.locations.map((l) => haversine(latitude, longitude, l.latitude, l.longitude)));
        setHere({ latitude, longitude, distance: nearest });
        setErrors((e) => ({ ...e, latitude: "" }));
      },
      () => {
        setLocating(false);
        setErrors((e) => ({ ...e, latitude: "We couldn't get your location. Allow location for this site, or add a receipt photo instead." }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!rating) local.rating = "Please choose how many stars.";
    if (body.trim().length < 30) local.body = "Please write a little more (at least 30 characters) so others know what it was like.";
    if (proof === "checkin" && !here) local.latitude = "Tap “Check me in” while you're at the place.";
    if (proof === "receipt" && !receipt) local.receipt = "Please add a photo of your receipt.";
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    setMessage(null);
    const fields: Record<string, string | number | boolean | Blob | null> = {
      rating,
      title: title.trim() || null,
      body: body.trim(),
      visited_on: visited,
      is_anonymous: anonymous,
      location: place.locations.length > 1 ? location : null,
      proof,
    };
    for (const [key, value] of Object.entries(subs)) if (value) fields[`sub_ratings[${key}]`] = value;
    if (proof === "checkin" && here) {
      fields.latitude = here.latitude.toFixed(6);
      fields.longitude = here.longitude.toFixed(6);
    }
    if (proof === "receipt" && receipt) fields.receipt = receipt;
    photos.forEach((p, i) => (fields[`photos[${i}]`] = p));

    try {
      const result = await readerApi.upload<{ message: string }>(`me/places/${encodeURIComponent(place.slug)}/reviews`, fields);
      refreshPlaceStatus(place.slug);
      setFlash(result.message);
      router.push(`${base}#reviews`);
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
      setBusy(false);
    }
  }

  if (!ready) return <div className="site-container h-96 animate-pulse py-6" aria-busy />;

  return (
    <FormPage back={base} backLabel={`Back to ${place.name}`} title={`Review ${place.name}`} lead="Say how your visit went. Reviews need proof that you were there, so everyone can trust them.">
      <form className="write-review-form flex flex-col gap-6" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <StarPicker name="rating" label="Your rating" value={rating} onChange={setRating} error={errors.rating} />
        <div className="grid gap-4 sm:grid-cols-3">
          {SUBS.map((s) => (
            <StarPicker key={s.key} name={`sub-${s.key}`} label={`${s.label} (optional)`} value={subs[s.key] ?? 0} onChange={(n) => setSubs((v) => ({ ...v, [s.key]: n }))} small />
          ))}
        </div>
        <Field id="review-title" label="Headline (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Best cendol in Klebang" error={errors.title} />
        <TextAreaField
          id="review-body"
          label="Your review"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={3000}
          rows={6}
          error={errors.body}
          hint={`${body.trim().length} of at least 30 characters. Please don't include phone numbers or links.`}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="review-visited" label="When did you go?" type="date" value={visited} min={yearAgo} max={today} onChange={(e) => setVisited(e.target.value)} error={errors.visited_on} />
          {place.locations.length > 1 ? (
            <SelectField id="review-branch" label="Which branch?" value={location} onChange={(e) => setLocation(e.target.value)}>
              {place.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label ?? l.address}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>

        <fieldset className="review-proof flex flex-col gap-3">
          <legend className="mb-1 font-semibold text-gula-900 dark:text-coconut">Proof of your visit</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <ProofOption checked={proof === "checkin"} onSelect={() => setProof("checkin")} icon={<LocateFixed className="size-5" aria-hidden />} title="Check in here" text="Use your phone's location while you're at the place. Your review goes up straight away." />
            <ProofOption checked={proof === "receipt"} onSelect={() => setProof("receipt")} icon={<Receipt className="size-5" aria-hidden />} title="Receipt photo" text="Private: only our moderators see it, and it is deleted 90 days after the check." />
          </div>
          {proof === "checkin" ? (
            <div className="flex flex-col gap-2 rounded-xl bg-santan-100 p-4 dark:bg-santan-950">
              <button type="button" onClick={checkIn} className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-pandan-700 px-4 text-sm font-bold text-white hover:bg-pandan-800">
                {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
                {here ? "Check me in again" : "Check me in"}
              </button>
              {here ? (
                <p className={`text-sm font-semibold ${here.distance <= 150 ? "text-pandan-700 dark:text-pandan-300" : "text-satay-700 dark:text-satay-400"}`}>
                  {here.distance <= 150 ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-4" aria-hidden /> You&apos;re here ({distanceLabel(here.distance)}).
                    </span>
                  ) : (
                    `You seem to be ${distanceLabel(here.distance)}. Check-in only works at the place, so add a receipt photo instead.`
                  )}
                </p>
              ) : (
                <p className="text-sm text-santan-600 dark:text-santan-300">Only works within about 150 m of the place. We keep the location for the check, never show it.</p>
              )}
              {errors.latitude ? (
                <p className="text-sm text-red-700 dark:text-red-400" role="alert">
                  {errors.latitude}
                </p>
              ) : null}
            </div>
          ) : (
            <FilePick id="review-receipt" label="Receipt photo or PDF" accept="image/*,application/pdf" files={receipt ? [receipt] : []} onChange={(f) => setReceipt(f[0] ?? null)} error={errors.receipt} />
          )}
        </fieldset>

        <FilePick id="review-photos" label="Photos of the place (optional, up to 4)" accept="image/*" multiple files={photos} onChange={(f) => setPhotos(f.slice(0, 4))} error={errors.photos ?? errors["photos.0"]} />

        <CheckField id="review-anonymous" label="Hide my name. Show “A Cendol Satay reader” instead." checked={anonymous} onChange={setAnonymous} />
        <SubmitButton busy={busy}>Post review</SubmitButton>
      </form>
    </FormPage>
  );
}

function ProofOption({ checked, onSelect, icon, title, text }: { checked: boolean; onSelect: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <label className={`proof-option flex cursor-pointer gap-3 rounded-xl border p-4 ${checked ? "is-checked border-pandan-600 bg-pandan-50 dark:bg-pandan-950" : "border-santan-300 dark:border-santan-700"}`}>
      <input type="radio" name="proof" checked={checked} onChange={onSelect} className="mt-1 size-4 accent-pandan-600" />
      <span className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 font-bold">
          {icon}
          {title}
        </span>
        <span className="text-sm text-santan-600 dark:text-santan-300">{text}</span>
      </span>
    </label>
  );
}

/** A file chooser that lists what was picked, with a remove button per file. */
export function FilePick({ id, label, accept, multiple = false, files, onChange, error, hint }: { id: string; label: string; accept: string; multiple?: boolean; files: File[]; onChange: (files: File[]) => void; error?: string; hint?: string }) {
  return (
    <div className="file-pick flex flex-col gap-2">
      <span className="text-sm font-semibold text-gula-900 dark:text-coconut">{label}</span>
      <label className="file-pick-button inline-flex h-10 cursor-pointer items-center gap-2 self-start rounded-full border border-santan-300 px-4 text-sm font-bold focus-within:ring-2 focus-within:ring-pandan-400 hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
        <Camera className="size-4" aria-hidden />
        {files.length ? "Choose again" : "Choose file"}
        <span className="sr-only">: {label}</span>
        <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange(multiple ? [...files, ...picked] : picked);
          e.target.value = "";
        }}
        />
      </label>
      {files.length ? (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-santan-100 dark:hover:bg-santan-800" aria-label={`Remove ${f.name}`} title="Remove">
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-santan-500">{hint}</p>
      ) : null}
    </div>
  );
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
