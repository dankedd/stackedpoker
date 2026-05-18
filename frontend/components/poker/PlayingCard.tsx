import { cn } from "@/lib/utils";

// ── Suit identity ─────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };

// Crimson vs deep charcoal — richer than raw red/black
const RED_COLOR   = "#B41C22";  // deep crimson
const BLACK_COLOR = "#1C1917";  // near-black charcoal

// ── Size system ───────────────────────────────────────────────────────────────
// Proportions: 2.5:3.5 ≈ standard casino card (h / w ≈ 1.40)

const SIZE_CONFIG = {
  xs: {
    h: "h-[38px]", w: "w-[27px]",
    r: "rounded-[4px]", p: "p-[2.5px]",
    corner: "text-[8px]",  suit: "text-[7px]",   center: "text-[15px]",
  },
  sm: {
    h: "h-[54px]", w: "w-[38px]",
    r: "rounded-[5px]", p: "p-[3.5px]",
    corner: "text-[11px]", suit: "text-[9px]",   center: "text-[22px]",
  },
  md: {
    h: "h-[72px]", w: "w-[51px]",
    r: "rounded-[6px]", p: "p-[4.5px]",
    corner: "text-[15px]", suit: "text-[12px]",  center: "text-[29px]",
  },
  lg: {
    h: "h-[100px]", w: "w-[71px]",
    r: "rounded-[8px]", p: "p-[6px]",
    corner: "text-[20px]", suit: "text-[15px]",  center: "text-[40px]",
  },
  xl: {
    h: "h-[130px]", w: "w-[93px]",
    r: "rounded-[10px]", p: "p-[8px]",
    corner: "text-[26px]", suit: "text-[19px]",  center: "text-[52px]",
  },
};

export type CardSize = keyof typeof SIZE_CONFIG;

interface PlayingCardProps {
  card: string;
  size?: CardSize;
  className?: string;
  animationDelay?: number;
  interactive?: boolean;
  style?: React.CSSProperties;
}

/**
 * PlayingCard — premium face-up card.
 *
 * Warm ivory gradient, multi-layer shadow, crisp pip system.
 * Used across replay, puzzle HUD, board displays, and learn hub.
 */
export function PlayingCard({
  card,
  size = "md",
  className,
  animationDelay,
  interactive = false,
  style,
}: PlayingCardProps) {
  const cfg = SIZE_CONFIG[size];

  if (!card || card.length < 2) {
    return (
      <div
        className={cn(cfg.h, cfg.w, cfg.r, "flex items-center justify-center shrink-0", className)}
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", ...style }}
      >
        <span className="text-white/20 font-bold text-xs">?</span>
      </div>
    );
  }

  const rawRank = card[0].toUpperCase();
  const rank    = rawRank === "T" ? "10" : rawRank;
  const suit    = card[1].toLowerCase();
  const sym     = SUIT_SYMBOL[suit] ?? suit;
  const isRed   = suit === "h" || suit === "d";
  const col     = isRed ? RED_COLOR : BLACK_COLOR;

  return (
    <div
      className={cn(
        "relative select-none flex flex-col justify-between shrink-0 card-deal overflow-hidden",
        cfg.h, cfg.w, cfg.r, cfg.p,
        interactive && "card-lift cursor-pointer",
        className,
      )}
      style={{
        // Warm ivory — not cold white
        background: "linear-gradient(165deg, #FEFEFC 0%, #F9F6F0 40%, #F0EBE1 100%)",
        // 4-layer shadow: deep ambient + mid + rim + specular top highlight
        boxShadow: [
          "0 18px 44px rgba(0,0,0,0.62)",
          "0 6px 14px rgba(0,0,0,0.40)",
          "0 2px 4px rgba(0,0,0,0.22)",
          "inset 0 1.5px 0 rgba(255,255,255,1)",
          "inset 0 -1px 0 rgba(0,0,0,0.08)",
        ].join(", "),
        // Subtle off-white card edge
        border: "1px solid rgba(200,193,182,0.80)",
        animationDelay: animationDelay != null ? `${animationDelay}ms` : undefined,
        ...style,
      }}
    >
      {/* Top gloss — faint reflective sheen on upper third */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "42%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0) 100%)",
          borderRadius: "inherit",
        }}
      />

      {/* Top-left corner pip */}
      <div className="relative z-10 flex flex-col items-start leading-none font-black" style={{ color: col }}>
        <span className={cn("leading-none tracking-tight", cfg.corner)}>{rank}</span>
        <span className={cn("leading-none -mt-[1px]", cfg.suit)}>{sym}</span>
      </div>

      {/* Center watermark suit — intentional, perfectly centered */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={cn("leading-none select-none font-black", cfg.center)}
          style={{ color: col, opacity: isRed ? 0.11 : 0.08 }}
        >
          {sym}
        </span>
      </div>

      {/* Bottom-right corner pip (rotated 180°) */}
      <div className="relative z-10 flex flex-col items-end leading-none font-black rotate-180" style={{ color: col }}>
        <span className={cn("leading-none tracking-tight", cfg.corner)}>{rank}</span>
        <span className={cn("leading-none -mt-[1px]", cfg.suit)}>{sym}</span>
      </div>
    </div>
  );
}

