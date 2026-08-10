import Image from "next/image";

/**
 * Image wrapper for content pages (§11).
 *
 * Enforces, at the type level, the four things image SEO actually depends on
 * and that are easy to forget on a hand-written `<img>`:
 *
 *  - `alt` is REQUIRED and cannot be an empty string — decorative images do
 *    not belong in an article body, and a missing alt is both an
 *    accessibility failure (§22) and a lost ranking signal in Google Images.
 *  - `width`/`height` are required, so the browser reserves the box and the
 *    page does not shift as images load (a Core Web Vitals input, §19).
 *  - loading is lazy unless the image is explicitly `priority`, so only a
 *    genuine LCP candidate competes with the initial render.
 *  - an optional `<figcaption>`: caption text sits next to the image in the
 *    DOM, which is how both Google Images and multimodal crawlers work out
 *    what a diagram depicts.
 */
export function SeoImage({
  src,
  alt,
  width,
  height,
  caption,
  priority = false,
  className = "",
  sizes = "(min-width: 768px) 720px, 100vw",
}: {
  src: string;
  /** Describe the content, not the file. Required — never decorative here. */
  alt: string;
  width: number;
  height: number;
  caption?: string;
  /** True only for an above-the-fold hero image. */
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const image = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      className={`h-auto w-full rounded-xl border border-border/60 ${className}`}
    />
  );

  if (!caption) return image;

  return (
    <figure className="my-6">
      {image}
      <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
