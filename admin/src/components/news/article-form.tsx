"use client";

import { FormField } from "@/components/form-field";
import { IconAction } from "@/components/icon-action";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { SOURCE_KINDS, useAreas, useNewsCategories } from "@/lib/news";
import { ApiError, type AdminArticle, type RichTextNode, type SourceKind } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CoverPicker, type CoverValue } from "./cover-picker";
import { RichTextEditor } from "./rich-text-editor";
import { TagInput } from "./tag-input";

interface SourceRow {
  key: string;
  kind: SourceKind;
  label: string;
  url: string;
}

interface FormValues {
  title: string;
  excerpt: string;
  category: string;
  area: string;
  tags: string[];
  body: RichTextNode | null;
  cover: CoverValue;
  sources: SourceRow[];
  is_breaking: boolean;
  change_note: string;
  is_correction: boolean;
}

let rowCounter = 0;
const newKey = () => `source-${++rowCounter}`;

function initialValues(article?: AdminArticle): FormValues {
  return {
    title: article?.title ?? "",
    excerpt: article?.excerpt ?? "",
    category: article?.category?.slug ?? "",
    area: article?.area?.slug ?? "",
    tags: article?.tags ?? [],
    body: article?.body ?? null,
    cover: {
      media: article?.cover ?? null,
      alt: article?.cover?.alt ?? "",
      caption: article?.cover?.caption ?? "",
      credit: article?.cover?.credit ?? "",
    },
    sources: (article?.sources ?? []).map((s) => ({ key: newKey(), kind: s.kind, label: s.label, url: s.url ?? "" })),
    is_breaking: article?.is_breaking ?? false,
    change_note: "",
    is_correction: false,
  };
}

/** Comparable form of the values, to know whether there are unsaved changes. */
const fingerprint = (v: FormValues) =>
  JSON.stringify({ ...v, sources: v.sources.map(({ kind, label, url }) => ({ kind, label, url })), change_note: undefined, is_correction: undefined });

