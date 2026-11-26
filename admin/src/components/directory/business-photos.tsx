"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { BusinessFull, MediaItem, MessageResponse } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

/** Logo and gallery. Photos are resized to small WebP copies by the server; drag to set the order. */
export function BusinessPhotos({ business }: { business: BusinessFull }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"logo" | "gallery" | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>(business.photos);
  const key = ["directory-business", business.id];

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  async function upload(files: FileList | null, collection: "logo" | "gallery") {
    if (!files?.length) return;
    setBusy(collection);
    let added = 0;
    for (const file of Array.from(collection === "logo" ? [files[0]] : files)) {
      try {
        const result = await api.upload<{ message: string; data: MediaItem }>(`admin/directory/businesses/${business.id}/photos`, { photo: file, collection });
        if (collection === "gallery") setPhotos((p) => [...p, result.data]);
        added++;
      } catch (error) {
        notify.error(error, `We couldn't upload ${file.name}.`);
      }
    }
    if (added) notify.success(collection === "logo" ? "Logo updated." : added === 1 ? "Photo added." : `${added} photos added.`);
    setBusy(null);
    if (logoInput.current) logoInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
    await refresh();
  }

  async function remove(media: MediaItem, what: string) {
    if (!(await confirm({ title: `Remove this ${what}?`, description: "It is deleted from the place page.", confirmLabel: "Remove", danger: true }))) return;
    try {
      notify.success((await api.delete<MessageResponse>(`admin/directory/businesses/${business.id}/photos/${media.id}`)).message);
      setPhotos((p) => p.filter((x) => x.id !== media.id));
      await refresh();
    } catch (error) {
      notify.error(error);
    }
  }

  async function reorder(items: MediaItem[]) {
    setPhotos(items);
    try {
      notify.success((await api.put<MessageResponse>(`admin/directory/businesses/${business.id}/photos/order`, { ids: items.map((m) => m.id) })).message);
      await refresh();
    } catch (error) {
      notify.error(error);
      setPhotos(business.photos);
    }
  }

  return (
    <div className="business-photos grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <section className="business-logo panel-card flex flex-col gap-3" aria-labelledby="business-logo-title">
        <h2 id="business-logo-title" className="panel-card-title">
          Logo
        </h2>
        {business.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- pictures come from the API's media folder
          <img src={business.logo.card ?? ""} alt={`${business.name} logo`} className="business-logo-preview aspect-square w-40 rounded-xl border object-cover" />
        ) : (
          <p className="text-sm text-muted-foreground">No logo yet. Cards show the sector icon instead.</p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => logoInput.current?.click()}>
            {busy === "logo" ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {business.logo ? "Change logo" : "Add logo"}
          </Button>
          {business.logo ? <IconAction icon={Trash2} label="Remove the logo" danger onClick={() => remove(business.logo!, "logo")} /> : null}
        </div>
        <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Choose a logo" onChange={(e) => upload(e.target.files, "logo")} />
      </section>

      <section className="business-gallery panel-card flex flex-col gap-3" aria-labelledby="business-gallery-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="business-gallery-title" className="panel-card-title">
              Photos
            </h2>
            <p className="panel-card-description">The first photo is the one on cards and the map. Up to 20.</p>
          </div>
          <Button type="button" disabled={busy !== null || photos.length >= 20} onClick={() => galleryInput.current?.click()}>
            {busy === "gallery" ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            Add photos
          </Button>
          <input
            ref={galleryInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose photos"
            onChange={(e) => upload(e.target.files, "gallery")}
          />
        </div>
        {photos.length ? (
          <SortableList
            items={photos}
            getId={(m) => m.id}
            handleLabel={(m) => `Move photo ${photos.indexOf(m) + 1}`}
            onReorder={reorder}
            renderItem={(m) => (
              <div className="gallery-row flex items-center gap-3 py-2 pr-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- pictures come from the API's media folder */}
                <img src={m.thumb ?? ""} alt={m.alt || "Place photo"} className="gallery-thumb h-16 w-24 shrink-0 rounded-md object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {photos.indexOf(m) === 0 ? "Cover photo · " : ""}
                  {m.width && m.height ? `${m.width} × ${m.height}` : "Photo"}
                </span>
                <IconAction icon={Trash2} label="Remove this photo" danger onClick={() => remove(m, "photo")} />
              </div>
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="gallery-empty flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-pandan-400 hover:text-foreground"
          >
            <ImagePlus className="size-6" />
            Add the first photos
          </button>
        )}
      </section>
    </div>
  );
}
