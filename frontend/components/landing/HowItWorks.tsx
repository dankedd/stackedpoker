import Link from "next/link";
import { ArrowRight, ClipboardPaste, Cpu, MessageSquare } from "lucide-react";

const steps = [
  {
    icon: ClipboardPaste,
    title: "Paste Your Hand",
    description: "Copy your hand history from GGPoker or PokerStars and paste it in. All standard formats are supported automatically.",
    iconCls: "text-violet-500",
    iconBg: "bg-white border-violet-200",
    badge: "bg-violet-600",
  },
  {
    icon: Cpu,
    title: "Instant Analysis",
    description: "Our engine parses the hand, classifies the spot, evaluates board texture, and runs heuristic rules based on GTO theory.",
    iconCls: "text-blue-500",
    iconBg: "bg-white border-blue-200",
    badge: "bg-blue-600",
  },
  {
    icon: MessageSquare,
    title: "AI Coaching",
    description: "Receive personalized coaching explaining range dynamics, board texture, and the exact adjustments to make going forward.",
    iconCls: "text-emerald-500",
    iconBg: "bg-white border-emerald-200",
    badge: "bg-emerald-600",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24 sm:py-32">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-500">
            How it works
          </div>
          <h2 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Three steps to better play
          </h2>
          <p className="text-slate-500 text-lg">
            From hand history to expert coaching in under 10 seconds.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-3xl border border-slate-100 bg-[#F5F6FA] p-8 shadow-sm"
            >
              {/* Arrow connector */}
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-14 right-0 translate-x-1/2 z-10 items-center justify-center h-8 w-8 rounded-full bg-white border border-slate-200 shadow-sm">
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                </div>
              )}

              <div className="flex items-start gap-4 mb-6">
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border ${step.iconBg} shadow-sm`}>
                  <step.icon className={`h-6 w-6 ${step.iconCls}`} />
                </div>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white flex-shrink-0 mt-0.5 ${step.badge}`}>
                  {i + 1}
                </div>
              </div>

              <h3 className="mb-3 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[15px] font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            Try it now — free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
