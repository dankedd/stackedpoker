import { cn } from "@/lib/utils";
import type { HandAction } from "@/lib/types";

interface ActionTimelineProps {
  actions: HandAction[];
  heroName: string;
}

const ACTION_COLORS: Record<string, string> = {
  fold: "text-red-400",
  check: "text-slate-400",
  call: "text-blue-400",
  bet: "text-violet-400",
  raise: "text-yellow-400",
};

const ACTION_DOTS: Record<string, string> = {
  fold: "bg-red-400",
  check: "bg-slate-400",
  call: "bg-blue-400",
  bet: "bg-violet-500",
  raise: "bg-yellow-400",
};

const STREET_LABELS: Record<string, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

export function ActionTimeline({ actions, heroName }: ActionTimelineProps) {
  const streets = ["preflop", "flop", "turn", "river"] as const;
  const byStreet = streets.reduce((acc, s) => {
    acc[s] = actions.filter((a) => a.street === s);
    return acc;
  }, {} as Record<string, HandAction[]>);

  const activeStreets = streets.filter((s) => byStreet[s].length > 0);

  return (
    <div className="space-y-4">
      {activeStreets.map((street) => (
        <div key={street}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {STREET_LABELS[street]}
          </h4>
          <div className="space-y-1.5">
            {byStreet[street].map((action, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  action.is_hero
                    ? "bg-violet-500/5 border border-violet-500/20"
                    : "bg-secondary/30"
                )}
              >
                <div
                  className={cn(
                    "h-2 w-2 flex-shrink-0 rounded-full",
                    ACTION_DOTS[action.action] ?? "bg-slate-400"
                  )}
                />
                <span
                  className={cn(
                    "font-medium",
                    action.is_hero ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {action.is_hero ? "Hero" : action.player}
                </span>
                <span
                  className={cn(
                    "capitalize font-semibold",
                    ACTION_COLORS[action.action] ?? "text-foreground"
                  )}
                >
                  {action.action}
                  {action.size_bb != null && ` ${action.size_bb.toFixed(1)}BB`}
                </span>
                {action.is_hero && (
                  <span className="ml-auto text-xs text-violet-400/60">Hero</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
