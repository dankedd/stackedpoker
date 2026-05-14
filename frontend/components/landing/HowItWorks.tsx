import Link from "next/link";
import { ArrowRight, ClipboardPaste, Cpu, MessageSquare } from "lucide-react";

const steps = [
  {
    icon: ClipboardPaste,
    title: "Paste your hand",
    description:
      "Copy a hand history from GGPoker or PokerStars. All standard export formats are supported automatically — no reformatting needed.",
    iconCls: "text-violet-400",
    iconBg: "bg-violet-500/12",
    iconRing: "ring-1 ring-violet-500/25 shadow-lg shadow-violet-500/15",
    num: "01",
    numCls: "text-violet-500/20",
  },
  {
    icon: Cpu,
    title: "Instant analysis",
    description:
      "The engine classifies the spot, evaluates board texture, runs GTO-inspired heuristics, and flags every suboptimal decision — in under 5 seconds.",
    iconCls: "text-blue-400",
    iconBg: "bg-blue-500/12",
    iconRing: "ring-1 ring-blue-500/25 shadow-lg shadow-blue-500/15",
    num: "02",
    numCls: "text-blue-500/20",
  },
  {
    icon: MessageSquare,
    title: "Receive coaching",
    description:
      "Claude explains every finding in plain language — range dynamics, position theory, sizing rationale. Know exactly what to change and why.",
    iconCls: "text-emerald-400",
    iconBg: "bg-emerald-500/12",
    iconRing: "ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-500/15",
    num: "03",
    numCls: "text-emerald-500/20",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-background py-24 sm:py-32 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-blue-600/6 blur-[120px]"
      />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] text-muted-foreground">
            How it works
          </div>
          <h2 className="mb-5 text-4xl font-black tracking-tight text-foreground sm:text-[3.25rem] leading-[1.05]">
            Three steps to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              better decisions
            </span>
          </h2>
          <p className="text-muted-foreground/65 text-lg">
            From hand history to expert coaching in under 10 seconds.
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-border/50 bg-card/60 p-8 hover:border-border/80 hover:bg-card/80 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Step number — watermark */}
              <span
                className={`absolute top-5 right-5 text-4xl font-black select-none tabular-nums leading-none ${step.numCls}`}
              >
                {step.num}
              </span>

              {/* Icon */}
              <div
                className={`mb-7 flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconBg} ${step.iconRing}`}
              >
                <step.icon className={`h-6 w-6 ${step.iconCls}`} />
              </div>

              <h3 className="mb-3 text-[17px] font-bold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground/65 leading-relaxed">
                {step.description}
              </p>

              {/* Arrow connector between cards (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-[3.25rem] -right-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-background border border-border/50 shadow-sm">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
          >
            Try it now — free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