// ── Card back ─────────────────────────────────────────────────────────────────

/**
 * CardBack — premium face-down card.
 *
 * Deep indigo/violet gradient, geometric diamond pattern, layered border glow.
 */
export function CardBack({
  size = "md",
  className,
  style,
}: {
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cfg = SIZE_CONFIG[size];
  return (
    <div
      className={cn(cfg.h, cfg.w, cfg.r, "select-none overflow-hidden shrink-0 relative", className)}
      style={{
        background: "linear-gradient(148deg, #2C1B6E 0%, #18103E 38%, #0D0A28 62%, #1A1055 100%)",
        boxShadow: [
          "0 14px 36px rgba(0,0,0,0.58)",
          "0 4px 10px rgba(0,0,0,0.38)",
          "inset 0 1px 0 rgba(255,255,255,0.09)",
          "inset 0 0 0 1.5px rgba(139,92,246,0.14)",
        ].join(", "),
        border: "1px solid rgba(139,92,246,0.28)",
        ...style,
      }}
    >
      {/* Fine diamond grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "repeating-linear-gradient(45deg, rgba(139,92,246,0.09) 0, rgba(139,92,246,0.09) 0.5px, transparent 0, transparent 50%)",
            "repeating-linear-gradient(-45deg, rgba(139,92,246,0.09) 0, rgba(139,92,246,0.09) 0.5px, transparent 0, transparent 50%)",
          ].join(", "),
          backgroundSize: "8px 8px",
        }}
      />
      {/* Central emblem — double border diamond */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          style={{
            width: "42%",
            height: "58%",
            border: "1px solid rgba(139,92,246,0.22)",
            boxShadow: "0 0 0 3px rgba(139,92,246,0.07), inset 0 0 8px rgba(139,92,246,0.05)",
            borderRadius: "3px",
            transform: "rotate(3deg)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: "26%",
            height: "38%",
            border: "1px solid rgba(167,139,250,0.18)",
            borderRadius: "2px",
            transform: "rotate(3deg)",
          }}
        />
      </div>
      {/* Edge ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 65%)",
          borderRadius: "inherit",
        }}
      />
    </div>
  );
}

// ── HoleCards convenience wrapper ─────────────────────────────────────────────

export function HoleCards({
  cards,
  size = "md",
  label,
  interactive,
}: {
  cards: string[];
  size?: CardSize;
  label?: string;
  interactive?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-semibold">
          {label}
        </span>
      )}
      <div className="flex gap-1.5">
        {cards.map((card, i) => (
          <PlayingCard key={card} card={card} size={size} animationDelay={i * 100} interactive={interactive} />
        ))}
      </div>
    </div>
  );
}
