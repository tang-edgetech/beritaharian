"use client";

import { FormField } from "@/components/form-field";
import { IconAction } from "@/components/icon-action";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { FIELD_TYPES, SECTOR_ICON_SUGGESTIONS } from "@/lib/directory";
import { CATEGORY_COLORS } from "@/lib/news";
import { notify } from "@/lib/notify";
import { ApiError, type CategoryColor, type Sector, type SectorFieldType } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { isIconName, SectorIcon } from "./sector-icon";

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

interface FieldDraft {
  key: string;
  /** kept when editing so saved answers still match */
  savedKey?: string;
  label: string;
  type: SectorFieldType;
  options: string;
  unit: string;
  filterable: boolean;
}

const newField = (): FieldDraft => ({ key: `new-${Math.random().toString(36).slice(2, 9)}`, label: "", type: "boolean", options: "", unit: "", filterable: false });

export function SectorForm({ sector, onSaved }: { sector?: Sector; onSaved: (sector: Sector) => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name: sector?.name ?? "",
    slug: sector?.slug ?? "",
    description: sector?.description ?? "",
    icon: sector?.icon ?? "store",
    color: (sector?.color ?? "marigold") as CategoryColor,
    is_active: sector?.is_active ?? true,
  });
  const [fields, setFields] = useState<FieldDraft[]>(
    () =>
      sector?.fields.map((f) => ({
        key: f.key,
        savedKey: f.key,
        label: f.label,
        type: f.type,
        options: (f.options ?? []).join("\n"),
        unit: f.unit ?? "",
        filterable: Boolean(f.filterable),
      })) ?? [],
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(sector));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const setField = (key: string, changes: Partial<FieldDraft>) => setFields((list) => list.map((f) => (f.key === key ? { ...f, ...changes } : f)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setErrors({ name: "Please give the sector a name." });
      return;
    }
    setBusy(true);
    setErrors({});
    const payload = {
      ...values,
      fields: fields.map((f) => ({
        key: f.savedKey ?? null,
        label: f.label,
        type: f.type,
        options: f.type === "select" || f.type === "multiselect" ? f.options.split("\n").map((o) => o.trim()).filter(Boolean) : undefined,
        unit: f.type === "number" ? f.unit : undefined,
        filterable: f.filterable,
      })),
    };
    try {
      const result = sector
        ? await api.put<{ message: string; data: Sector }>(`admin/directory/sectors/${sector.slug}`, payload)
        : await api.post<{ message: string; data: Sector }>("admin/directory/sectors", payload);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["directory-sectors"] });
      if (sector) queryClient.setQueryData(["directory-sector", result.data.slug], result.data);
      onSaved(result.data);
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (index: number, part: string) => errors[`fields.${index}.${part}`];

  return (
    <form className="sector-form flex max-w-3xl flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card grid gap-5 sm:grid-cols-2">
        <FormField id="sector-name" label="Name" error={errors.name}>
          <Input id="sector-name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value, slug: slugTouched ? v.slug : toSlug(e.target.value) }))} />
        </FormField>
        <FormField id="sector-slug" label="Web address" error={errors.slug} hint={`/places/${values.slug || "…"}`}>
          <Input
            id="sector-slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setValues((v) => ({ ...v, slug: toSlug(e.target.value) }));
            }}
          />
        </FormField>
        <FormField id="sector-description" label="Description (optional)" hint="Shown at the top of the sector's page." className="sm:col-span-2">
          <Textarea id="sector-description" rows={2} value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </FormField>
        <FormField
          id="sector-icon"
          label="Icon"
          error={errors.icon}
          hint={
            <>
              Any name from lucide.dev/icons, e.g. {SECTOR_ICON_SUGGESTIONS.slice(0, 5).join(", ")}.
              {!isIconName(values.icon) ? " That name isn't known, so a shop icon is used." : null}
            </>
          }
        >
          <div className="flex items-center gap-2">
            <span className="sector-icon-preview grid size-9 shrink-0 place-items-center rounded-lg border bg-muted" aria-hidden>
              <SectorIcon name={values.icon} className="size-5" />
            </span>
            <Input id="sector-icon" list="sector-icon-suggestions" value={values.icon} onChange={(e) => setValues((v) => ({ ...v, icon: e.target.value.trim().toLowerCase() }))} />
            <datalist id="sector-icon-suggestions">
              {SECTOR_ICON_SUGGESTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </FormField>
        <fieldset className="sector-colors flex flex-col gap-2">
          <legend className="text-sm font-medium">Pin colour</legend>
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
                className={["sector-color-option grid size-9 place-items-center rounded-full border", values.color === c.value ? "is-selected border-foreground ring-2 ring-ring/40" : "hover:bg-muted"].join(" ")}
              >
                <span className={`size-6 rounded-full ${c.swatch}`} aria-hidden />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
          <Label htmlFor="sector-active" className="flex flex-col items-start gap-0.5 font-normal">
            <span className="font-medium">Show on the site</span>
            <span className="text-xs text-muted-foreground">Turn off to hide the sector from menus and filters. Its places stay on the map.</span>
          </Label>
          <Switch id="sector-active" checked={values.is_active} onCheckedChange={(v) => setValues((s) => ({ ...s, is_active: v }))} />
        </div>
      </section>

      <section className="sector-fields panel-card flex flex-col gap-4" aria-labelledby="sector-fields-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="sector-fields-title" className="panel-card-title">
              Details places fill in
            </h2>
            <p className="panel-card-description">e.g. Halal, Price range. Drag to set the order on the place page. Renaming a detail keeps the answers already given.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setFields((list) => [...list, newField()])}>
            <Plus />
            Add a detail
          </Button>
        </div>
        {fields.length ? (
          <SortableList
            items={fields}
            getId={(f) => f.key}
            handleLabel={(f) => `Move ${f.label || "this detail"}`}
            onReorder={setFields}
            renderItem={(f) => {
              const index = fields.findIndex((x) => x.key === f.key);
              const hasOptions = f.type === "select" || f.type === "multiselect";
              const canFilter = f.type === "boolean" || hasOptions;
              return (
                <div className="sector-field grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                  <FormField id={`field-${f.key}-label`} label="Name" error={fieldError(index, "label")}>
                    <Input id={`field-${f.key}-label`} value={f.label} onChange={(e) => setField(f.key, { label: e.target.value })} placeholder="e.g. Halal" />
                  </FormField>
                  <FormField id={`field-${f.key}-type`} label="Answer" error={fieldError(index, "type")}>
                    <Select value={f.type} onValueChange={(v) => setField(f.key, { type: v as SectorFieldType, filterable: v === "boolean" || v === "select" || v === "multiselect" ? f.filterable : false })}>
                      <SelectTrigger id={`field-${f.key}-type`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-end pb-0.5">
                    <IconAction icon={Trash2} label={`Remove ${f.label || "this detail"}`} danger onClick={() => setFields((list) => list.filter((x) => x.key !== f.key))} />
                  </div>
                  {hasOptions ? (
                    <FormField id={`field-${f.key}-options`} label="Choices, one per line" error={fieldError(index, "options")} className="sm:col-span-2">
                      <Textarea id={`field-${f.key}-options`} rows={3} value={f.options} onChange={(e) => setField(f.key, { options: e.target.value })} />
                    </FormField>
                  ) : null}
                  {f.type === "number" ? (
                    <FormField id={`field-${f.key}-unit`} label="Unit (optional)" hint="e.g. stars, rooms" className="sm:col-span-2">
                      <Input id={`field-${f.key}-unit`} value={f.unit} onChange={(e) => setField(f.key, { unit: e.target.value })} />
                    </FormField>
                  ) : null}
                  {canFilter ? (
                    <label className="sector-field-filterable flex items-center gap-2 text-sm sm:col-span-3">
                      <Checkbox checked={f.filterable} onCheckedChange={(on) => setField(f.key, { filterable: on === true })} />
                      Readers can filter by this on the map
                    </label>
                  ) : null}
                </div>
              );
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No extra details. Places in this sector show only their description, contacts and hours.</p>
        )}
        {errors.fields ? (
          <p className="field-error" role="alert">
            {errors.fields}
          </p>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {sector ? "Save sector" : "Add sector"}
        </Button>
      </div>
    </form>
  );
}
