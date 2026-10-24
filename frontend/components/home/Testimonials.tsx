import { Quote } from "lucide-react";
import { visibleTestimonials } from "@/lib/home/testimonials";

/** "What players say" — entries from lib/home/testimonials.ts; hidden when there are none. */
export function Testimonials() {
  const items = visibleTestimonials();
  if (!items.length) return null;
  return (
    <section aria-labelledby="testimonials-title" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h2 id="testimonials-title" className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
        What players say
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((t, n) => (
          <figure key={n} className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            {t.placeholder && (
              <span className="absolute right-4 top-4 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                Placeholder
              </span>
            )}
            <Quote aria-hidden className="h-5 w-5 text-violet-300" />
            <blockquote className="mt-3 text-[15px] leading-relaxed text-white/85">{t.quote}</blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-semibold text-white">{t.name}</span>
              {t.detail && <span className="text-white/50"> · {t.detail}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
