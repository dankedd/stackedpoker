"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { key: "h", symbol: "♥", color: "text-red-500" },
  { key: "d", symbol: "♦", color: "text-red-500" },
  { key: "s", symbol: "♠", color: "text-slate-800" },
  { key: "c", symbol: "♣", color: "text-slate-800" },
];

interface CardPickerProps {
  value: string;           // current card e.g. "Ah"
  onChange: (card: string) => void;
  disabledCards?: string[];  // cards already in use elsewhere
  className?: string;
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

export function CardPicker({ value, onChange, disabledCards = [], className }: CardPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(card: string) {
    onChange(card);
    setOpen(false);
  }

  const disabled = new Set(disabledCards.filter(c => c !== value));

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group relative hover:scale-105 transition-transform duration-150 cursor-pointer"
        title="Click to change card"
      >
        <MiniCard card={value} />
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white/80 text-black text-[8px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">✎</span>
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: "#111", minWidth: "260px" }}
        >
          <div className="px-3 pt-2 pb-1 border-b border-white/5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Select card</p>
          </div>
          <div className="p-2 space-y-1">
            {SUITS.map(suit => (
              <div key={suit.key} className="flex items-center gap-0.5">
                <span className={cn("text-xs w-4 text-center flex-shrink-0", suit.color)}>
                  {suit.symbol}
                </span>
                {RANKS.map(rank => {
                  const card = `${rank}${suit.key}`;
                  const isDisabled = disabled.has(card);
                  const isCurrent = card === value;
                  return (
                    <button
                      key={card}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => pick(card)}
                      className={cn(
                        "h-6 w-5 rounded text-[9px] font-bold transition-all",
                        isCurrent
                          ? "bg-poker-green text-black scale-110"
                          : isDisabled
                          ? "bg-white/5 text-white/15 cursor-not-allowed"
                          : "bg-white/8 text-white/70 hover:bg-white/20 hover:text-white cursor-pointer"
                      )}
                    >
                      {rank}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
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
