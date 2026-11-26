"use client";

import { FormField } from "@/components/form-field";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/confirm-dialog";
import { api } from "@/lib/api";
import { CONTACT_FIELDS, useSectors } from "@/lib/directory";
import { notify } from "@/lib/notify";
import { ApiError, type BusinessFull, type BusinessInput, type ContactKey, type DetailValue, type SectorField } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { emptyLocation, LocationCard, type LocationDraft } from "./location-card";

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

interface Values {
  sector: string;
  name: string;
  slug: string;
  description: string;
  ssm_number: string;
  details: Record<string, DetailValue>;
  contacts: Partial<Record<ContactKey, string>>;
  locations: LocationDraft[];
}

function fromBusiness(b?: BusinessFull): Values {
  return {
    sector: b?.sector?.slug ?? "",
    name: b?.name ?? "",
    slug: b?.slug ?? "",
    description: b?.description ?? "",
    ssm_number: b?.ssm_number ?? "",
    details: { ...(b?.details ?? {}) },
    contacts: { ...(b?.contacts ?? {}) },
    locations: b?.locations.length
      ? b.locations.map((l) => ({
          key: l.id,
          id: l.id,
          label: l.label ?? "",
          address: l.address,
          postcode: l.postcode ?? "",
          area: l.area?.slug ?? "",
          latitude: l.latitude,
          longitude: l.longitude,
          phone: l.phone ?? "",
          hours_note: l.hours_note ?? "",
          is_primary: l.is_primary,
          hours: l.hours ?? [],
        }))
      : [emptyLocation(true)],
  };
}

/** One sector detail, drawn to suit its type. */
function DetailInput({ field, value, onChange, error }: { field: SectorField; value: DetailValue | undefined; onChange: (v: DetailValue | undefined) => void; error?: string }) {
  const id = `detail-${field.key}`;
  if (field.type === "boolean") {
    // three states: not said, yes, no
    return (
      <FormField id={id} label={field.label} error={error}>
        <Select value={value === undefined ? "unset" : value ? "yes" : "no"} onValueChange={(v) => onChange(v === "unset" ? undefined : v === "yes")}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">Not said</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    );
  }
  if (field.type === "select") {
    return (
      <FormField id={id} label={field.label} error={error}>
        <Select value={typeof value === "string" ? value : "unset"} onValueChange={(v) => onChange(v === "unset" ? undefined : v)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">Not said</SelectItem>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    );
  }
  if (field.type === "multiselect") {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <fieldset className="detail-multiselect flex flex-col gap-2 sm:col-span-2">
        <legend className="text-sm font-medium">{field.label}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(field.options ?? []).map((o) => (
            <label key={o} className="detail-option flex items-center gap-2 text-sm">
              <Checkbox
                checked={chosen.includes(o)}
                onCheckedChange={(on) => {
                  const next = on ? [...chosen, o] : chosen.filter((x) => x !== o);
                  onChange(next.length ? next : undefined);
                }}
              />
              {o}
            </label>
          ))}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    );
  }
  return (
    <FormField id={id} label={field.unit ? `${field.label} (${field.unit})` : field.label} error={error}>
      <Input
        id={id}
        type={field.type === "number" ? "number" : "text"}
        inputMode={field.type === "number" ? "decimal" : undefined}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : field.type === "number" ? Number(raw) : raw);
        }}
      />
    </FormField>
  );
}

interface BusinessFormProps {
  business?: BusinessFull;
  onSaved: (business: BusinessFull) => void;
}

