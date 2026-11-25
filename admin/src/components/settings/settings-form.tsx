"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { ApiError, type SettingsGroup, type SettingsValues } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

export type SettingField =
  | { key: string; label: string; hint?: string; type: "text" | "email" | "number" | "textarea"; placeholder?: string }
  | { key: string; label: string; hint?: string; type: "switch" }
  | { key: string; label: string; hint?: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; hint?: string; type: "checklist"; options: { value: string; label: string; disabled?: boolean }[] }
  | { key: string; label: string; hint?: string; type: "lines"; placeholder?: string }
  | { key: string; label: string; hint?: string; type: "object"; fields: { key: string; label: string }[] };

export interface SettingSection {
  title: string;
  description?: string;
  fields: SettingField[];
}

interface SettingsFormProps {
  group: SettingsGroup;
  sections: SettingSection[];
  footer?: ReactNode;
}

/** Renders a settings group from a plain description of its fields, so every settings tab looks and saves the same way. */
export function SettingsForm({ group, sections, footer }: SettingsFormProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["settings", group],
    queryFn: () => api.get<{ data: SettingsValues }>(`admin/settings/${group}`).then((r) => r.data),
  });
  // unsaved edits; null means "showing what is saved"
  const [draft, setDraft] = useState<SettingsValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const values = draft ?? query.data ?? {};
  const set = (key: string, value: unknown) => setDraft({ ...values, [key]: value });
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(query.data ?? {});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const result = await api.put<{ message: string; data: SettingsValues }>(`admin/settings/${group}`, values);
      queryClient.setQueryData(["settings", group], result.data);
      setDraft(null);
      notify.success(result.message);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key.split(".")[0], messages[0]])));
      }
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  if (query.isPending) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (query.isError) return <p className="panel-card">{query.error.message}</p>;

  return (
    <form className={`settings-form settings-form-${group} flex flex-col gap-6`} onSubmit={submit}>
      {sections.map((section) => (
        <section key={section.title} className="settings-section panel-card flex flex-col gap-5">
          <div>
            <h2 className="panel-card-title">{section.title}</h2>
            {section.description ? <p className="panel-card-description">{section.description}</p> : null}
          </div>
          <div className="settings-fields grid gap-5 sm:grid-cols-2">
            {section.fields.map((field) => (
              <SettingInput key={field.key} field={field} value={values[field.key]} error={errors[field.key]} onChange={(v) => set(field.key, v)} />
            ))}
          </div>
        </section>
      ))}
      {footer}
      <div className="settings-form-actions sticky bottom-4 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={!dirty || busy} onClick={() => setDraft(null)}>
          Undo changes
        </Button>
        <Button type="submit" disabled={!dirty || busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </form>
  );
}

function SettingInput({ field, value, error, onChange }: { field: SettingField; value: unknown; error?: string; onChange: (value: unknown) => void }) {
  const id = `setting-${field.key}`;

  switch (field.type) {
    case "switch":
      return (
        <div className="setting-switch flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
          <label htmlFor={id} className="flex flex-col">
            <span className="text-sm font-medium">{field.label}</span>
            {field.hint ? <span className="field-hint">{field.hint}</span> : null}
          </label>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      );
    case "select":
      return (
        <FormField id={id} label={field.label} hint={field.hint} error={error}>
          <Select value={String(value ?? "")} onValueChange={(v) => onChange(/^\d+$/.test(v) ? Number(v) : v)}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      );
    case "checklist": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="setting-checklist flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-medium">{field.label}</legend>
          {field.hint ? <p className="field-hint">{field.hint}</p> : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            {field.options.map((option) => (
              <label key={option.value} htmlFor={`${id}-${option.value}`} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`${id}-${option.value}`}
                  checked={list.includes(option.value)}
                  disabled={option.disabled}
                  onCheckedChange={(checked) => onChange(checked ? [...list, option.value] : list.filter((v) => v !== option.value))}
                />
                {option.label}
              </label>
            ))}
          </div>
          {error ? <p className="field-error">{error}</p> : null}
        </fieldset>
      );
    }
    case "lines":
      return (
        <FormField id={id} label={field.label} hint={field.hint} error={error} className="sm:col-span-2">
          <Textarea
            id={id}
            rows={3}
            placeholder={field.placeholder}
            value={Array.isArray(value) ? (value as string[]).join("\n") : ""}
            onChange={(e) => onChange(e.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
          />
        </FormField>
      );
    case "object": {
      const record = (value ?? {}) as Record<string, string | null>;
      return (
        <fieldset className="setting-object grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">{field.label}</legend>
          {field.fields.map((sub) => (
            <FormField key={sub.key} id={`${id}-${sub.key}`} label={sub.label}>
              <Input
                id={`${id}-${sub.key}`}
                type="url"
                placeholder="https://"
                value={record[sub.key] ?? ""}
                onChange={(e) => onChange({ ...record, [sub.key]: e.target.value || null })}
              />
            </FormField>
          ))}
        </fieldset>
      );
    }
    case "textarea":
      return (
        <FormField id={id} label={field.label} hint={field.hint} error={error} className="sm:col-span-2">
          <Textarea id={id} rows={3} placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} />
        </FormField>
      );
    default:
      return (
        <FormField id={id} label={field.label} hint={field.hint} error={error}>
          <Input
            id={id}
            type={field.type}
            placeholder={field.placeholder}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null)}
            aria-invalid={Boolean(error)}
          />
        </FormField>
      );
  }
}
