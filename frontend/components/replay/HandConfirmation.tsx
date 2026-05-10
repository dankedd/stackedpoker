"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { CardPicker } from "@/components/poker/CardPicker";
import type { ExtractionResult, ConfirmedPokerState, ExtractedAction } from "@/lib/types";

interface HandConfirmationProps {
  extraction: ExtractionResult;
  onConfirm: (state: ConfirmedPokerState) => void;
  onReset: () => void;
  isAnalyzing: boolean;
}

const POSITIONS_6MAX = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
const STREET_COLOR: Record<string, string> = {
  preflop: "text-blue-400/70",
  flop:    "text-emerald-400/70",
  turn:    "text-orange-400/70",
  river:   "text-red-400/70",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-poker-green" : pct >= 55 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-white/40 w-8">{pct}%</span>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">{label}</p>
  );
}

function PositionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30 cursor-pointer"
    >
      {POSITIONS_6MAX.map(p => (
        <option key={p} value={p}>{p}</option>
      ))}
      {!POSITIONS_6MAX.includes(value) && value && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}

export function HandConfirmation({ extraction, onConfirm, onReset, isAnalyzing }: HandConfirmationProps) {
  const hero = extraction.players.find(p => p.is_hero) ?? extraction.players[0];
  const villain = extraction.players.find(p => !p.is_hero);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Editable hero state
  const [heroName, setHeroName] = useState(hero?.name ?? "Hero");
  const [heroPos, setHeroPos] = useState(hero?.position ?? "BTN");
  const [heroCards, setHeroCards] = useState<string[]>(
    (hero?.cards ?? []).map(ec => ec.card).slice(0, 2).concat(["", ""]).slice(0, 2)
  );
  const [heroStack, setHeroStack] = useState(hero?.stack_bb ?? extraction.effective_stack_bb);

  // Editable villain state
  const [villainName, setVillainName] = useState(villain?.name ?? "");
  const [villainPos, setVillainPos] = useState(villain?.position ?? "BB");
  const [villainCards, setVillainCards] = useState<string[]>(
    (villain?.cards ?? []).map(ec => ec.card).slice(0, 2)
  );

  // Board cards
  const [flop, setFlop] = useState<string[]>(
    extraction.board.flop.concat(["", "", ""]).slice(0, 3)
  );
  const [turn, setTurn] = useState<string[]>(extraction.board.turn.slice(0, 1));
  const [river, setRiver] = useState<string[]>(extraction.board.river.slice(0, 1));

  const [stakes, setStakes] = useState(extraction.stakes ?? "");

  // All cards currently in use — for disabling duplicates in pickers
  const allUsed = useMemo(() => {
    return [
      ...heroCards,
      ...villainCards,
      ...flop,
      ...turn,
      ...river,
    ].filter(Boolean);
  }, [heroCards, villainCards, flop, turn, river]);

  function setHeroCard(i: number, card: string) {
    setHeroCards(prev => { const n = [...prev]; n[i] = card; return n; });
  }
  function setVillainCard(i: number, card: string) {
    setVillainCards(prev => {
      const n = [...prev];
      while (n.length <= i) n.push("");
      n[i] = card;
      return n;
    });
  }
  function setFlopCard(i: number, card: string) {
    setFlop(prev => { const n = [...prev]; n[i] = card; return n; });
  }

  function handleConfirm() {
    const state: ConfirmedPokerState = {
      hero_name: heroName.trim() || "Hero",
      hero_position: heroPos,
      hero_cards: heroCards.filter(Boolean),
      hero_stack_bb: heroStack,
      villain_name: villainName.trim() || null,
      villain_position: villainPos || null,
      villain_cards: villainCards.filter(Boolean),
      board: {
        flop: flop.filter(Boolean),
        turn: turn.filter(Boolean),
        river: river.filter(Boolean),
      },
      stakes: stakes.trim() || null,
      effective_stack_bb: heroStack,
      actions: extraction.actions,
    };
    onConfirm(state);
  }

  const pct = Math.round(extraction.overall_confidence * 100);
  const hasErrors = extraction.errors.length > 0;
  const hasWarnings = extraction.warnings.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden border border-white/8 animate-fade-in"
      style={{ background: "#080d08", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/6"
        style={{ background: "rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-yellow-400/60" />
          <span className="text-sm font-semibold text-white/80">Review Extraction</span>
          <span className="text-xs text-white/30">— verify and correct before analysis</span>
        </div>
        <div className="flex items-center gap-3">
          {hasErrors && (
            <span className="flex items-center gap-1 text-[9px] text-red-400 font-semibold uppercase tracking-wider">
              <XCircle className="h-3 w-3" />{extraction.errors.length} error{extraction.errors.length !== 1 ? "s" : ""}
            </span>
          )}
          {hasWarnings && !hasErrors && (
            <span className="flex items-center gap-1 text-[9px] text-yellow-400/70 font-semibold uppercase tracking-wider">
              <AlertTriangle className="h-3 w-3" />{extraction.warnings.length} warning{extraction.warnings.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
            pct >= 80 ? "bg-poker-green/15 text-poker-green border-poker-green/25" :
            pct >= 55 ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" :
                        "bg-red-500/15 text-red-400 border-red-500/25"
          )}>
            {pct}% confidence
          </span>
        </div>
      </div>

      {/* ── Main body ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/5">

        {/* Hero */}
        <div className="px-5 py-5 space-y-4">
          <SectionHeader label="Hero" />
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Name</label>
              <input
                value={heroName}
                onChange={e => setHeroName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Position</label>
              <PositionSelect value={heroPos} onChange={setHeroPos} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Stack (bb)</label>
              <input
                type="number"
                value={heroStack}
                onChange={e => setHeroStack(parseFloat(e.target.value) || 100)}
                className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Hole cards</label>
              <div className="flex gap-1.5">
                {[0, 1].map(i => (
                  <CardPicker
                    key={i}
                    value={heroCards[i] ?? ""}
                    onChange={card => setHeroCard(i, card)}
                    disabledCards={allUsed}
                  />
                ))}
              </div>
              {hero && (
                <ConfidenceBar value={hero.hero_confidence} />
              )}
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="px-5 py-5 space-y-4">
          <SectionHeader label="Board" />
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-blue-400/60 uppercase tracking-wider">Flop</label>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <CardPicker
                    key={i}
                    value={flop[i] ?? ""}
                    onChange={card => setFlopCard(i, card)}
                    disabledCards={allUsed}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-orange-400/60 uppercase tracking-wider">Turn</label>
              <CardPicker
                value={turn[0] ?? ""}
                onChange={card => setTurn([card])}
                disabledCards={allUsed}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-red-400/60 uppercase tracking-wider">River</label>
              <CardPicker
                value={river[0] ?? ""}
                onChange={card => setRiver([card])}
                disabledCards={allUsed}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Stakes</label>
              <input
                value={stakes}
                onChange={e => setStakes(e.target.value)}
                placeholder="e.g. $0.50/$1.00"
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Villain */}
        <div className="px-5 py-5 space-y-4">
          <SectionHeader label="Villain" />
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Name</label>
              <input
                value={villainName}
                onChange={e => setVillainName(e.target.value)}
                placeholder="Villain"
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Position</label>
              <PositionSelect value={villainPos} onChange={setVillainPos} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Hole cards (if known)</label>
              <div className="flex gap-1.5">
                {[0, 1].map(i => (
                  <CardPicker
                    key={i}
                    value={villainCards[i] ?? ""}
                    onChange={card => setVillainCard(i, card)}
                    disabledCards={allUsed}
                  />
                ))}
              </div>
              <p className="text-[9px] text-white/20">Optional — only needed if shown at showdown</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action list (collapsible) ──────────────────────────────────── */}
      <div className="border-t border-white/5">
        <button
          type="button"
          onClick={() => setActionsOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/3 transition-colors"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Action sequence ({extraction.actions.filter(a => !["post","blind"].includes(a.action)).length} actions)
          </span>
          {actionsOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-white/20" />
            : <ChevronDown className="h-3.5 w-3.5 text-white/20" />}
        </button>
        {actionsOpen && (
          <div className="px-5 pb-4 max-h-52 overflow-y-auto space-y-0.5">
            {extraction.actions.filter(a => !["post","blind"].includes(a.action)).map(a => {
              const isH = a.player_name === heroName || a.player_name.toLowerCase().includes("hero");
              return (
                <div
                  key={a.sequence_idx}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-xs",
                    isH ? "bg-poker-green/8" : "bg-white/3"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                    isH ? "bg-poker-green" : "bg-white/20")} />
                  <span className={cn("font-medium flex-shrink-0 w-24 truncate",
                    isH ? "text-poker-green/80" : "text-white/40")}>
                    {a.player_name}
                  </span>
                  <span className="text-white/70 font-semibold">{a.action}</span>
                  {a.amount_text && (
                    <span className="text-white/40">{a.amount_text}</span>
                  )}
                  {a.amount_bb !== null && a.amount_bb !== undefined && a.amount_usd !== undefined && a.amount_usd !== null && (
                    <span className="text-white/22 text-[9px]">({a.amount_bb.toFixed(1)}bb)</span>
                  )}
                  <span className={cn("ml-auto text-[9px] uppercase tracking-wide font-semibold",
                    STREET_COLOR[a.street])}>
                    {a.street}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Warnings + errors ──────────────────────────────────────────── */}
      {(hasErrors || hasWarnings) && (
        <div className="border-t border-white/5 px-5 py-3 space-y-1">
          {extraction.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-400/80">
              <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {e}
            </div>
          ))}
          {extraction.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-yellow-400/60">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {w}
            </div>
          ))}
          {extraction.ocr_available && (
            <div className="flex items-center gap-1.5 text-[10px] text-white/20 mt-1">
              <CheckCircle2 className="h-3 w-3" /> OCR active · {extraction.preprocessing_applied.join(" → ")}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 border-t border-white/5"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        <button
          type="button"
          onClick={onReset}
          disabled={isAnalyzing}
          className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
        >
          ← Upload different screenshot
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isAnalyzing || heroCards.filter(Boolean).length < 2}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all",
            "bg-poker-green text-black hover:bg-poker-green/90 active:scale-95",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-poker-green"
          )}
        >
          {isAnalyzing ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              Generating coaching…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Looks correct — analyze hand
            </>
          )}
        </button>
      </div>
    </div>
  );
}
