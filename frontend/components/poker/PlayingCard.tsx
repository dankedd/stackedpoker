import { cn } from "@/lib/utils";

const SUIT_SYMBOLS: Record<string, string> = {
  h: "♥", d: "♦", c: "♣", s: "♠",
};

const RED_COLOR  = "#c8252d";
const BLACK_COLOR = "#1a1a1a";

const SUIT_COLORS: Record<string, string> = {
  h: RED_COLOR, d: RED_COLOR,
  c: BLACK_COLOR, s: BLACK_COLOR,
};

// Proportions: ~2.5:3.5 ratio (standard casino card)
const SIZE_CONFIG = {
  xs: { h: "h-[34px]",  w: "w-[24px]",  corner: "text-[7px]",  suit: "text-[6px]",  center: "text-[13px]", r: "rounded-[3px]",  p: "p-[2px]" },
  sm: { h: "h-[50px]",  w: "w-[35px]",  corner: "text-[10px]", suit: "text-[8px]",  center: "text-[20px]", r: "rounded-[4px]",  p: "p-[3px]" },
  md: { h: "h-[68px]",  w: "w-[48px]",  corner: "text-[14px]", suit: "text-[11px]", center: "text-[27px]", r: "rounded-[5px]",  p: "p-[4px]" },
  lg: { h: "h-[96px]",  w: "w-[68px]",  corner: "text-[18px]", suit: "text-[14px]", center: "text-[38px]", r: "rounded-[7px]",  p: "p-[5px]" },
  xl: { h: "h-[126px]", w: "w-[90px]",  corner: "text-[24px]", suit: "text-[18px]", center: "text-[50px]", r: "rounded-[9px]",  p: "p-[7px]" },
};

export type CardSize = keyof typeof SIZE_CONFIG;

interface PlayingCardProps {
  card: string;
  size?: CardSize;
  className?: string;
  animationDelay?: number;
  style?: React.CSSProperties;
}

export function PlayingCard({ card, size = "md", className, animationDelay, style }: PlayingCardProps) {
  const cfg = SIZE_CONFIG[size];

  if (!card || card.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-white/8",
          cfg.h, cfg.w, cfg.r,
          className
        )}
        style={{ background: "rgba(255,255,255,0.04)", ...style }}
      >
        <span className="text-white/20 font-bold text-xs">?</span>
      </div>
    );
  }

  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  const suitSymbol = SUIT_SYMBOLS[suit] || suit;
  const suitColor = SUIT_COLORS[suit] ?? BLACK_COLOR;
  const isRed = suit === "h" || suit === "d";

  return (
    <div
      className={cn(
        "relative select-none flex flex-col justify-between card-deal",
        cfg.h, cfg.w, cfg.r, cfg.p,
        className
      )}
      style={{
        background: "linear-gradient(160deg, #fefefe 0%, #f8f7f5 65%, #f2efe8 100%)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.95)",
        border: "1px solid rgba(255,255,255,0.15)",
        animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
        ...style,
      }}
    >
      {/* Top-left pip */}
      <div className="flex flex-col items-start leading-none font-black" style={{ color: suitColor }}>
        <span className={cn("leading-none tracking-tight", cfg.corner)}>{rank}</span>
        <span className={cn("leading-none -mt-[1px]", cfg.suit)}>{suitSymbol}</span>
      </div>

      {/* Center watermark suit */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={cn("leading-none select-none", cfg.center)}
          style={{ color: suitColor, opacity: isRed ? 0.10 : 0.07, fontWeight: 900 }}
        >
          {suitSymbol}
        </span>
      </div>

      {/* Bottom-right pip (rotated 180°) */}
      <div className="flex flex-col items-end leading-none font-black rotate-180" style={{ color: suitColor }}>
        <span className={cn("leading-none tracking-tight", cfg.corner)}>{rank}</span>
        <span className={cn("leading-none -mt-[1px]", cfg.suit)}>{suitSymbol}</span>
      </div>
    </div>
  );
}

export function CardBack({ size = "md", className, style }: { size?: CardSize; className?: string; style?: React.CSSProperties }) {
  const cfg = SIZE_CONFIG[size];
  return (
    <div
      className={cn(cfg.h, cfg.w, cfg.r, "select-none overflow-hidden", className)}
      style={{
        background: "linear-gradient(160deg, #1e2347 0%, #141833 100%)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      <div
        className="w-full h-full rounded-[inherit]"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%)",
          backgroundSize: "7px 7px",
        }}
      />
    </div>
  );
}

export function HoleCards({ cards, size = "md", label }: { cards: string[]; size?: CardSize; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>}
      <div className="flex gap-1.5">
        {cards.map((card, i) => (
          <PlayingCard key={card} card={card} size={size} animationDelay={i * 100} />
        ))}
      </div>
    </div>
  );
}
