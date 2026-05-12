import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative bg-[#F5F6FA] overflow-hidden pt-36 pb-24 sm:pt-44 sm:pb-32">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 -left-24 w-[700px] h-[700px] rounded-full bg-violet-200/35 blur-[120px]" />
        <div className="absolute -bottom-32 -right-24 w-[600px] h-[600px] rounded-full bg-blue-200/30 blur-[120px]" />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(100,116,139,0.18) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F5F6FA]/60 via-transparent to-[#F5F6FA]" />

      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white px-4 py-1.5 text-sm text-violet-700 shadow-sm shadow-violet-100/60">
          <Sparkles className="h-3.5 w-3.5" />
          GTO-inspired analysis · AI coaching included
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.05] sm:text-7xl lg:text-[86px]">
          Stop guessing.{" "}
          <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-blue-500 to-violet-500">
            Start winning.
          </span>
        </h1>

        {/* Subheading */}
        <p className="mx-auto mb-10 max-w-xl text-lg text-slate-500 leading-relaxed sm:text-xl">
          Paste any hand history from GGPoker or PokerStars. Get instant solver-inspired
          analysis, board texture breakdowns, and AI coaching in seconds.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
          >
            Analyze your hand — free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[15px] font-semibold hover:border-slate-300 hover:bg-slate-50/80 hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
          >
            See how it works
          </Link>
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 mb-16">
          {[
            { color: "bg-emerald-400", label: "GGPoker & PokerStars" },
            { color: "bg-violet-400", label: "GTO-inspired heuristics" },
            { color: "bg-blue-400", label: "AI coaching included" },
            { color: "bg-amber-400", label: "Free to start" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Mock UI preview */}
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/25 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-400/70" />
                <div className="h-3 w-3 rounded-full bg-amber-400/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-400/70" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="text-[11px] text-slate-300 font-mono">stacked.poker / analyze</div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 text-left space-y-3">
              {[
                { icon: "✓", cls: "text-emerald-500", text: "Hand parsed: BTN vs BB — Single Raised Pot" },
                { icon: "✓", cls: "text-emerald-500", text: "Board: A♦ 7♣ 2♠ — A-high dry (rainbow)" },
                { icon: "△", cls: "text-amber-500", text: "Flop c-bet 75% pot — recommend 25-33% sizing", bold: true },
                { icon: "ℹ", cls: "text-blue-500", text: "Range advantage: PFR has strong equity edge on this texture" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 font-mono text-xs">
                  <span className={`font-bold ${row.cls} flex-shrink-0`}>{row.icon}</span>
                  <span className={row.bold ? "text-slate-700 font-semibold" : "text-slate-500"}>{row.text}</span>
                </div>
              ))}

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">💬 AI Coach: On dry ace-high boards…</span>
                <div className="flex-shrink-0 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                  <span className="text-amber-600 text-[11px] font-semibold">Score 72 / 100</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
