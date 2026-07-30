"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

type SuitAccent = "spades" | "hearts" | "diamonds" | "clubs";

interface SuitDef {
  key: string;
  symbol: string;
  name: string;
  accent: SuitAccent;
  /** Strong color for the peripheral-vision cue (left stripe + selected suit filter). */
  stripe: string;
  /** Text/icon color. */
  text: string;
  /** Translucent row background (layered over the dropdown's opaque backdrop). */
  rowBg: string;
  /** Row border. */
  rowBorder: string;
  /** Solid color behind the sticky suit label so scrolled cards don't show through it. */
  labelBg: string;
  /** Available (non-selected, non-disabled) card cell styling. */
  cell: string;
  cellHover: string;
}

// Order matches how learners scan a deck: black, red, red, black — the two
// red suits sit together, and each gets its own hue so no two rows share a
// color even at a glance (peripheral vision, not just the text label).
const SUITS: SuitDef[] = [
  {
    key: "s",
    symbol: "♠",
    name: "Spades",
    accent: "spades",
    stripe: "#cbd5e1", // slate-300 — cool neutral
    text: "text-slate-100",
    rowBg: "bg-white/[0.03]",
    rowBorder: "border-white/10",
    labelBg: "#141414",
    cell: "bg-white/8 text-slate-200",
    cellHover: "hover:bg-white/20 hover:text-white",
  },
  {
    key: "h",
    symbol: "♥",
    name: "Hearts",
    accent: "hearts",
    stripe: "#f87171", // red-400 — crimson
    text: "text-red-400",
    rowBg: "bg-red-500/[0.07]",
    rowBorder: "border-red-500/15",
    labelBg: "#1c1013",
    cell: "bg-red-500/10 text-red-400",
    cellHover: "hover:bg-red-500/25 hover:text-red-300",
  },
  {
    key: "d",
    symbol: "♦",
    name: "Diamonds",
    accent: "diamonds",
    stripe: "#fb923c", // orange-400 — warmer red-orange, distinct from Hearts' crimson
    text: "text-orange-400",
    rowBg: "bg-orange-500/[0.07]",
    rowBorder: "border-orange-500/15",
    labelBg: "#1c150f",
    cell: "bg-orange-500/10 text-orange-400",
    cellHover: "hover:bg-orange-500/25 hover:text-orange-300",
  },
  {
    key: "c",
    symbol: "♣",
    name: "Clubs",
    accent: "clubs",
    stripe: "#6ee7b7", // emerald-300 — subtle cool variation from Spades' slate
    text: "text-emerald-100",
    rowBg: "bg-emerald-500/[0.05]",
    rowBorder: "border-emerald-500/10",
    labelBg: "#10160f",
    cell: "bg-emerald-500/[0.08] text-emerald-100",
    cellHover: "hover:bg-emerald-500/20 hover:text-emerald-50",
  },
];

interface CardPickerProps {
  value: string;           // current card e.g. "Ah"
  onChange: (card: string) => void;
  disabledCards?: string[];  // cards already in use elsewhere
  /** Cards currently on the board, shown as context inside the dropdown so the
   *  user never has to look back up at the table while picking. */
  boardCards?: string[];
  className?: string;
}

function suitOf(card: string): SuitDef | undefined {
  return SUITS.find(s => s.key === card[1]?.toLowerCase());
}

