"use client";

import { SectorIcon, isIconName } from "@/components/directory/sector-icon";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { INCIDENT_ICON_SUGGESTIONS, SEVERITIES, SEVERITY } from "@/lib/civic";
import { CATEGORY_COLORS } from "@/lib/news";
import { notify } from "@/lib/notify";
import { ApiError, type AdminIncidentType, type CategoryColor, type IncidentSeverity, type IncidentTypeInput } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Add or edit a kind of incident readers can report. */
export function IncidentTypeForm({ type, onSaved }: { type?: AdminIncidentType; onSaved: (type: AdminIncidentType) => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name: type?.name ?? "",
    slug: type?.slug ?? "",
    description: type?.description ?? "",
    icon: type?.icon ?? "circle-help",
    color: (type?.color ?? "satay") as CategoryColor,
    default_severity: (type?.default_severity ?? "medium") as IncidentSeverity,
    is_active: type?.is_active ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(type));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setErrors({ name: "Please give the type a name." });
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: IncidentTypeInput = { ...values, description: values.description.trim() || undefined, slug: values.slug || undefined };
    try {
      const result = type
        ? await api.put<{ message: string; data: AdminIncidentType }>(`admin/incident-types/${type.slug}`, payload)
        : await api.post<{ message: string; data: AdminIncidentType }>("admin/incident-types", payload);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["incident-types"] });
      queryClient.setQueryData(["incident-type", result.data.slug], result.data);
      onSaved(result.data);
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="incident-type-form flex max-w-3xl flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card grid gap-5 sm:grid-cols-2">
        <FormField id="incident-type-name" label="Name" error={errors.name}>
          <Input
            id="incident-type-name"
            value={values.name}
            maxLength={80}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value, slug: slugTouched ? v.slug : toSlug(e.target.value) }))}
          />
        </FormField>
        <FormField id="incident-type-slug" label="Short code" error={errors.slug} hint="Used in links and filters. Lowercase letters, numbers and dashes.">
          <Input
            id="incident-type-slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setValues((v) => ({ ...v, slug: toSlug(e.target.value) }));
            }}
          />
        </FormField>
        <FormField id="incident-type-description" label="Description (optional)" error={errors.description} hint="Helps readers pick the right type on the report form." className="sm:col-span-2">
          <Textarea id="incident-type-description" rows={2} value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </FormField>

        <div className="incident-type-icons flex flex-col gap-2 sm:col-span-2" role="group" aria-labelledby="incident-type-icon-label">
          <span id="incident-type-icon-label" className="text-sm font-medium">
            Icon
          </span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
            {INCIDENT_ICON_SUGGESTIONS.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={values.icon === name}
                aria-label={name}
                title={name}
                onClick={() => setValues((v) => ({ ...v, icon: name }))}
                className={[
                  "incident-type-icon-option grid size-10 place-items-center rounded-lg border",
                  values.icon === name ? "is-selected border-foreground bg-muted ring-2 ring-ring/40" : "hover:bg-muted",
                ].join(" ")}
              >
                <SectorIcon name={name} className="size-5" />
              </button>
            ))}
          </div>
          <FormField
            id="incident-type-icon"
            label="Or type any icon name"
            error={errors.icon}
            hint={<>From lucide.dev/icons.{!isIconName(values.icon) ? " That name isn't known, so a shop icon would be used." : null}</>}
          >
            <Input id="incident-type-icon" value={values.icon} className="max-w-xs" onChange={(e) => setValues((v) => ({ ...v, icon: e.target.value.trim().toLowerCase() }))} />
          </FormField>
        </div>

        <div className="incident-type-colors flex flex-col gap-2" role="group" aria-labelledby="incident-type-color-label">
          <span id="incident-type-color-label" className="text-sm font-medium">
            Pin colour
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pin colour">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={values.color === c.value}
                aria-label={c.label}
                title={c.label}
                onClick={() => setValues((v) => ({ ...v, color: c.value }))}
                className={["incident-type-color-option grid size-9 place-items-center rounded-full border", values.color === c.value ? "is-selected border-foreground ring-2 ring-ring/40" : "hover:bg-muted"].join(" ")}
              >
                <span className={`size-6 rounded-full ${c.swatch}`} aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <FormField id="incident-type-severity" label="Starting severity" error={errors.default_severity} hint="New reports of this type start here. Verifiers can change it.">
          <Select value={values.default_severity} onValueChange={(v) => setValues((s) => ({ ...s, default_severity: v as IncidentSeverity }))}>
            <SelectTrigger id="incident-type-severity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
          <Label htmlFor="incident-type-active" className="flex flex-col items-start gap-0.5 font-normal">
            <span className="font-medium">Readers can choose this type</span>
            <span className="text-xs text-muted-foreground">Turn off to hide it from the report form. Reports already sent keep it.</span>
          </Label>
          <Switch id="incident-type-active" checked={values.is_active} onCheckedChange={(v) => setValues((s) => ({ ...s, is_active: v }))} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {type ? "Save type" : "Add type"}
        </Button>
      </div>
    </form>
  );
}
