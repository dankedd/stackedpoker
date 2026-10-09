import { cn } from "@/lib/utils";

/**
 * Four-colour face-up card: the whole face takes the suit's colour (spades
 * slate, hearts red, diamonds blue, clubs green) with a large white index,
 * so rank and suit read at a glance even at small sizes — the convention
 * most online poker clients use for hole cards. A separate component rather
 * than a PlayingCard variant, so every existing table keeps its ivory deck.
 */

const SUIT: Record<string, { sym: string; face: string; edge: string }> = {
  s: { sym: "♠", face: "linear-gradient(160deg, #475569 0%, #1e293b 55%, #0f172a 100%)", edge: "rgba(148,163,184,0.45)" },
  h: { sym: "♥", face: "linear-gradient(160deg, #ef4444 0%, #b91c1c 55%, #7f1d1d 100%)", edge: "rgba(254,202,202,0.45)" },
  d: { sym: "♦", face: "linear-gradient(160deg, #3b82f6 0%, #1d4ed8 55%, #1e3a8a 100%)", edge: "rgba(191,219,254,0.45)" },
  c: { sym: "♣", face: "linear-gradient(160deg, #22c55e 0%, #15803d 55%, #14532d 100%)", edge: "rgba(187,247,208,0.45)" },
};

const SIZES = {
  sm: { w: 50, h: 70, rank: 30, suit: 16, mark: 44, r: 7 },
  md: { w: 62, h: 87, rank: 38, suit: 20, mark: 56, r: 8 },
  lg: { w: 74, h: 104, rank: 46, suit: 24, mark: 68, r: 10 },
} as const;

export type FourColorCardSize = keyof typeof SIZES;

export function FourColorCard({
  card,
  size = "md",
  className,
  style,
}: {
  /** e.g. "As", "Td". */
  card: string;
  size?: FourColorCardSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  const s = SIZES[size];
  const suit = SUIT[card[1]?.toLowerCase()] ?? SUIT.s;
  const rank = card[0]?.toUpperCase() === "T" ? "10" : card[0]?.toUpperCase();

  return (
    <div
      role="img"
      aria-label={`${rank}${suit.sym}`}
      className={cn("relative shrink-0 select-none overflow-hidden", className)}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.r,
        background: suit.face,
        border: `1px solid ${suit.edge}`,
        boxShadow: "0 10px 24px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
        ...style,
      }}
    >
      {/* Index: big rank with the suit under it. */}
      <div className="absolute left-[9%] top-[5%] flex flex-col items-center leading-none text-white">
        <span
          className="font-bold tracking-tighter"
          style={{ fontSize: rank === "10" ? s.rank * 0.82 : s.rank, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {rank}
        </span>
        <span style={{ fontSize: s.suit, marginTop: 1 }}>{suit.sym}</span>
      </div>
      {/* Large faint suit mark, bottom right. */}
      <span
        aria-hidden="true"
        className="absolute leading-none text-white/20"
        style={{ fontSize: s.mark, right: "-6%", bottom: "-8%" }}
      >
        {suit.sym}
      </span>
      {/* Top sheen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0))" }}
      />
    </div>
  );
}
