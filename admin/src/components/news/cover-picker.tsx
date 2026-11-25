"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { MediaItem } from "@cendol/api-client";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

export interface CoverValue {
  media: MediaItem | null;
  alt: string;
  caption: string;
  credit: string;
}

/** Cover photo: upload, preview, and the words readers and screen readers need with it. */
export function CoverPicker({ value, onChange, altError, disabled }: { value: CoverValue; onChange: (v: CoverValue) => void; altError?: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const result = await api.upload<{ data: MediaItem }>("admin/news/media", { image: file, collection: "cover" });
      onChange({ ...value, media: result.data });
    } catch (error) {
      notify.error(error, "We couldn't upload that picture.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="cover-picker flex flex-col gap-4">
      {value.media ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded pictures come from the API's media folder
        <img src={value.media.card ?? ""} alt={value.alt || "Cover photo preview"} className="cover-picker-preview aspect-video w-full rounded-lg border object-cover" />
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          className="cover-picker-empty flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-pandan-400 hover:text-foreground"
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          {busy ? "Uploading…" : "Add a cover photo"}
          <span className="text-xs">JPG, PNG or WebP, at least 400 pixels wide</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a cover photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {value.media ? (
        <>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange({ media: null, alt: "", caption: "", credit: "" })}>
              <Trash2 />
              Remove
            </Button>
          </div>
          <FormField id="cover-alt" label="Describe the photo" error={altError} hint="For people using screen readers, e.g. “Flood water on Jalan Parameswara”.">
            <Input id="cover-alt" value={value.alt} disabled={disabled} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
          </FormField>
          <FormField id="cover-caption" label="Caption (optional)">
            <Input id="cover-caption" value={value.caption} disabled={disabled} onChange={(e) => onChange({ ...value, caption: e.target.value })} />
          </FormField>
          <FormField id="cover-credit" label="Photo credit (optional)" hint="Who took it. Only use photos you have permission to publish.">
            <Input id="cover-credit" value={value.credit} disabled={disabled} onChange={(e) => onChange({ ...value, credit: e.target.value })} />
          </FormField>
        </>
      ) : null}
    </div>
  );
}
