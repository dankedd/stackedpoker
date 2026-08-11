import Link from "next/link";
import { BookOpen, MessageCircle, History, Wallet, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExperienceLevel } from "@/lib/learn/experienceLevel";

interface ActionCard {
  href: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
}

// One card set per level, per the spec's own dashboard examples. Every
// target is a real route — never a placeholder/invented page (Leak Analysis
// maps to the AI Coach Insights page, which is the actual leak-detection
// feature already shipped under Bankroll). 'recreational' isn't given its
// own example in the spec; treated as the closest match to 'intermediate'
// (both describe a player who knows the basics but wants sharper decisions).
function actionsForLevel(level: ExperienceLevel, recommendedModuleId: string | null): ActionCard[] {
  const continueModuleHref = recommendedModuleId ? `/learn/module/${recommendedModuleId}` : "/learn";

  switch (level) {
    case "beginner":
      return [
        { href: continueModuleHref, icon: BookOpen, title: "Continue Module 1", description: "Pick up your foundation module." },
        { href: "/learn", icon: Layers, title: "Learn the basics", description: "Browse the full curriculum." },
        { href: "/coach", icon: MessageCircle, title: "Try the AI Coach", description: "Ask a question, get a straight answer." },
      ];
    case "recreational":
    case "intermediate":
      return [
        { href: continueModuleHref, icon: BookOpen, title: "Continue recommended module", description: "Keep building on your plan." },
        { href: "/history", icon: History, title: "Review recent hands", description: "See where decisions went wrong." },
        { href: "/learn", icon: Layers, title: "Study today's lesson", description: "Short, focused, and on-track." },
      ];
    case "advanced":
      return [
        { href: "/coach", icon: MessageCircle, title: "AI Coach", description: "Refine strategy, spot-check leaks." },
        { href: "/bankroll", icon: Wallet, title: "Session Tracker", description: "Log results, track your win rate." },
        { href: continueModuleHref, icon: Search, title: "Advanced modules", description: "Blockers, GTO, polarization." },
        { href: "/bankroll/insights", icon: Layers, title: "Leak analysis", description: "Automatic pattern detection." },
      ];
  }
}

export function PersonalizedActionsWidget({
  level,
  recommendedModuleId,
}: {
  level: ExperienceLevel;
  recommendedModuleId: string | null;
}) {
  const actions = actionsForLevel(level, recommendedModuleId);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        actions.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {actions.map((a) => (
        <Link key={a.title} href={a.href} className="group block">
          <div className="rounded-xl border border-border/40 bg-card/50 hover:bg-card/70 hover:border-violet-500/30 p-4 h-full transition-all hover:-translate-y-0.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 mb-3 group-hover:bg-violet-500/15 transition-colors">
              <a.icon className="h-4.5 w-4.5 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
            <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">{a.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
