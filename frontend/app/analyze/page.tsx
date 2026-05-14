import Link from "next/link";
import { Spade, BarChart2, Trophy, Puzzle, ArrowRight, Lock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const TOOLS = [
  {
    href: "/analyze/hand",
    icon: Spade,
    title: "Hand Analysis",
    description: "Analyze a single hand and get street-by-street AI coaching on every decision.",
    cta: "Analyze hand",
    accent: "violet",
    featured: false,
    locked: false,
  },
  {
    href: "/analyze/session",
    icon: BarChart2,
    title: "Session Analysis",
    description: "Upload an entire session and let AI find your most important spots to review.",
    cta: "Analyze session",
    accent: "blue",
    featured: true,
    locked: false,
  },
  {
    href: "/analyze/tournament",
    icon: Trophy,
    title: "Tournament Analysis",
    description: "Review tournament performance, key decisions, and late-stage strategic mistakes.",
    cta: "Analyze tournament",
    accent: "amber",
    featured: false,
    locked: false,
  },
  {
    href: "/analyze/puzzles",
    icon: Puzzle,
    title: "Puzzles",
    description: "Train with interactive poker scenarios, multi-street decisions, and live AI coaching.",
    cta: "Train now",
    accent: "violet",
    featured: false,
    locked: false,
  },
] as const;

const ACCENT_CLASSES = {
  violet: {
    icon: "bg-violet-500/15 text-violet-400",
    border: "border-violet-500/25 hover:border-violet-500/50",
    cta: "text-violet-400 group-hover:text-violet-300",
    glow: "hover:shadow-violet-500/10",
  },
  blue: {
    icon: "bg-blue-500/15 text-blue-400",
    border: "border-blue-500/30 hover:border-blue-500/60",
    cta: "text-blue-400 group-hover:text-blue-300",
    glow: "hover:shadow-blue-500/15",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-400",
    border: "border-amber-500/25 hover:border-amber-500/50",
    cta: "text-amber-400 group-hover:text-amber-300",
    glow: "hover:shadow-amber-500/10",
  },
  slate: {
    icon: "bg-slate-500/10 text-slate-500",
    border: "border-border/40",
    cta: "text-slate-500",
    glow: "",
  },
} as const;

export default function AnalyzeHubPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-20">
        {/* Header */}
        <div className="text-center mb-14 max-w-xl animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
            What do you want to study?
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Improve faster with AI-powered poker analysis tools.
          </p>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          {TOOLS.map((tool, i) => {
            const ac = ACCENT_CLASSES[tool.accent];
            const card = (
              <div
                className={`
                  group relative flex flex-col h-full rounded-2xl border bg-card/60
                  p-6 card-lift
                  ${ac.border}
                  ${tool.locked ? "opacity-60 cursor-not-allowed" : "hover:bg-card/80 hover:shadow-2xl " + ac.glow}
                  ${tool.featured ? "ring-1 ring-blue-500/20" : ""}
                `}
              >
                {/* Featured badge */}
                {tool.featured && (
                  <span className="absolute -top-px left-5 text-[10px] font-semibold tracking-widest uppercase px-2.5 py-0.5 rounded-b-md bg-blue-500/20 text-blue-400 border border-blue-500/20 border-t-0">
                    Core feature
                  </span>
                )}

                {/* Icon */}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform duration-200 group-hover:scale-110 ${ac.icon}`}>
                  <tool.icon className="h-5 w-5" />
                </div>

                <h2 className="text-base font-semibold text-foreground mb-1.5">{tool.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  {tool.description}
                </p>

                <div className={`flex items-center gap-1.5 text-sm font-medium ${ac.cta} transition-colors`}>
                  {tool.locked ? (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      {tool.cta}
                    </>
                  ) : (
                    <>
                      {tool.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </div>
              </div>
            );

            return tool.locked ? (
              <div key={tool.title} className="stagger-item" style={{ animationDelay: `${i * 70}ms` }}>{card}</div>
            ) : (
              <Link key={tool.title} href={tool.href} className="block h-full stagger-item" style={{ animationDelay: `${i * 70}ms` }}>
                {card}
              </Link>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