interface ArticleFormProps {
  article?: AdminArticle;
  onSaved: (article: AdminArticle) => void;
  /** Lets the page know about unsaved changes, so workflow buttons can ask to save first. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function ArticleForm({ article, onSaved, onDirtyChange }: ArticleFormProps) {
  const queryClient = useQueryClient();
  const categories = useNewsCategories();
  const areas = useAreas();
  const readOnly = Boolean(article && !article.actions?.includes("edit"));
  const live = Boolean(article?.is_live);

  const [values, setValues] = useState<FormValues>(() => initialValues(article));
  const [saved, setSaved] = useState(() => fingerprint(initialValues(article)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const dirty = useMemo(() => fingerprint(values) !== saved, [values, saved]);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // warn before leaving with unsaved work
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = "Please write a headline.";
    if (values.cover.media && !values.cover.alt.trim()) next.cover_alt = "Describe the photo in a few words.";
    if (live && !values.change_note.trim()) next.change_note = "Say what you changed. Readers may see this if it is a correction.";
    values.sources.forEach((s, i) => {
      if (!s.label.trim()) next[`sources.${i}.label`] = "Name the source.";
      if (s.url && !/^https?:\/\//i.test(s.url)) next[`sources.${i}.url`] = "Links start with https://";
    });
    setErrors(next);
    if (Object.keys(next).length) {
      notify.error(new Error("form"), "Some fields need attention.");
      return;
    }

    setBusy(true);
    const payload = {
      title: values.title,
      excerpt: values.excerpt || null,
      body: values.body,
      category: values.category || null,
      area: values.area || null,
      tags: values.tags,
      sources: values.sources.map(({ kind, label, url }) => ({ kind, label, url: url || null })),
      cover: values.cover.media?.id ?? null,
      cover_alt: values.cover.alt || null,
      cover_caption: values.cover.caption || null,
      cover_credit: values.cover.credit || null,
      is_breaking: values.is_breaking,
      change_note: values.change_note || null,
      is_correction: values.is_correction,
    };
    try {
      const result = article
        ? await api.put<{ message: string; data: AdminArticle }>(`admin/news/articles/${article.id}`, payload)
        : await api.post<{ message: string; data: AdminArticle }>("admin/news/articles", payload);
      notify.success(result.message);
      queryClient.setQueryData(["article", result.data.id], result.data);
      await queryClient.invalidateQueries({ queryKey: ["listing"] });
      await queryClient.invalidateQueries({ queryKey: ["article-revisions", result.data.id] });
      const fresh = initialValues(result.data);
      setValues(fresh);
      setSaved(fingerprint(fresh));
      onSaved(result.data);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      }
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  const excerptLength = values.excerpt.length;

  return (
    <form id="article-form" className="article-form flex flex-col gap-6" onSubmit={submit} noValidate>
      <fieldset className="article-form-story panel-card flex flex-col gap-5" disabled={readOnly}>
        <legend className="sr-only">Story</legend>
        <FormField id="article-title" label="Headline" error={errors.title}>
          <Input
            id="article-title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            className="h-11 font-heading text-lg font-bold"
            placeholder="Say what happened, in plain words"
            aria-invalid={Boolean(errors.title)}
          />
        </FormField>
        <FormField
          id="article-excerpt"
          label="Summary"
          error={errors.excerpt}
          hint={`Shown on cards and when the link is shared on WhatsApp. ${excerptLength}/300`}
        >
          <Textarea id="article-excerpt" rows={2} maxLength={300} value={values.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-body">Story</Label>
          <RichTextEditor id="article-body" value={values.body} onChange={(doc) => set("body", doc)} disabled={readOnly} />
          <p className="field-hint">Use section headings for long stories. Paste links with the link button so readers can check them.</p>
        </div>
      </fieldset>

      <fieldset className="article-form-placing panel-card grid gap-5 sm:grid-cols-2" disabled={readOnly}>
        <legend className="sr-only">Where it goes</legend>
        <h2 className="panel-card-title sm:col-span-2">Where it goes</h2>
        <FormField id="article-category" label="Category" error={errors.category}>
          <Select value={values.category} onValueChange={(v) => set("category", v)} disabled={readOnly}>
            <SelectTrigger id="article-category" className="w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                  {c.is_active === false ? " (hidden)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="article-area" label="Where in Melaka (optional)">
          <Select value={values.area || "none"} onValueChange={(v) => set("area", v === "none" ? "" : v)} disabled={readOnly}>
            <SelectTrigger id="article-area" className="w-full">
              <SelectValue placeholder="Choose a place" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not about one place</SelectItem>
              {(areas.data ?? []).map((district) => (
                <SelectGroup key={district.slug}>
                  <SelectLabel>{district.name}</SelectLabel>
                  <SelectItem value={district.slug}>All of {district.name}</SelectItem>
                  {district.children.map((place) => (
                    <SelectItem key={place.slug} value={place.slug}>
                      {place.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="article-tags" label="Topics (optional)" hint="Up to 10. Readers can tap a topic to see related stories." className="sm:col-span-2">
          <TagInput id="article-tags" value={values.tags} onChange={(tags) => set("tags", tags)} />
        </FormField>
        <div className="article-form-breaking flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
          <Label htmlFor="article-breaking" className="flex flex-col items-start gap-0.5 font-normal">
            <span className="font-medium">Breaking news</span>
            <span className="text-xs text-muted-foreground">Shows in the red strip at the top of the home page for 24 hours.</span>
          </Label>
          <Switch id="article-breaking" checked={values.is_breaking} onCheckedChange={(v) => set("is_breaking", v)} disabled={readOnly} />
        </div>
      </fieldset>

      <fieldset className="article-form-cover panel-card flex flex-col gap-4" disabled={readOnly}>
        <legend className="sr-only">Cover photo</legend>
        <h2 className="panel-card-title">Cover photo</h2>
        <CoverPicker value={values.cover} onChange={(cover) => set("cover", cover)} altError={errors.cover_alt} disabled={readOnly} />
      </fieldset>

      <fieldset className="article-form-sources panel-card flex flex-col gap-4" disabled={readOnly}>
        <legend className="sr-only">Sources</legend>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="panel-card-title">Sources</h2>
            <p className="panel-card-description">Listed at the end of the story so readers can check the facts. The verifier checks these first.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || values.sources.length >= 20}
            onClick={() => set("sources", [...values.sources, { key: newKey(), kind: "official", label: "", url: "" }])}
          >
            <Plus />
            Add source
          </Button>
        </div>
        {values.sources.length ? (
          <SortableList
            items={values.sources}
            getId={(s) => s.key}
            disabled={readOnly}
            handleLabel={(s) => `Move source ${s.label || "without a name"}`}
            onReorder={(rows) => set("sources", rows)}
            renderItem={(row) => {
              const index = values.sources.findIndex((s) => s.key === row.key);
              const update = (patch: Partial<SourceRow>) => set("sources", values.sources.map((s) => (s.key === row.key ? { ...s, ...patch } : s)));
              return (
                <div className="article-source grid flex-1 gap-3 py-3 pr-2 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-start">
                  <Select value={row.kind} onValueChange={(v) => update({ kind: v as SourceKind })} disabled={readOnly}>
                    <SelectTrigger aria-label="Kind of source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-1">
                    <Input
                      id={`source-${index}-label`}
                      aria-label="Source name"
                      placeholder="e.g. JKR Melaka statement"
                      value={row.label}
                      onChange={(e) => update({ label: e.target.value })}
                      aria-invalid={Boolean(errors[`sources.${index}.label`])}
                    />
                    {errors[`sources.${index}.label`] ? <p className="field-error text-xs">{errors[`sources.${index}.label`]}</p> : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Input
                      id={`source-${index}-url`}
                      aria-label="Link (optional)"
                      placeholder="https:// (optional)"
                      value={row.url}
                      onChange={(e) => update({ url: e.target.value })}
                      aria-invalid={Boolean(errors[`sources.${index}.url`])}
                    />
                    {errors[`sources.${index}.url`] ? <p className="field-error text-xs">{errors[`sources.${index}.url`]}</p> : null}
                  </div>
                  <IconAction icon={Trash2} label="Remove this source" danger onClick={() => set("sources", values.sources.filter((s) => s.key !== row.key))} />
                </div>
              );
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No sources yet. Stories with named sources are checked faster.</p>
        )}
      </fieldset>

      {live && !readOnly ? (
        <fieldset className="article-form-live-change panel-card flex flex-col gap-4 border-marigold-300 dark:border-marigold-800">
          <legend className="sr-only">Changing a live story</legend>
          <h2 className="panel-card-title">This story is live</h2>
          <FormField id="article-change-note" label="What did you change?" error={errors.change_note}>
            <Input
              id="article-change-note"
              value={values.change_note}
              onChange={(e) => set("change_note", e.target.value)}
              placeholder="e.g. The road was closed for three hours, not one."
            />
          </FormField>
          <div className="flex items-start gap-3">
            <Checkbox id="article-correction" checked={values.is_correction} onCheckedChange={(v) => set("is_correction", Boolean(v))} />
            <Label htmlFor="article-correction" className="flex flex-col items-start gap-0.5 font-normal">
              <span className="font-medium">This corrects a fact</span>
              <span className="text-xs text-muted-foreground">Your note is shown under the story and it gets a “Corrected” label. Leave unticked for typos.</span>
            </Label>
          </div>
        </fieldset>
      ) : null}

      {!readOnly ? (
        <div className="article-form-actions sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {dirty ? "Unsaved changes" : article ? "All changes saved" : ""}
          </span>
          <Button type="submit" disabled={busy || (Boolean(article) && !dirty && !values.change_note)}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            {live ? "Save changes" : article ? "Save draft" : "Save draft"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
