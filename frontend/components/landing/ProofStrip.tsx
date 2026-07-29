import { BookOpen, Gamepad2, Grid3x3, Bot, Trophy } from "lucide-react";
import { StatusBadge } from "@/components/layout/StatusBadge";

const CAPABILITIES = [
  { icon: BookOpen, label: "Structured Modules" },
  { icon: Gamepad2, label: "Interactive Lessons" },
  { icon: Grid3x3, label: "Range Training" },
  { icon: Bot, label: "AI Coach" },
  { icon: Trophy, label: "XP & Levels" },
];

/** Thin bridging strip between the hero and the deeper explanation below —
 *  real capabilities only, plus the same available/in-development signal
 *  the Navbar's "In development" dropdown already carries. */
export function ProofStrip() {
  return (
    <section className="relative border-y border-border/40 bg-card/20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground/70">
              <Icon className="h-4 w-4 text-violet-400/70" />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <StatusBadge status="available" className="text-[10px]" />
          <span className="text-xs text-muted-foreground/50">Learn · Ranges</span>
          <span className="mx-2 h-3 w-px bg-border/60" aria-hidden />
          <StatusBadge status="development" className="text-[10px]" />
          <span className="text-xs text-muted-foreground/50">Practice · Analyze · Replay</span>
        </div>
      </div>
    </section>
  );
}
