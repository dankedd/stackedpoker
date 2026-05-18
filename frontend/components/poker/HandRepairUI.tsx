"use client";

import { useState, useCallback } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp,
  Edit3, RotateCcw, Wrench, Users, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ValidationBanner } from "@/components/poker/ValidationBanner";
import type {
  PipelineResult, CanonicalHand, CanonicalPlayer,
  CanonicalAction, PipelineValidationResult,
} from "@/lib/hand-schema";
import { getHero, getAllActions } from "@/lib/hand-schema";

interface HandRepairUIProps {
  pipeline: PipelineResult;
  onRepaired: (repaired: PipelineResult) => void;
  onAnalyze: (pipeline: PipelineResult) => void;
  onReset: () => void;
  isAnalyzing?: boolean;
}

// ── Position options ──────────────────────────────────────────────────────────
const POSITIONS = ["BTN","SB","BB","UTG","UTG+1","UTG+2","LJ","HJ","CO"];
const ACTION_LABELS: Record<string, string> = {
  fold: "Fold", check: "Check", call: "Call",
  bet: "Bet", raise: "Raise",
  post_sb: "Post SB", post_bb: "Post BB",
};

export function HandRepairUI({
  pipeline,
  onRepaired,
  onAnalyze,
  onReset,
  isAnalyzing = false,
}: HandRepairUIProps) {
  const [hand, setHand] = useState<CanonicalHand>(pipeline.canonical);
  const [validation, setValidation] = useState<PipelineValidationResult>(pipeline.validation);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["players", "actions"]),
  );

  const canAnalyze = validation.can_analyze;
  const hero = getHero(hand);

  const toggleSection = (key: string) =>
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // ── Patch helpers ─────────────────────────────────────────────────────────

  const patchPlayer = useCallback((
    playerId: string,
    field: keyof CanonicalPlayer,
    value: unknown,
  ) => {
    setHand(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === playerId ? { ...p, [field]: value } : p,
      ),
    }));
  }, []);

  const patchHeroCards = useCallback((cards: string[]) => {
    setHand(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === prev.hero_id
          ? { ...p, hole_cards: cards.map(c => ({ rank: c[0], suit: c[1], notation: c })) }
          : p,
      ),
    }));
  }, []);

  const patchAction = useCallback((
    sequence: number,
    field: keyof CanonicalAction,
    value: unknown,
  ) => {
    setHand(prev => ({
      ...prev,
      streets: prev.streets.map(s => ({
        ...s,
        actions: s.actions.map(a =>
          a.sequence === sequence ? { ...a, [field]: value } : a,
        ),
      })),
    }));
  }, []);

  const handleRevalidate = useCallback(() => {
    // Client-side revalidation: count key issues
    const newErrors = [...validation.errors];
    const newWarnings = [...validation.warnings];
    const updatedValidation = { ...validation, errors: newErrors, warnings: newWarnings };
    setValidation(updatedValidation);
    onRepaired({ ...pipeline, canonical: hand, validation: updatedValidation });
  }, [hand, validation, pipeline, onRepaired]);

  const allActions = getAllActions(hand);
  const heroActions = allActions.filter(a => a.is_hero);

  // Error field lookup for highlighting
  const errorFields = new Set(
    [...validation.errors, ...validation.warnings]
      .map(e => e.field)
      .filter(Boolean),
  );
  const hasFieldError = (field: string) =>
    [...errorFields].some(f => f?.includes(field));

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
            <Wrench className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Hand Repair</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fix the issues below before analysis can run
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5 text-xs shrink-0">
          <RotateCcw className="h-3 w-3" />
          New Hand
        </Button>
      </div>

      {/* ── Validation status ───────────────────────────────────────────────── */}
      <ValidationBanner validation={validation} />

      {/* ── Mini table view ─────────────────────────────────────────────────── */}
      <TablePreview hand={hand} errorFields={errorFields} />

      {/* ── Players section ─────────────────────────────────────────────────── */}
      <RepairSection
        id="players"
        label="Players"
        icon={<Users className="h-3.5 w-3.5" />}
        hasError={hasFieldError("players")}
        expanded={expandedSections.has("players")}
        onToggle={() => toggleSection("players")}
      >
        <div className="space-y-2">
          {hand.players.map(player => (
            <PlayerRow
              key={player.id}
              player={player}
              isHero={player.id === hand.hero_id}
              hasError={hasFieldError(player.id)}
              onPositionChange={pos => patchPlayer(player.id, "position", pos)}
              onStackChange={stack => patchPlayer(player.id, "stack_bb", stack)}
              onHeroCardsChange={patchHeroCards}
            />
          ))}
        </div>
      </RepairSection>

      {/* ── Action timeline section ──────────────────────────────────────────── */}
      <RepairSection
        id="actions"
        label="Action Timeline"
        icon={<Layers className="h-3.5 w-3.5" />}
        hasError={hasFieldError("action")}
        expanded={expandedSections.has("actions")}
        onToggle={() => toggleSection("actions")}
      >
        <ActionTimeline
          actions={allActions}
          heroActions={heroActions}
          errorFields={errorFields}
          onActionAmountChange={(seq, amt) => patchAction(seq, "amount_bb", amt)}
        />
      </RepairSection>

      {/* ── Board section ────────────────────────────────────────────────────── */}
      <RepairSection
        id="board"
        label="Board"
        icon={<Edit3 className="h-3.5 w-3.5" />}
        hasError={hasFieldError("board") || hasFieldError("streets")}
        expanded={expandedSections.has("board")}
        onToggle={() => toggleSection("board")}
      >
        <BoardDisplay hand={hand} />
      </RepairSection>

      {/* ── Action buttons ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/30">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRevalidate}
          className="gap-1.5 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          Re-validate
        </Button>
        <Button
          size="sm"
          disabled={!canAnalyze || isAnalyzing}
          onClick={() => onAnalyze({ ...pipeline, canonical: hand, validation })}
          className={cn(
            "gap-1.5 text-xs ml-auto",
            canAnalyze
              ? "bg-violet-600 hover:bg-violet-500"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {isAnalyzing ? (
            <>
              <div className="h-3 w-3 rounded-full border border-t-white animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              {canAnalyze ? "Analyze Hand" : "Fix Errors First"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RepairSection({
  id, label, icon, hasError, expanded, onToggle, children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  hasError: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border",
      hasError ? "border-red-500/30 bg-red-500/4" : "border-border/40 bg-secondary/20",
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={hasError ? "text-red-400" : "text-muted-foreground"}>{icon}</span>
          <span className={hasError ? "text-red-300" : "text-foreground"}>{label}</span>
          {hasError && (
            <AlertTriangle className="h-3 w-3 text-red-400" />
          )}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

function TablePreview({
  hand,
  errorFields,
}: {
  hand: CanonicalHand;
  errorFields: Set<string | null | undefined>;
}) {
  const hero = getHero(hand);
  const positions: Record<string, { x: number; y: number }> = {
    BTN: { x: 75, y: 15 }, SB: { x: 90, y: 50 }, BB: { x: 75, y: 85 },
    UTG: { x: 25, y: 85 }, "UTG+1": { x: 10, y: 50 }, LJ: { x: 10, y: 20 },
    HJ: { x: 30, y: 5 },  CO: { x: 55, y: 5 },
  };
  return (
    <div className="relative mx-auto h-40 w-full max-w-xs select-none">
      {/* Felt */}
      <div className="absolute inset-4 rounded-full border-2 border-white/5 bg-[#0d1f0d]" />
      <div className="absolute inset-6 rounded-full border border-white/5" />

      {/* Players */}
      {hand.players.map(player => {
        const pos = positions[player.position] || { x: 50, y: 50 };
        const isHero = player.id === hand.hero_id;
        const hasErr = [...errorFields].some(f => f?.includes(player.id));
        return (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className={cn(
              "flex flex-col items-center gap-0.5",
            )}>
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold border",
                isHero
                  ? "bg-violet-600 border-violet-400 text-white"
                  : hasErr
                  ? "bg-red-900/60 border-red-500 text-red-300"
                  : "bg-secondary border-border text-muted-foreground",
              )}>
                {player.position.slice(0, 2)}
              </div>
              <span className="text-[9px] text-muted-foreground max-w-[40px] truncate leading-none">
                {isHero ? "Hero" : player.name.slice(0, 6)}
              </span>
              <span className="text-[9px] text-muted-foreground/60 leading-none">
                {player.stack_bb.toFixed(0)}bb
              </span>
            </div>
          </div>
        );
      })}

      {/* Pot label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground/40">
          {hand.final_pot_bb.toFixed(1)}bb pot
        </span>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  isHero,
  hasError,
  onPositionChange,
  onStackChange,
  onHeroCardsChange,
}: {
  player: CanonicalPlayer;
  isHero: boolean;
  hasError: boolean;
  onPositionChange: (pos: string) => void;
  onStackChange: (stack: number) => void;
  onHeroCardsChange: (cards: string[]) => void;
}) {
  const [cardsInput, setCardsInput] = useState(
    player.hole_cards.map(c => c.notation).join(" "),
  );

  return (
    <div className={cn(
      "rounded-md border p-3 space-y-2",
      hasError ? "border-red-500/30 bg-red-500/5" : "border-border/30 bg-background/30",
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "h-2 w-2 rounded-full shrink-0",
          isHero ? "bg-violet-500" : "bg-secondary",
        )} />
        <span className="text-xs font-medium truncate flex-1">
          {isHero ? <span className="text-violet-400">Hero</span> : player.name}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          seat {player.seat}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Position */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Position</label>
          <select
            value={player.position}
            onChange={e => onPositionChange(e.target.value)}
            className={cn(
              "w-full rounded border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500",
              hasError ? "border-red-500/50" : "border-border/50",
            )}
          >
            {POSITIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Stack */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Stack (BB)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={player.stack_bb}
            onChange={e => onStackChange(parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-border/50 bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* Hero cards */}
        {isHero && (
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Hole Cards</label>
            <input
              type="text"
              placeholder="Ah Kd"
              value={cardsInput}
              onChange={e => {
                setCardsInput(e.target.value);
                const parts = e.target.value.trim().split(/\s+/).filter(Boolean);
                if (parts.length === 2 && parts.every(c => /^[2-9TJQKAtjqka][cdhs]$/i.test(c))) {
                  onHeroCardsChange(parts.map(c => c[0].toUpperCase() + c[1].toLowerCase()));
                }
              }}
              className={cn(
                "w-full rounded border bg-background px-1.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500",
                hasError ? "border-red-500/50" : "border-border/50",
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionTimeline({
  actions,
  heroActions,
  errorFields,
  onActionAmountChange,
}: {
  actions: CanonicalAction[];
  heroActions: CanonicalAction[];
  errorFields: Set<string | null | undefined>;
  onActionAmountChange: (sequence: number, amount: number) => void;
}) {
  if (actions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        No actions could be parsed from this hand.
      </p>
    );
  }

  let lastStreet = "";
  return (
    <div className="space-y-1">
      {actions.map(action => {
        const showStreetLabel = action.street !== lastStreet;
        lastStreet = action.street;
        const hasErr = [...errorFields].some(f => f?.includes(`action[${action.sequence}]`));
        const isPosting = ["post_sb","post_bb","post_ante","post_straddle"].includes(action.action);

        return (
          <div key={action.sequence}>
            {showStreetLabel && (
              <div className="flex items-center gap-2 py-1.5">
                <div className="h-px flex-1 bg-border/30" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 px-1">
                  {action.street}
                </span>
                <div className="h-px flex-1 bg-border/30" />
              </div>
            )}
            <div className={cn(
              "flex items-center gap-2 rounded px-2 py-1.5 text-xs",
              action.is_hero
                ? "bg-violet-500/8 border border-violet-500/15"
                : hasErr
                ? "bg-red-500/8 border border-red-500/15"
                : "hover:bg-white/2 border border-transparent",
            )}>
              <div className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                action.is_hero ? "bg-violet-400" : "bg-muted-foreground/30",
              )} />
              <span className={cn(
                "font-medium w-20 truncate shrink-0",
                action.is_hero ? "text-violet-300" : "text-muted-foreground",
              )}>
                {action.is_hero ? "Hero" : action.player_name.slice(0, 8)}
              </span>
              <span className={cn(
                "font-medium w-14 shrink-0",
                action.action === "fold" ? "text-red-400/70" :
                action.action === "raise" || action.action === "bet" ? "text-amber-400" :
                "text-foreground/70",
              )}>
                {ACTION_LABELS[action.action] ?? action.action}
              </span>

              {action.amount_bb > 0 && (
                isPosting ? (
                  <span className="text-muted-foreground/50 ml-auto">
                    {action.amount_bb.toFixed(2)}bb
                  </span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={action.amount_bb}
                    onChange={e =>
                      onActionAmountChange(action.sequence, parseFloat(e.target.value) || 0)
                    }
                    className={cn(
                      "ml-auto w-20 rounded border bg-background px-1 py-0.5 text-right text-[11px] font-mono",
                      "focus:outline-none focus:ring-1 focus:ring-violet-500",
                      hasErr ? "border-red-500/40" : "border-border/40",
                    )}
                  />
                )
              )}

              {action.amount_bb > 0 && !isPosting && (
                <span className="text-muted-foreground/40 text-[10px]">bb</span>
              )}

              <span className="ml-auto text-[10px] text-muted-foreground/30 font-mono shrink-0">
                pot {action.pot_after_bb.toFixed(1)}bb
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardDisplay({ hand }: { hand: CanonicalHand }) {
  const flop   = hand.streets.find(s => s.name === "flop")?.board_cards ?? [];
  const turn   = hand.streets.find(s => s.name === "turn")?.board_cards ?? [];
  const river  = hand.streets.find(s => s.name === "river")?.board_cards ?? [];

  if (flop.length === 0 && turn.length === 0 && river.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        No board cards parsed. This hand may have ended preflop.
      </p>
    );
  }

  const suitColor: Record<string, string> = {
    h: "text-red-400", d: "text-blue-400",
    c: "text-emerald-400", s: "text-foreground",
  };
  const CardChip = ({ card }: { card: { rank: string; suit: string; notation: string } }) => (
    <div className="flex h-9 w-7 items-center justify-center rounded border border-border/50 bg-secondary/50 text-sm font-bold">
      <span className={suitColor[card.suit] ?? "text-foreground"}>
        {card.rank}
        <span className="text-[10px]">{card.suit}</span>
      </span>
    </div>
  );

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {flop.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-8">Flop</span>
          <div className="flex gap-1">
            {flop.map((c, i) => <CardChip key={i} card={c} />)}
          </div>
        </div>
      )}
      {turn.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-8">Turn</span>
          <CardChip card={turn[0]} />
        </div>
      )}
      {river.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-8">River</span>
          <CardChip card={river[0]} />
        </div>
      )}
    </div>
  );
}
