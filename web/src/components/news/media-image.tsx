import type { MediaItem } from "@cendol/api-client";

interface MediaImageProps {
  media: MediaItem;
  /** How wide the picture shows, so phones download the small copy. */
  sizes: string;
  className?: string;
  priority?: boolean;
}

/**
 * A picture from the API's media library. The API already made 480, 960 and 1600 pixel WebP copies,
 * so a plain <img srcset> is enough and works on cPanel without an image server.
 */
export function MediaImage({ media, sizes, className, priority }: MediaImageProps) {
  const srcSet = [
    media.thumb ? `${media.thumb} 480w` : null,
    media.card ? `${media.card} 960w` : null,
    media.large ? `${media.large} 1600w` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    // eslint-disable-next-line @next/next/no-img-element -- resized copies are made by the API (see comment above)
    <img
      src={media.card ?? media.large ?? media.thumb ?? ""}
      srcSet={srcSet}
      sizes={sizes}
      alt={media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

/** Shown where a story has no photo: a pattern in the category colour, never an empty grey box. */
export function ImagePlaceholder({ className }: { className?: string }) {
  return <div className={`image-placeholder bg-[repeating-linear-gradient(135deg,var(--color-marigold-100)_0_10px,var(--color-marigold-50)_10px_20px)] dark:bg-[repeating-linear-gradient(135deg,var(--color-gula-900)_0_10px,var(--color-gula-950)_10px_20px)] ${className ?? ""}`} aria-hidden />;
}
