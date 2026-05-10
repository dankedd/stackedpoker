import { Brain, BarChart3, Map, Layers, Zap, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: BarChart3,
    title: "Hand Parser",
    description:
      "Automatic detection and parsing of GGPoker and PokerStars hand histories into a normalized data structure.",
  },
  {
    icon: Map,
    title: "Board Texture Analysis",
    description:
      "Classifies boards into buckets: A-high dry, wet broadway, low connected, monotone, and paired boards.",
  },
  {
    icon: Layers,
    title: "Spot Classification",
    description:
      "Identifies SRP vs 3-bet pots, position matchups (BTN vs BB, etc.), and effective stack depth.",
  },
  {
    icon: Zap,
    title: "Heuristic Rules Engine",
    description:
      "GTO-inspired rules evaluate your c-bet sizing, frequency, and line choices against solver benchmarks.",
  },
  {
    icon: Brain,
    title: "AI Coaching",
    description:
      "GPT-4o powered coaching explains the WHY behind every recommendation in plain, educational language.",
  },
  {
    icon: BookOpen,
    title: "Range Education",
    description:
      "Learn about range advantage, position theory, and sizing principles through concrete examples from your hands.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Everything You Need to{" "}
            <span className="text-poker-green">Level Up</span>
          </h2>
          <p className="text-muted-foreground">
            From raw hand history to actionable coaching in seconds. No solver
            required.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group border-border/50 bg-card/60 hover:border-poker-green/30 transition-all duration-300 hover:bg-card"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-poker-green/10 border border-poker-green/20 group-hover:bg-poker-green/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-poker-green" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
