import Link from "next/link";
import { ArrowRight, Spade } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-[#070B14]">
      {/* Radial gradient centred behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(109,40,217,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
        {/* Icon */}
        <div
          className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(79,70,229,0.12) 100%)",
            border: "1px solid rgba(124,58,237,0.25)",
          }}
        >
          <Spade className="h-6 w-6 text-violet-400" />
        </div>

        <h2 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
          Ready to play your best poker?
        </h2>

        <p className="mx-auto mb-10 max-w-xl text-lg text-slate-400 leading-relaxed">
          Start for free today. No credit card required. Get your first
          three analyses on us and see the difference for yourself.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
              boxShadow: "0 8px 32px rgba(109,40,217,0.35)",
            }}
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-[15px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            Try without account
          </Link>
        </div>

        <p className="mt-7 text-sm text-slate-600">
          Free plan · 3 analyses included · No card required
        </p>
      </div>
    </section>
  );
}
