import { cn } from "@/lib/utils";

const SUIT: Record<string, { sym: string; cls: string }> = {
  s: { sym: "♠", cls: "bg-slate-600 border-slate-400/40" },
  h: { sym: "♥", cls: "bg-red-600 border-red-300/40" },
  d: { sym: "♦", cls: "bg-blue-600 border-blue-300/40" },
  c: { sym: "♣", cls: "bg-green-600 border-green-300/40" },
};

/** Compact four-colour cards for list rows (same colours as FourColorCard). */
export function MiniCards({ cards, className }: { cards: string[] | null | undefined; className?: string }) {
  if (!cards?.length) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("inline-flex gap-0.5", className)}>
      {cards.map((c) => {
        const s = SUIT[c[1]?.toLowerCase()] ?? SUIT.s;
        const rank = c[0]?.toUpperCase() === "T" ? "10" : c[0]?.toUpperCase();
        return (
          <span
            key={c}
            aria-label={`${rank}${s.sym}`}
            className={cn("inline-flex h-6 min-w-[22px] items-center justify-center rounded border px-0.5 font-mono text-[11px] font-bold leading-none text-white", s.cls)}
          >
            {rank}
            <span className="text-[9px] opacity-80">{s.sym}</span>
          </span>
        );
      })}
    </span>
  );
}
