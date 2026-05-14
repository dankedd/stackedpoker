"use client";

import { Star } from "lucide-react";
import { useInView } from "@/hooks/useInView";

const TESTIMONIALS = [
  {
    quote:
      "Spotted a major leak in my flop c-bet sizing within the first session. The AI explained exactly why my line was exploitable — paid for itself the first week of grinding.",
    name: "Mark V.",
    role: "Cash game regular",
    stakes: "NL100 · 6-max",
    avatar: "M",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    quote:
      "The coaching doesn't just flag mistakes — it explains range dynamics, why the board texture matters, and what adjustment to make next time. Actually useful.",
    name: "Sophie L.",
    role: "MTT player",
    stakes: "MTT · $50–200 buyins",
    avatar: "S",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    quote:
      "The replay feature is what sold me. Stepping through streets and seeing exactly where I went wrong visually — that's how I actually learn. Nothing else has this.",
    name: "Tom B.",
    role: "Micro-stakes grinder",
    stakes: "NL25 · Full ring",
    avatar: "T",
    gradient: "from-emerald-500 to-teal-600",
  },
];

export function Testimonials() {
  const { ref: headerRef, visible: headerVisible } = useInView();
  const { ref: gridRef, visible: gridVisible } = useInView();

  return (
    <section id="testimonials" className="relative bg-background py-24 sm:py-32 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-violet-600/5 blur-[110px]"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div
          ref={headerRef}
          className={`mx-auto mb-14 max-w-2xl text-center scroll-reveal ${headerVisible ? "visible" : ""}`}
        >
          <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] text-muted-foreground">
            Player reviews
          </div>
          <h2 className="mb-4 text-4xl sm:text-[3.25rem] font-black text-foreground tracking-tight leading-[1.05]">
            Trusted by players{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400 animate-gradient">
              who care about EV
            </span>
          </h2>
          <p className="text-muted-foreground/65 text-lg leading-relaxed">
            From micro-stakes newcomers to serious cash game grinders.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className={`group rounded-2xl border border-border/50 bg-card/60 p-7 card-lift hover:border-border/80 hover:bg-card/80 scroll-reveal scroll-delay-${i + 1} ${gridVisible ? "visible" : ""}`}
            >
              {/* Stars */}
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="mb-6 text-[14px] text-muted-foreground/80 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white bg-gradient-to-br ${t.gradient}`}>
                  {t.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground/50">{t.role}</p>
                </div>
                <div className="ml-auto shrink-0">
                  <span className="text-[10px] font-mono text-muted-foreground/35 bg-secondary/60 rounded-md px-2 py-0.5 border border-border/30 whitespace-nowrap">
                    {t.stakes}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
