/**
 * Testimonials for the homepage and /pricing — edit them here, nowhere else.
 *
 * Entries with `placeholder: true` are NOT shown on the live site: they
 * only render in development (`npm run dev`), with a visible "Placeholder"
 * badge, so a made-up quote can never go live by accident. To publish one,
 * replace the text with a real quote (with the person's permission) and set
 * `placeholder` to false. With no publishable entries the section is hidden.
 */

export interface Testimonial {
  quote: string;
  name: string;
  /** Short context, e.g. "MTT player, Amsterdam". Optional. */
  detail?: string;
  placeholder: boolean;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "PLACEHOLDER: replace with a real quote from a player about the Preflop Trainer.",
    name: "PLACEHOLDER Name",
    detail: "PLACEHOLDER: e.g. MTT player",
    placeholder: true,
  },
  {
    quote: "PLACEHOLDER: replace with a real quote from a player about Hand Review or the Flop Trainer.",
    name: "PLACEHOLDER Name",
    detail: "PLACEHOLDER: e.g. Cash game regular",
    placeholder: true,
  },
];

/** What may render in this build: real entries always, placeholders only in development. */
export function visibleTestimonials(all: Testimonial[] = TESTIMONIALS, env = process.env.NODE_ENV): Testimonial[] {
  return all.filter((t) => !t.placeholder || env === "development");
}
