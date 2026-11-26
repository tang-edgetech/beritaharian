"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { IconAction } from "@/components/icon-action";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { incidentUrl, publicAlertUrl, SEVERITIES, SEVERITY } from "@/lib/civic";
import { formatDateTime } from "@/lib/format";
import { ApiError, type AdminIncidentDetail, type AlertInput, type IncidentSeverity, type MediaItem } from "@cendol/api-client";
import { ExternalLink, EyeOff, ImagePlus, Loader2, MapPin, Radio, Save, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { IncidentTypeIcon, LiveAlertBadge, SeverityBadge } from "./incident-badges";
import { useIncidentMutation } from "./use-incident-action";

type Result = { message: string; data: AdminIncidentDetail };

/** The public alert: staff-written text, publish or take down, blurred photos and a preview card. */
export function IncidentAlert({ incident: i }: { incident: AdminIncidentDetail }) {
  const confirm = useConfirm();
  const { run, busy } = useIncidentMutation(i.ref);
  const [title, setTitle] = useState(i.alert.title ?? "");
  const [summary, setSummary] = useState(i.alert.summary ?? "");
  const [place, setPlace] = useState(i.alert.place ?? "");
  const [severity, setSeverity] = useState<IncidentSeverity>(i.severity);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<MediaItem[]>(i.alert.photos);
  const [alt, setAlt] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  if (i.status !== "verified" && i.status !== "closed") {
    return (
      <section className="incident-alert-unavailable panel-card flex flex-col items-start gap-3">
        <h2 className="panel-card-title">No alert yet</h2>
        <p className="text-sm text-muted-foreground">
          Public alerts are written after a report is verified. {i.status === "new" || i.status === "needs_info" || i.status === "investigating" ? "Decide this report first; you can publish the alert in the same step." : "This report was not verified, so it can't have an alert."}
        </p>
        {i.status === "new" || i.status === "needs_info" || i.status === "investigating" ? (
          <Button asChild>
            <Link href={incidentUrl(i.ref, "decide")}>Go to Decide</Link>
          </Button>
        ) : null}
      </section>
    );
  }

  const published = Boolean(i.alert.published_at);
  const resolved = i.status === "closed";

  const save = (input: AlertInput, key: string) =>
    run(key, () => api.put<Result>(`admin/incidents/${i.ref}/alert`, input), (error) => {
      if (error instanceof ApiError) {
        if (error.code === "ALERT_TEXT_NEEDED") setErrors({ public_title: error.message });
        else setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])));
      }
    });

  const text = (): AlertInput => ({ public_title: title.trim() || null, public_summary: summary.trim() || null, public_address: place.trim() || null, severity });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    await save(text(), "save");
  }

  async function publish() {
    if (!title.trim() || !summary.trim()) {
      setErrors({ ...(title.trim() ? {} : { public_title: "Please write the alert title." }), ...(summary.trim() ? {} : { public_summary: "Please write what people should know." }) });
      return;
    }
    const ok = await confirm({
      title: "Publish this alert?",
      description: "It appears on the public site and the alerts map straight away, with the text and photos below.",
      confirmLabel: "Publish",
    });
    if (ok) await save({ ...text(), published: true }, "publish");
  }

  async function takeDown() {
    const ok = await confirm({
      title: "Take this alert off the site?",
      description: "Its page and map pin disappear. The report stays verified and you can publish it again.",
      confirmLabel: "Take down",
      danger: true,
    });
    if (ok) await save({ published: false }, "takedown");
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const saved = await run("photo", () => api.upload<Result>(`admin/incidents/${i.ref}/photos`, { photo: file, alt: alt.trim() || undefined }));
      if (saved) setPhotos(saved.alert.photos);
    }
    setAlt("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function reorder(items: MediaItem[]) {
    setPhotos(items);
    const saved = await run("order", () => api.put<Result>(`admin/incidents/${i.ref}/photos/order`, { ids: items.map((p) => p.id) }));
    if (!saved) setPhotos(i.alert.photos);
  }

  async function remove(photo: MediaItem) {
    if (!(await confirm({ title: "Remove this photo from the alert?", description: "It is deleted from the public page. The original evidence is not affected.", confirmLabel: "Remove", danger: true }))) return;
    const saved = await run("remove", () => api.delete<Result>(`admin/incidents/${i.ref}/photos/${photo.id}`));
    if (saved) setPhotos(saved.alert.photos);
  }

  return (
    <div className="incident-alert grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <form className="incident-alert-form panel-card flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="panel-card-title">Alert text</h2>
              <p className="panel-card-description">
                {published
                  ? `On the site since ${formatDateTime(i.alert.published_at)}${resolved ? `, marked resolved ${formatDateTime(i.alert.resolved_at)}` : ""}.`
                  : "Not on the site. Write the text, then publish."}
              </p>
            </div>
            {published ? <LiveAlertBadge resolved={resolved} /> : null}
          </div>
          <div className="incident-alert-rules flex gap-2 rounded-lg bg-marigold-50 p-3 text-sm dark:bg-marigold-900/40">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>The reporter&apos;s own words are never shown publicly. Describe the event, not who is to blame: no names, number plates or accusations.</p>
          </div>
          <FormField id="alert-edit-title" label="Public title" error={errors.public_title}>
            <Input id="alert-edit-title" value={title} maxLength={150} onChange={(e) => {
                      setTitle(e.target.value);
                      setErrors((e) => ({ ...e, public_title: "" }));
                    }} aria-invalid={Boolean(errors.public_title)} />
          </FormField>
          <FormField id="alert-edit-summary" label="What people should know" error={errors.public_summary} hint="What happened, where, and what to do.">
            <Textarea id="alert-edit-summary" rows={5} value={summary} maxLength={3000} onChange={(e) => {
                      setSummary(e.target.value);
                      setErrors((e) => ({ ...e, public_summary: "" }));
                    }} aria-invalid={Boolean(errors.public_summary)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="alert-edit-place" label="Place name" error={errors.public_address} hint="A street or landmark, not a house number.">
              <Input id="alert-edit-place" value={place} maxLength={200} onChange={(e) => setPlace(e.target.value)} />
            </FormField>
            <FormField id="alert-edit-severity" label="Severity" hint={SEVERITY[severity].hint}>
              <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                <SelectTrigger id="alert-edit-severity" className="w-full">
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
          </div>
          <div className="incident-alert-actions flex flex-wrap justify-end gap-2">
            {published ? (
              <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={busy !== null} onClick={takeDown}>
                {busy === "takedown" ? <Loader2 className="animate-spin" /> : <EyeOff />}
                Take down
              </Button>
            ) : null}
            <Button type="submit" variant={published ? "default" : "outline"} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
              Save text
            </Button>
            {!published ? (
              <Button type="button" disabled={busy !== null} onClick={publish}>
                {busy === "publish" ? <Loader2 className="animate-spin" /> : <Radio />}
                Publish
              </Button>
            ) : null}
          </div>
        </form>

        <section className="incident-alert-photos panel-card flex flex-col gap-3" aria-labelledby="alert-photos-title">
          <div>
            <h2 id="alert-photos-title" className="panel-card-title">
              Public photos
            </h2>
            <p className="panel-card-description">
              Upload copies you have already blurred outside the system: faces, number plates and anything personal. Originals are never published. The first photo is the
              cover; drag to change the order.
            </p>
          </div>
          <div className="incident-alert-upload flex flex-wrap items-end gap-2">
            <FormField id="alert-photo-alt" label="Describe the photo (for screen readers)" className="min-w-0 flex-1 basis-56">
              <Input id="alert-photo-alt" value={alt} maxLength={200} placeholder="e.g. Flood water covering the road" onChange={(e) => setAlt(e.target.value)} />
            </FormField>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
              {busy === "photo" ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              Add blurred photo
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a blurred photo"
              onChange={(e) => upload(e.target.files)}
            />
          </div>
          {photos.length ? (
            <SortableList
              items={photos}
              getId={(p) => p.id}
              handleLabel={(p) => `Move photo ${photos.indexOf(p) + 1}`}
              onReorder={reorder}
              renderItem={(p) => (
                <div className="alert-photo-row flex items-center gap-3 py-2 pr-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API's media folder */}
                  <img src={p.thumb ?? ""} alt={p.alt || "Alert photo"} className="alert-photo-thumb h-16 w-24 shrink-0 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 text-sm">
                    {photos.indexOf(p) === 0 ? <span className="font-medium">Cover · </span> : null}
                    <span className="text-muted-foreground">{p.alt || "No description"}</span>
                  </span>
                  <IconAction icon={Trash2} label="Remove this photo" danger onClick={() => remove(p)} />
                </div>
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No photos. The alert shows the type icon instead.</p>
          )}
        </section>
      </div>

      <aside className="incident-alert-preview flex flex-col gap-3 lg:sticky lg:top-20" aria-label="Preview">
        <h2 className="text-sm font-medium text-muted-foreground">How it looks on the site</h2>
        <article className="alert-preview-card overflow-hidden rounded-xl border bg-card shadow-sm">
          {photos[0]?.card ? (
            // eslint-disable-next-line @next/next/no-img-element -- photos come from the API's media folder
            <img src={photos[0].card} alt={photos[0].alt || ""} className="alert-preview-cover aspect-video w-full object-cover" />
          ) : (
            <div className="alert-preview-cover grid aspect-video w-full place-items-center bg-muted">
              <IncidentTypeIcon type={i.type} />
            </div>
          )}
          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeverityBadge severity={severity} />
              {resolved ? <LiveAlertBadge resolved /> : null}
              {i.type ? <span className="text-xs text-muted-foreground">{i.type.name}</span> : null}
            </div>
            <h3 className="font-heading leading-snug font-bold">{title || "Your title"}</h3>
            <p className="line-clamp-4 text-sm text-muted-foreground">{summary || "What people should know appears here."}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              {place || i.area?.name || "Melaka"}
            </p>
          </div>
        </article>
        {published ? (
          <Button variant="outline" asChild>
            <a href={publicAlertUrl(i.ref)} target="_blank" rel="noopener">
              <ExternalLink />
              Open the public page
            </a>
          </Button>
        ) : null}
      </aside>
    </div>
  );
}
