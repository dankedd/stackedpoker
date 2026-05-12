import Link from "next/link";
import { ArrowRight, ClipboardPaste, Cpu, MessageSquare } from "lucide-react";

const steps = [
  {
    icon: ClipboardPaste,
    title: "Paste Your Hand",
    description: "Copy your hand history from GGPoker or PokerStars and paste it in. All standard formats are supported automatically.",
    iconCls: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    num: "01",
    numColor: "text-violet-500/40",
  },
  {
    icon: Cpu,
    title: "Instant Analysis",
    description: "Our engine parses the hand, classifies the spot, evaluates board texture, and runs heuristic rules based on GTO theory.",
    iconCls: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    num: "02",
    numColor: "text-blue-500/40",
  },
  {
    icon: MessageSquare,
    title: "AI Coaching",
    description: "Receive personalized coaching explaining range dynamics, board texture, and the exact adjustments to make going forward.",
    iconCls: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    num: "03",
    numColor: "text-emerald-500/40",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-background py-24 sm:py-32 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-blue-600/5 blur-[110px]"
      />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-muted-foreground">
            How it works
          </div>
          <h2 className="mb-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Three steps to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              better play
            </span>
          </h2>
          <p className="text-muted-foreground text-lg">
            From hand history to expert coaching in under 10 seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-border/50 bg-card/60 p-8 hover:border-border/80 hover:bg-card/80 transition-all duration-300"
            >
              {/* Arrow connector (desktop only) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-3 z-10">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/25" />
                </div>
              )}

              <div className="flex items-start justify-between mb-6">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${step.iconBg}`}>
                  <step.icon className={`h-5 w-5 ${step.iconCls}`} />
                </div>
                <span className={`text-4xl font-black leading-none ${step.numColor} select-none`}>
                  {step.num}
                </span>
              </div>

              <h3 className="mb-3 text-[15px] font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
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
