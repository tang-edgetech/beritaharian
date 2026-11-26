"use client";

import { errorMessage, FormMessage } from "@/components/account/auth-ui";
import { MediaImage } from "@/components/news/media-image";
import { readerApi } from "@/lib/auth";
import type { BusinessFull, MediaItem } from "@cendol/api-client";
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useState, type DragEvent } from "react";

/** Logo and gallery. Photos are reordered by dragging (or the arrow buttons), and removing one asks first. */
export function PhotosPanel({ place, onChanged }: { place: BusinessFull; onChanged: () => void }) {
  const [photos, setPhotos] = useState<MediaItem[]>(place.photos);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function upload(files: FileList | null, collection: "logo" | "gallery") {
    if (!files?.length) return;
    setBusy(collection);
    setMessage(null);
    try {
      let last = "";
      for (const file of Array.from(files).slice(0, collection === "logo" ? 1 : 10)) {
        const r = await readerApi.upload<{ message: string; data: MediaItem }>(`me/businesses/${place.id}/photos`, { photo: file, collection });
        last = r.message;
        if (collection === "gallery") setPhotos((p) => [...p, r.data]);
      }
      setMessage({ tone: "success", text: last });
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const r = await readerApi.delete<{ message: string }>(`me/businesses/${place.id}/photos/${id}`);
      setPhotos((p) => p.filter((x) => x.id !== id));
      setConfirming(null);
      setMessage({ tone: "success", text: r.message });
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function saveOrder(next: MediaItem[]) {
    const before = photos;
    setPhotos(next);
    try {
      await readerApi.put(`me/businesses/${place.id}/photos/order`, { ids: next.map((p) => p.id) });
      setMessage({ tone: "success", text: "New order saved." });
    } catch (error) {
      setPhotos(before);
      setMessage({ tone: "error", text: errorMessage(error) });
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void saveOrder(next);
  }

  function onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    if (!dragging || dragging === targetId) return;
    move(
      photos.findIndex((p) => p.id === dragging),
      photos.findIndex((p) => p.id === targetId),
    );
    setDragging(null);
  }

  return (
    <div className="photos-panel flex flex-col gap-8">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <section className="logo-section flex flex-col gap-3" aria-labelledby="logo-title">
        <h2 id="logo-title" className="font-display text-lg font-black">
          Logo
        </h2>
        <div className="flex items-center gap-4">
          {place.logo ? <MediaImage media={place.logo} sizes="96px" className="size-24 rounded-xl border border-santan-200 object-cover dark:border-santan-800" /> : <div className="size-24 rounded-xl bg-santan-100 dark:bg-santan-800" aria-hidden />}
          <UploadButton id="logo-upload" label={place.logo ? "Change logo" : "Add logo"} busy={busy === "logo"} onFiles={(f) => upload(f, "logo")} />
        </div>
      </section>

      <section className="gallery-section flex flex-col gap-3" aria-labelledby="gallery-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gallery-title" className="font-display text-lg font-black">
            Photos ({photos.length} of 20)
          </h2>
          <UploadButton id="gallery-upload" label="Add photos" multiple busy={busy === "gallery"} onFiles={(f) => upload(f, "gallery")} />
        </div>
        <p className="text-sm text-santan-600 dark:text-santan-300">The first photo is the big one on your page. Drag photos to change the order.</p>
        {photos.length ? (
          <ul className="gallery-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, i) => (
              <li
                key={photo.id}
                draggable
                onDragStart={() => setDragging(photo.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, photo.id)}
                className={`gallery-item flex flex-col gap-2 rounded-xl border bg-white p-2 dark:bg-santan-900 ${dragging === photo.id ? "is-dragging border-pandan-500 opacity-60" : "border-santan-200 dark:border-santan-800"}`}
              >
                <div className="relative">
                  <MediaImage media={photo} sizes="(min-width: 640px) 30vw, 45vw" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  {i === 0 ? <span className="absolute top-1.5 left-1.5 rounded-full bg-gula-900 px-2 py-0.5 text-xs font-bold text-coconut">Main photo</span> : null}
                </div>
                {confirming === photo.id ? (
                  <div className="flex flex-col gap-2 text-sm" role="alertdialog" aria-label="Remove this photo?">
                    <span className="font-semibold">Remove this photo?</span>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => remove(photo.id)} disabled={busy === photo.id} className="inline-flex h-8 items-center gap-1 rounded-full bg-red-700 px-3 text-xs font-bold text-white disabled:opacity-60">
                        {busy === photo.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                        Remove
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold hover:bg-santan-100 dark:hover:bg-santan-800">
                        Keep
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <GripVertical className="size-4 cursor-grab text-santan-400" aria-hidden />
                    <IconButton label="Move earlier" onClick={() => move(i, i - 1)} disabled={i === 0}>
                      <ArrowUp className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton label="Move later" onClick={() => move(i, i + 1)} disabled={i === photos.length - 1}>
                      <ArrowDown className="size-4" aria-hidden />
                    </IconButton>
                    <span className="flex-1" />
                    <IconButton label="Remove this photo" onClick={() => setConfirming(photo.id)}>
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card bg-santan-100 p-5 text-santan-600 dark:bg-santan-900 dark:text-santan-300">No photos yet. Places with photos get far more visits.</p>
        )}
      </section>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-santan-100 disabled:opacity-30 dark:hover:bg-santan-800">
      {children}
    </button>
  );
}

function UploadButton({ id, label, multiple = false, busy, onFiles }: { id: string; label: string; multiple?: boolean; busy: boolean; onFiles: (files: FileList | null) => void }) {
  return (
    // the input sits inside its label (no htmlFor): Next keeps hidden copies of visited pages, so ids can repeat
    <label className="upload-button inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut focus-within:ring-2 focus-within:ring-pandan-400 hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
      {label}
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
