"use client";

import { errorMessage, Field, fieldErrors, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { CheckField, SelectField, TextAreaField } from "@/components/places/form-bits";
import { readerApi } from "@/lib/auth";
import type { BusinessFull, ContactKey, DetailValue, HoursRow, SectorField } from "@cendol/api-client";
import { Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { HoursEditor } from "./hours-editor";

const CONTACTS: { key: ContactKey; label: string; hint?: string; type?: string }[] = [
  { key: "whatsapp", label: "WhatsApp number", hint: "Shown as the first button on your page.", type: "tel" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "website", label: "Website" },
  { key: "facebook", label: "Facebook page" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

interface BranchState {
  id: string;
  label: string | null;
  address: string;
  phone: string;
  hours_note: string;
  hours: HoursRow[];
}

/** What an owner can change: description, details, contacts and each branch's phone and hours. */
export function ListingForm({ place, onSaved }: { place: BusinessFull; onSaved: () => void }) {
  const fields: SectorField[] = place.sector_fields ?? [];
  const [description, setDescription] = useState(place.description ?? "");
  const [details, setDetails] = useState<Record<string, DetailValue>>({ ...place.details });
  const [contacts, setContacts] = useState<Partial<Record<ContactKey, string>>>({ ...place.contacts });
  const [branches, setBranches] = useState<BranchState[]>(
    place.locations.map((l) => ({ id: l.id, label: l.label, address: l.address, phone: l.phone ?? "", hours_note: l.hours_note ?? "", hours: l.hours ?? [] })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const setBranch = (i: number, change: Partial<BranchState>) => setBranches((all) => all.map((b, j) => (j === i ? { ...b, ...change } : b)));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const r = await readerApi.put<{ message: string }>(`me/businesses/${place.id}`, {
        description,
        details: Object.fromEntries(Object.entries(details).filter(([, v]) => v !== "" && v !== null && !(Array.isArray(v) && !v.length))),
        contacts: Object.fromEntries(Object.entries(contacts).filter(([, v]) => v && v.trim())),
        locations: branches.map((b) => ({ id: b.id, phone: b.phone || null, hours_note: b.hours_note || null, hours: b.hours })),
      });
      setMessage({ tone: "success", text: r.message });
      onSaved();
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="listing-form flex flex-col gap-8" onSubmit={save} noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <section className="listing-fixed flex flex-col gap-2 rounded-xl bg-santan-100 p-4 text-sm dark:bg-santan-800" aria-labelledby="fixed-title">
        <h2 id="fixed-title" className="inline-flex items-center gap-1.5 font-bold">
          <Lock className="size-4" aria-hidden />
          Name, kind of place and address
        </h2>
        <p>
          <span className="font-semibold">{place.name}</span> · {place.sector?.name}
        </p>
        <p className="text-santan-600 dark:text-santan-300">To change these, ask us using the contact details at the bottom of the page. We check them so listings can&apos;t be taken over.</p>
      </section>

      <TextAreaField id="listing-description" label="About your place" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} rows={5} error={errors.description} hint="What you're known for, what to order, anything visitors should know." />

      {fields.length ? (
        <fieldset className="listing-details flex flex-col gap-4">
          <legend className="mb-2 font-display text-lg font-black">Details</legend>
          {fields.map((field) => {
            const id = `detail-${field.key}`;
            const value = details[field.key];
            const error = errors[`details.${field.key}`];
            if (field.type === "boolean") {
              return <CheckField key={field.key} id={id} label={field.label} checked={value === true} onChange={(v) => setDetails((d) => ({ ...d, [field.key]: v }))} error={error} />;
            }
            if (field.type === "select") {
              return (
                <SelectField key={field.key} id={id} label={field.label} value={typeof value === "string" ? value : ""} onChange={(e) => setDetails((d) => ({ ...d, [field.key]: e.target.value }))} error={error}>
                  <option value="">Not set</option>
                  {(field.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </SelectField>
              );
            }
            if (field.type === "multiselect") {
              const chosen = Array.isArray(value) ? value : [];
              return (
                <fieldset key={field.key} className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-semibold">{field.label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((o) => (
                      <label key={o} className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold ${chosen.includes(o) ? "border-pandan-600 bg-pandan-50 dark:bg-pandan-950" : "border-santan-300 dark:border-santan-700"}`}>
                        <input
                          type="checkbox"
                          className="size-4 accent-pandan-600"
                          checked={chosen.includes(o)}
                          onChange={(e) => setDetails((d) => ({ ...d, [field.key]: e.target.checked ? [...chosen, o] : chosen.filter((x) => x !== o) }))}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                  {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}
                </fieldset>
              );
            }
            return (
              <Field
                key={field.key}
                id={id}
                label={field.unit ? `${field.label} (${field.unit})` : field.label}
                type={field.type === "number" ? "number" : "text"}
                value={value === undefined ? "" : String(value)}
                onChange={(e) => setDetails((d) => ({ ...d, [field.key]: field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
                error={error}
              />
            );
          })}
        </fieldset>
      ) : null}

      <fieldset className="listing-contacts grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-black">How to reach you</legend>
        {CONTACTS.map((c) => (
          <Field key={c.key} id={`contact-${c.key}`} label={c.label} type={c.type ?? "text"} value={contacts[c.key] ?? ""} onChange={(e) => setContacts((v) => ({ ...v, [c.key]: e.target.value }))} maxLength={190} error={errors[`contacts.${c.key}`]} hint={c.hint} />
        ))}
      </fieldset>

      {branches.map((branch, i) => (
        <fieldset key={branch.id} className="listing-branch flex flex-col gap-4 rounded-card border border-santan-200 p-4 dark:border-santan-800">
          <legend className="px-1 font-display text-lg font-black">{branch.label ?? (branches.length > 1 ? `Branch ${i + 1}` : "Your shop")}</legend>
          <p className="text-sm text-santan-600 dark:text-santan-300">{branch.address}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`branch-${i}-phone`} label="Phone for this branch" type="tel" value={branch.phone} onChange={(e) => setBranch(i, { phone: e.target.value })} maxLength={30} error={errors[`locations.${i}.phone`]} />
            <Field id={`branch-${i}-note`} label="Note about hours" value={branch.hours_note} onChange={(e) => setBranch(i, { hours_note: e.target.value })} maxLength={200} placeholder="e.g. Closed on public holidays" error={errors[`locations.${i}.hours_note`]} />
          </div>
          <HoursEditor id={`branch-${i}-hours`} value={branch.hours} onChange={(hours) => setBranch(i, { hours })} />
          {Object.entries(errors)
            .filter(([k]) => k.startsWith(`locations.${i}.hours`))
            .map(([k, v]) => (
              <p key={k} className="text-sm text-red-700 dark:text-red-400" role="alert">
                {v}
              </p>
            ))}
        </fieldset>
      ))}

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <SubmitButton busy={busy}>Save changes</SubmitButton>
      </div>
    </form>
  );
}