/** The whole listing: what it is, its details, how to reach it, and every branch with its pin and hours. */
export function BusinessForm({ business, onSaved }: BusinessFormProps) {
  const sectors = useSectors();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(() => fromBusiness(business));
  const [slugTouched, setSlugTouched] = useState(Boolean(business));
  const [goLive, setGoLive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sector = sectors.data?.find((s) => s.slug === values.sector);
  const set = (changes: Partial<Values>) => {
    setDirty(true);
    setValues((v) => ({ ...v, ...changes }));
  };
  const setLocation = (key: string, changes: Partial<LocationDraft>) =>
    set({ locations: values.locations.map((l) => (l.key === key ? { ...l, ...changes } : l)) });

  async function removeLocation(location: LocationDraft) {
    if (location.id && !(await confirm({ title: "Remove this branch?", description: "Its pin and opening hours are removed when you save. Reviews of it stay on the place.", confirmLabel: "Remove", danger: true }))) return;
    const rest = values.locations.filter((l) => l.key !== location.key);
    if (location.is_primary && rest.length) rest[0] = { ...rest[0], is_primary: true };
    set({ locations: rest });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!values.sector) local.sector = "Please choose a sector.";
    if (!values.name.trim()) local.name = "Please give the place a name.";
    values.locations.forEach((l, i) => {
      if (!l.address.trim()) local[`locations.${i}.address`] = "Please fill in the address.";
      if (l.latitude === null) local[`locations.${i}.latitude`] = "Please put the pin on the map.";
    });
    if (Object.keys(local).length) {
      setErrors(local);
      notify.info("A few things need fixing before saving.");
      return;
    }

    const fields = new Set((sector?.fields ?? []).map((f) => f.key));
    const payload: BusinessInput = {
      sector: values.sector,
      name: values.name.trim(),
      slug: values.slug || null,
      description: values.description,
      ssm_number: values.ssm_number || null,
      details: Object.fromEntries(Object.entries(values.details).filter(([k, v]) => fields.has(k) && v !== undefined)),
      contacts: Object.fromEntries(Object.entries(values.contacts).filter(([, v]) => v && v.trim())) as BusinessInput["contacts"],
      locations: values.locations.map((l) => ({
        id: l.id,
        label: l.label || null,
        address: l.address.trim(),
        postcode: l.postcode || null,
        area: l.area || null,
        latitude: l.latitude as number,
        longitude: l.longitude as number,
        phone: l.phone || null,
        hours_note: l.hours_note || null,
        is_primary: l.is_primary,
        hours: l.hours,
      })),
      ...(business ? {} : { status: goLive ? "active" : "pending" }),
    };

    setBusy(true);
    setErrors({});
    try {
      const result = business
        ? await api.put<{ message: string; data: BusinessFull }>(`admin/directory/businesses/${business.id}`, payload)
        : await api.post<{ message: string; data: BusinessFull }>("admin/directory/businesses", payload);
      notify.success(result.message);
      setDirty(false);
      queryClient.setQueryData(["directory-business", result.data.id], result.data);
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      await queryClient.invalidateQueries({ queryKey: ["directory-summary"] });
      onSaved(result.data);
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  const locationErrors = (index: number) =>
    Object.fromEntries(
      Object.entries(errors)
        .filter(([k]) => k.startsWith(`locations.${index}.`))
        .map(([k, m]) => [k.slice(`locations.${index}.`.length), m]),
    );

  return (
    <form className="business-form flex min-w-0 flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card grid gap-5 sm:grid-cols-2" aria-labelledby="business-basics-title">
        <h2 id="business-basics-title" className="panel-card-title sm:col-span-2">
          About the place
        </h2>
        <FormField id="business-name" label="Name" error={errors.name}>
          <Input
            id="business-name"
            value={values.name}
            onChange={(e) => set({ name: e.target.value, slug: slugTouched ? values.slug : toSlug(e.target.value) })}
          />
        </FormField>
        <FormField id="business-sector" label="Sector" error={errors.sector}>
          <Select value={values.sector || undefined} onValueChange={(v) => set({ sector: v })}>
            <SelectTrigger id="business-sector" className="w-full">
              <SelectValue placeholder={sectors.isPending ? "Loading…" : "Choose a sector"} />
            </SelectTrigger>
            <SelectContent>
              {(sectors.data ?? []).map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.name}
                  {s.is_active ? "" : " (hidden)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="business-slug" label="Web address" error={errors.slug} hint={`/places/${values.sector || "…"}/${values.slug || "…"}`}>
          <Input
            id="business-slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: toSlug(e.target.value) });
            }}
          />
        </FormField>
        <FormField id="business-ssm" label="SSM registration no. (optional)" error={errors.ssm_number}>
          <Input id="business-ssm" value={values.ssm_number} onChange={(e) => set({ ssm_number: e.target.value })} />
        </FormField>
        <FormField id="business-description" label="Description" hint="A few friendly sentences: what it is known for, who it suits." error={errors.description} className="sm:col-span-2">
          <Textarea id="business-description" rows={4} value={values.description} onChange={(e) => set({ description: e.target.value })} />
        </FormField>
        {!business ? (
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
            <Label htmlFor="business-go-live" className="flex flex-col items-start gap-0.5 font-normal">
              <span className="font-medium">Put it on the map now</span>
              <span className="text-xs text-muted-foreground">Turn off to save it as waiting for approval.</span>
            </Label>
            <Switch id="business-go-live" checked={goLive} onCheckedChange={setGoLive} />
          </div>
        ) : null}
      </section>

      <section className="panel-card flex flex-col gap-4" aria-labelledby="business-details-title">
        <div>
          <h2 id="business-details-title" className="panel-card-title">
            Details
          </h2>
          <p className="panel-card-description">{sector ? `What the ${sector.name} sector asks for. Readers can filter by some of these.` : "Choose a sector first."}</p>
        </div>
        {sector?.fields.length ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {sector.fields.map((field) => (
              <DetailInput
                key={field.key}
                field={field}
                value={values.details[field.key]}
                error={errors[`details.${field.key}`]}
                onChange={(v) => {
                  const next = { ...values.details };
                  if (v === undefined) delete next[field.key];
                  else next[field.key] = v;
                  set({ details: next });
                }}
              />
            ))}
          </div>
        ) : sector ? (
          <p className="text-sm text-muted-foreground">This sector has no extra details.</p>
        ) : null}
      </section>

      <section className="panel-card grid gap-5 sm:grid-cols-2" aria-labelledby="business-contacts-title">
        <h2 id="business-contacts-title" className="panel-card-title sm:col-span-2">
          How to reach them
        </h2>
        {CONTACT_FIELDS.map((c) => (
          <FormField key={c.key} id={`contact-${c.key}`} label={c.label} error={errors[`contacts.${c.key}`]}>
            <Input
              id={`contact-${c.key}`}
              type={c.type ?? "text"}
              placeholder={c.placeholder}
              value={values.contacts[c.key] ?? ""}
              onChange={(e) => set({ contacts: { ...values.contacts, [c.key]: e.target.value } })}
            />
          </FormField>
        ))}
      </section>

      <section className="business-branches flex flex-col gap-3" aria-labelledby="business-branches-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="business-branches-title" className="panel-card-title">
              Addresses and branches
            </h2>
            <p className="panel-card-description">Each branch gets its own pin and opening hours. Drag to change the order.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => set({ locations: [...values.locations, emptyLocation(false)] })}>
            <Plus />
            Add a branch
          </Button>
        </div>
        {errors.locations ? (
          <p className="field-error" role="alert">
            {errors.locations}
          </p>
        ) : null}
        <SortableList
          items={values.locations}
          getId={(l) => l.key}
          handleLabel={(l) => `Move ${l.label || "this branch"}`}
          onReorder={(locations) => set({ locations })}
          renderItem={(l) => {
            const index = values.locations.findIndex((x) => x.key === l.key);
            return (
              <LocationCard
                index={index}
                value={l}
                errors={locationErrors(index)}
                onChange={(changes) => setLocation(l.key, changes)}
                onMakePrimary={() => set({ locations: values.locations.map((x) => ({ ...x, is_primary: x.key === l.key })) })}
                onRemove={values.locations.length > 1 ? () => removeLocation(l) : undefined}
              />
            );
          }}
        />
      </section>

      <div className="business-form-actions sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
        {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {business ? "Save place" : "Add place"}
        </Button>
      </div>
    </form>
  );
}