function MiniCard({ card, dim }: { card: string; dim?: boolean }) {
  if (!card || card.length < 2) {
    return (
      <div className={cn(
        "h-[42px] w-[30px] rounded-[3px] border border-white/10 flex items-center justify-center",
        "bg-white/5 text-white/20 text-xs font-bold select-none",
        dim && "opacity-40 grayscale"
      )}>?</div>
    );
  }
  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  const isRed = suit === "h" || suit === "d";
  const suitSymbol = suit === "h" ? "♥" : suit === "d" ? "♦" : suit === "s" ? "♠" : "♣";
  return (
    <div className={cn(
      "h-[42px] w-[30px] rounded-[3px] flex flex-col items-start justify-between p-[3px] select-none font-black",
      dim ? "opacity-40 grayscale" : "",
    )}
      style={{
        background: "linear-gradient(160deg,#fff 0%,#f4f4f2 100%)",
        boxShadow: "0 3px 8px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}>
      <span className={cn("text-[11px] leading-none", isRed ? "text-[#d40000]" : "text-[#0d0d0d]")}>
        {rank}
      </span>
      <span className={cn("text-[9px] leading-none self-center", isRed ? "text-[#d40000]" : "text-[#0d0d0d]")}>
        {suitSymbol}
      </span>
    </div>
  );
}

/** Small colored rank+suit chip used for the "current board" context strip. */
function BoardChip({ card }: { card: string }) {
  const suit = suitOf(card);
  if (!suit) return null;
  return (
    <span className={cn("inline-flex items-center gap-px rounded px-1 py-0.5 text-[10px] font-bold", suit.rowBg, suit.text)}>
      {card[0].toUpperCase()}{suit.symbol}
    </span>
  );
}

export function CardPicker({ value, onChange, disabledCards = [], boardCards = [], className }: CardPickerProps) {
  const [open, setOpen] = useState(false);
  const [suitFilter, setSuitFilter] = useState<string | null>(null);
  const [focusPos, setFocusPos] = useState({ row: 0, col: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const visibleSuits = useMemo(
    () => (suitFilter ? SUITS.filter(s => s.key === suitFilter) : SUITS),
    [suitFilter],
  );

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Focus the selected card (or the first available one) whenever the picker opens.
  useEffect(() => {
    if (!open) return;
    const disabledSet = new Set(disabledCards.filter(c => c !== value));
    let row = 0, col = 0;
    const suitIdx = value ? visibleSuits.findIndex(s => s.key === value[1]?.toLowerCase()) : -1;
    const rankIdx = value ? RANKS.indexOf(value[0]?.toUpperCase()) : -1;
    if (suitIdx >= 0 && rankIdx >= 0) {
      row = suitIdx; col = rankIdx;
    } else {
      for (let r = 0; r < visibleSuits.length; r++) {
        const c = RANKS.findIndex(rank => !disabledSet.has(`${rank}${visibleSuits[r].key}`));
        if (c >= 0) { row = r; col = c; break; }
      }
    }
    setFocusPos({ row, col });
    const key = `${visibleSuits[row]?.key}-${col}`;
    requestAnimationFrame(() => cellRefs.current[key]?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(card: string) {
    onChange(card);
    close();
  }

  function close() {
    setOpen(false);
    setSuitFilter(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const disabled = new Set(disabledCards.filter(c => c !== value));

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const rows = visibleSuits.length;
    let { row, col } = focusPos;
    switch (e.key) {
      case "ArrowRight": col = Math.min(col + 1, RANKS.length - 1); break;
      case "ArrowLeft": col = Math.max(col - 1, 0); break;
      case "ArrowDown": row = Math.min(row + 1, rows - 1); break;
      case "ArrowUp": row = Math.max(row - 1, 0); break;
      case "Home": col = 0; break;
      case "End": col = RANKS.length - 1; break;
      default: return;
    }
    e.preventDefault();
    setFocusPos({ row, col });
    const key = `${visibleSuits[row]?.key}-${col}`;
    cellRefs.current[key]?.focus();
  }, [focusPos, visibleSuits]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group relative hover:scale-105 transition-transform duration-150 cursor-pointer"
        title="Click to change card"
        aria-expanded={open}
        aria-haspopup="grid"
      >
        <MiniCard card={value} />
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white/80 text-black text-[8px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">✎</span>
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 rounded-xl border border-white/10 shadow-2xl"
          style={{ background: "#111", minWidth: "260px", maxWidth: "94vw" }}
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Select card</p>
            {/* Suit filter — collapses the grid to a single row */}
            <div className="flex items-center gap-0.5" role="group" aria-label="Filter by suit">
              {SUITS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSuitFilter(prev => (prev === s.key ? null : s.key))}
                  title={`Show only ${s.name}`}
                  aria-pressed={suitFilter === s.key}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded text-[11px] transition-colors",
                    suitFilter === s.key ? "bg-white/20" : "hover:bg-white/10",
                    s.text,
                  )}
                >
                  {s.symbol}
                </button>
              ))}
            </div>
          </div>

          {boardCards.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
              <span className="text-[9px] text-white/30 uppercase tracking-wide shrink-0">Current board:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {boardCards.map((c, i) => <BoardChip key={i} card={c} />)}
              </div>
            </div>
          )}

          <div
            className="overflow-x-auto overscroll-contain"
            role="grid"
            aria-label="Card selection grid"
            onKeyDown={handleGridKeyDown}
          >
            <div className="p-2 space-y-1.5" style={{ minWidth: "460px" }}>
              {visibleSuits.map((suit, rowIdx) => (
                <div
                  key={suit.key}
                  role="row"
                  className={cn("flex items-stretch gap-2 rounded-lg border", suit.rowBg, suit.rowBorder)}
                >
                  <div
                    role="rowheader"
                    className="sticky left-0 z-10 flex w-[78px] flex-shrink-0 items-center gap-1.5 rounded-l-lg py-1.5 pl-1 pr-2"
                    style={{ backgroundColor: suit.labelBg }}
                  >
                    <span aria-hidden="true" className="h-4 w-[3px] flex-shrink-0 rounded-full" style={{ backgroundColor: suit.stripe }} />
                    <span className={cn("text-base leading-none", suit.text)} aria-hidden="true">{suit.symbol}</span>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide leading-none", suit.text)}>
                      {suit.name}
                    </span>
                  </div>
                  <div className="flex gap-1 py-1.5 pr-2">
                    {RANKS.map((rank, colIdx) => {
                      const card = `${rank}${suit.key}`;
                      const isDisabled = disabled.has(card);
                      const isCurrent = card === value;
                      const isFocusable = rowIdx === focusPos.row && colIdx === focusPos.col;
                      const cellKey = `${suit.key}-${colIdx}`;
                      return (
                        <div key={card} className="group/cell relative">
                          <button
                            ref={el => { cellRefs.current[cellKey] = el; }}
                            type="button"
                            role="gridcell"
                            disabled={isDisabled}
                            tabIndex={isFocusable ? 0 : -1}
                            onFocus={() => setFocusPos({ row: rowIdx, col: colIdx })}
                            onClick={() => pick(card)}
                            title={isDisabled ? "Already on the board" : undefined}
                            aria-selected={isCurrent}
                            aria-disabled={isDisabled}
                            aria-label={
                              isDisabled
                                ? `${rank} of ${suit.name}, already on the board`
                                : `${rank} of ${suit.name}`
                            }
                            className={cn(
                              "relative flex h-9 w-7 flex-col items-center justify-center gap-px rounded text-[10px] font-bold leading-none",
                              "border transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1",
                              "focus-visible:ring-offset-[#111]",
                              isCurrent
                                ? "scale-110 border-violet-300 bg-violet-500 text-white shadow-[0_0_0_3px_rgba(139,92,246,0.35),0_4px_14px_rgba(139,92,246,0.5)] transition-transform"
                                : isDisabled
                                ? cn(
                                    "cursor-not-allowed border-dashed",
                                    "after:absolute after:left-[15%] after:right-[15%] after:top-1/2 after:h-px after:-rotate-[25deg] after:bg-current",
                                    suit.accent === "hearts" ? "border-red-500/15 bg-red-500/5 text-red-400/30"
                                    : suit.accent === "diamonds" ? "border-orange-500/15 bg-orange-500/5 text-orange-400/30"
                                    : suit.accent === "clubs" ? "border-emerald-500/10 bg-emerald-500/5 text-emerald-100/25"
                                    : "border-white/10 bg-white/5 text-white/20"
                                  )
                                : cn(
                                    "cursor-pointer border-transparent transition-transform hover:scale-105 active:scale-95",
                                    suit.cell, suit.cellHover,
                                  )
                            )}
                          >
                            <span>{rank}</span>
                            <span className="text-[9px]">{suit.symbol}</span>
                            {isCurrent && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-400 shadow">
                                <Check className="h-2 w-2 text-white" strokeWidth={3.5} />
                              </span>
                            )}
                          </button>
                          {isDisabled && (
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100"
                            >
                              Already on the board
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-3 pb-2 pt-1">
            <button
              type="button"
              onClick={() => { onChange(""); close(); }}
              className="w-full text-[9px] text-white/30 hover:text-white/60 transition-colors py-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
