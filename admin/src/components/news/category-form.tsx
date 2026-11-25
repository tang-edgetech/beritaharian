"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { CATEGORY_COLORS } from "@/lib/news";
import { ApiError, type CategoryColor, type NewsCategory } from "@cendol/api-client";
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

export function CategoryForm({ category, onSaved }: { category?: NewsCategory; onSaved: (category: NewsCategory) => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    color: (category?.color ?? "pandan") as CategoryColor,
    is_active: category?.is_active ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setErrors({ name: "Please give the category a name." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const result = category
        ? await api.put<{ message: string; data: NewsCategory }>(`admin/news/categories/${category.slug}`, values)
        : await api.post<{ message: string; data: NewsCategory }>("admin/news/categories", values);
      notify.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["news-categories"] });
      onSaved(result.data);
    } catch (error) {
      if (error instanceof ApiError) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="category-form flex max-w-2xl flex-col gap-6" onSubmit={submit} noValidate>
      <section className="panel-card grid gap-5 sm:grid-cols-2">
        <FormField id="category-name" label="Name" error={errors.name}>
          <Input
            id="category-name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value, slug: slugTouched ? v.slug : toSlug(e.target.value) }))}
          />
        </FormField>
        <FormField id="category-slug" label="Web address" error={errors.slug} hint={`cendolsatay.my/news/${values.slug || "…"}`}>
          <Input
            id="category-slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setValues((v) => ({ ...v, slug: toSlug(e.target.value) }));
            }}
          />
        </FormField>
        <FormField id="category-description" label="Description (optional)" hint="Shown at the top of the category page." className="sm:col-span-2">
          <Textarea id="category-description" rows={2} value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </FormField>
        <fieldset className="category-colors flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={values.color === c.value}
                onClick={() => setValues((v) => ({ ...v, color: c.value }))}
                className={[
                  "category-color-option flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm",
                  values.color === c.value ? "is-selected border-foreground ring-2 ring-ring/40" : "hover:bg-muted",
                ].join(" ")}
              >
                <span className={`size-5 rounded-full ${c.swatch}`} aria-hidden />
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
          <Label htmlFor="category-active" className="flex flex-col items-start gap-0.5 font-normal">
            <span className="font-medium">Show on the site</span>
            <span className="text-xs text-muted-foreground">Turn off to hide the category from menus while keeping its stories.</span>
          </Label>
          <Switch id="category-active" checked={values.is_active} onCheckedChange={(v) => setValues((s) => ({ ...s, is_active: v }))} />
        </div>
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {category ? "Save category" : "Add category"}
        </Button>
      </div>
    </form>
  );
}
