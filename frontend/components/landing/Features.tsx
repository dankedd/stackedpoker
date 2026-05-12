import { Brain, BarChart3, Map, Layers, Zap, BookOpen } from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Hand Parser",
    description: "Automatic detection and parsing of GGPoker and PokerStars hand histories into a normalized data structure.",
    iconCls: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Map,
    title: "Board Texture Analysis",
    description: "Classifies boards: A-high dry, wet broadway, low connected, monotone, paired. Know your equity edge instantly.",
    iconCls: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Layers,
    title: "Spot Classification",
    description: "Identifies SRP vs 3-bet pots, position matchups, and effective stack depth for precise recommendations.",
    iconCls: "text-sky-400",
    iconBg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: Zap,
    title: "Heuristic Engine",
    description: "GTO-inspired rules evaluate your c-bet sizing, frequency, and line choices against solver benchmarks.",
    iconCls: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Brain,
    title: "AI Coaching",
    description: "GPT-4o explains the WHY behind every recommendation in plain, educational language you can apply immediately.",
    iconCls: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: BookOpen,
    title: "Range Education",
    description: "Learn range advantage, position theory, and sizing principles through concrete examples from your own hands.",
    iconCls: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/20",
  },
];

export function Features() {
  return (
    <section id="features" className="relative bg-secondary/20 py-24 sm:py-32 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-violet-600/7 blur-[130px]"
      />

      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-muted-foreground">
            Features
          </div>
          <h2 className="mb-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Everything you need to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              level up
            </span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            From raw hand history to actionable coaching in seconds. No solver required.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/50 bg-card/60 p-6 hover:border-border/80 hover:bg-card/80 transition-all duration-300"
            >
              <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${f.iconBg}`}>
                <f.icon className={`h-5 w-5 ${f.iconCls}`} />
              </div>
              <h3 className="mb-2.5 text-[15px] font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
