"use client";

import { errorMessage, Field, fieldErrors, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { readerApi, useRequireReader } from "@/lib/auth";
import type { AreaGroup, Sector } from "@cendol/api-client";
import { MapView, type MapPoint } from "@cendol/map";
import { Loader2, LocateFixed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { setFlash } from "../site/flash-message";
import { CheckField, FormPage, SelectField, TextAreaField } from "./form-bits";

export function SuggestForm({ sectors, areas }: { sectors: Sector[]; areas: AreaGroup[] }) {
  const router = useRouter();
  const ready = useRequireReader("/places/add");
  const [sector, setSector] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [focus, setFocus] = useState<MapPoint | null>(null);
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  function locateMe() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { latitude: Math.round(pos.coords.latitude * 1e6) / 1e6, longitude: Math.round(pos.coords.longitude * 1e6) / 1e6 };
        setPoint(p);
        setFocus(p);
      },
      () => {
        setLocating(false);
        setErrors((e) => ({ ...e, latitude: "We couldn't get your location. Tap the map where the place is instead." }));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!sector) local.sector = "Please choose what kind of place it is.";
    if (!name.trim()) local.name = "Please give the place's name.";
    if (!address.trim()) local.address = "Please give the address.";
    if (!point) local.latitude = "Please tap the map where the place is.";
    setErrors(local);
    if (Object.keys(local).length || !point) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await readerApi.post<{ message: string }>("me/places", {
        sector,
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        area: area || null,
        latitude: point.latitude,
        longitude: point.longitude,
        phone: phone.trim() || null,
        website: website.trim() || null,
        is_owner: isOwner,
        note: note.trim() || null,
      });
      setFlash(result.message);
      router.push(isOwner ? "/business" : "/places");
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
      setBusy(false);
    }
  }

  if (!ready) return <div className="site-container h-96 animate-pulse py-6" aria-busy />;

  return (
    <FormPage back="/places" backLabel="All places" title="Add a place to the map" lead="Know a good stall, shop or service that isn't listed? Tell us. A moderator checks every new place before it shows.">
      <form className="suggest-form flex flex-col gap-5" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <SelectField id="suggest-sector" label="What kind of place?" value={sector} onChange={(e) => setSector(e.target.value)} error={errors.sector}>
          <option value="">Choose…</option>
          {sectors.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <Field id="suggest-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} error={errors.name} />
        <TextAreaField id="suggest-description" label="What's it like? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} />
        <Field id="suggest-address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} autoComplete="street-address" error={errors.address} />
        <SelectField id="suggest-area" label="Area (optional)" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Not sure</option>
          {areas.map((d) => (
            <optgroup key={d.slug} label={d.name}>
              {d.children.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        <div className="suggest-map flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gula-900 dark:text-coconut">Where is it? Tap the map, then drag the pin to the exact spot.</span>
            <button type="button" onClick={locateMe} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-santan-300 px-3 text-sm font-bold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
              {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
              I&apos;m there now
            </button>
          </div>
          <MapView label="Map for choosing where the place is" picker={{ value: point, onChange: setPoint }} focus={focus} className="h-72 rounded-xl border border-santan-200 dark:border-santan-800" />
          {errors.latitude || errors.longitude ? (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {errors.latitude || errors.longitude}
            </p>
          ) : point ? (
            <p className="text-xs text-santan-500">Pin placed. Drag it if it isn&apos;t quite right.</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="suggest-phone" label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
          <Field id="suggest-website" label="Website or social page (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={190} />
        </div>
        <CheckField id="suggest-owner" label="This is my business" checked={isOwner} onChange={setIsOwner} hint="Once it's approved you can manage the listing and reply to reviews." />
        <TextAreaField id="suggest-note" label="Note for our moderators (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
        <SubmitButton busy={busy}>Send for checking</SubmitButton>
      </form>
    </FormPage>
  );
}
