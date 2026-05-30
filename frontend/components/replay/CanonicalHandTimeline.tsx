"use client";

/**
 * CanonicalHandTimeline
 *
 * Renders a visual hand timeline directly from CanonicalHand data.
 * Zero heuristic content — only parsed facts from the hand history.
 *
 * Shows: hero cards, each street with board cards, every action with
 * player position and amount, and the final pot.
 */

import type { CanonicalHand, CanonicalPlayer, CanonicalAction } from "@/lib/hand-schema";

// ── Action colours ────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  check:  "#94A3B8",
  call:   "#38BDF8",
  bet:    "#34D399",
  raise:  "#F59E0B",
  fold:   "#64748B",
  post_sb: "#475569",
  post_bb: "#475569",
};

function actionColor(type: string): string {
  return ACTION_COLORS[type] ?? "#7C5CFF";
}

function actionVerb(action: CanonicalAction): string {
  switch (action.action) {
    case "check":        return "Checks";
    case "call":         return `Calls  ${action.amount_bb.toFixed(1)}bb`;
    case "bet":          return `Bets  ${action.amount_bb.toFixed(1)}bb`;
    case "raise":        return `Raises  ${action.amount_bb.toFixed(1)}bb`;
    case "fold":         return "Folds";
    case "post_sb":      return `Posts SB  ${action.amount_bb.toFixed(1)}bb`;
    case "post_bb":      return `Posts BB  ${action.amount_bb.toFixed(1)}bb`;
    case "post_ante":    return `Posts ante  ${action.amount_bb.toFixed(1)}bb`;
    case "post_straddle":return `Posts straddle  ${action.amount_bb.toFixed(1)}bb`;
    default:             return action.action;
  }
}

// ── Card chip ─────────────────────────────────────────────────────────────────

function CardChip({ notation }: { notation: string }) {
  const rank = notation.slice(0, -1);
  const suit = notation.slice(-1).toLowerCase();
  const isRed = suit === "h" || suit === "d";
  const symbol: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold font-mono tabular-nums"
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.1)",
        gap: "1px",
      }}
    >
      <span style={{ color: "#E2E8F0" }}>{rank}</span>
      <span style={{ color: isRed ? "#F87171" : "#CBD5E1" }}>{symbol[suit] ?? suit}</span>
    </span>
  );
}

// ── Player label ──────────────────────────────────────────────────────────────

function PlayerLabel({
  player,
  isHero,
}: {
  player: CanonicalPlayer | undefined;
  isHero: boolean;
}) {
  if (!player) return <span style={{ color: "rgba(148,163,184,0.5)" }}>Unknown</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded"
        style={{
          background: isHero ? "rgba(124,92,255,0.15)" : "rgba(255,255,255,0.04)",
          color: isHero ? "#A78BFA" : "rgba(148,163,184,0.55)",
          border: `1px solid ${isHero ? "rgba(124,92,255,0.3)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        {player.position}
      </span>
      {isHero && (
        <span className="text-[8px] font-bold" style={{ color: "rgba(167,139,250,0.5)" }}>
          Hero
        </span>
      )}
    </span>
  );
}

// ── Action row ────────────────────────────────────────────────────────────────

function ActionRow({
  action,
  player,
}: {
  action: CanonicalAction;
  player: CanonicalPlayer | undefined;
}) {
  const color = actionColor(action.action);
  const isPosting = action.action.startsWith("post_");

  if (isPosting) return null; // skip blind/ante posts — not decision points

  return (
    <div className="flex items-center gap-3 py-1.5 px-1">
      <div className="w-24 shrink-0">
        <PlayerLabel player={player} isHero={action.is_hero} />
      </div>
      <span
        className="text-[11px] font-medium tabular-nums"
        style={{ color: action.is_hero ? color : `${color}80` }}
      >
        {actionVerb(action)}
      </span>
      {action.is_hero && action.pot_before_bb > 0 && (action.action === "bet" || action.action === "raise") && (
        <span
          className="text-[8px] font-bold ml-auto tabular-nums"
          style={{ color: "rgba(148,163,184,0.3)" }}
        >
          {Math.round((action.amount_bb / action.pot_before_bb) * 100)}% pot
        </span>
      )}
    </div>
  );
}

// ── Street header ─────────────────────────────────────────────────────────────

const STREET_COLORS: Record<string, string> = {
  preflop: "#7C5CFF",
  flop:    "#7C5CFF",
  turn:    "#38BDF8",
  river:   "#34D399",
};

function StreetHeader({
  streetName,
  boardCards,
  potStart,
}: {
  streetName: string;
  boardCards: Array<{ notation: string }>;
  potStart: number;
}) {
  const color = STREET_COLORS[streetName] ?? "#7C5CFF";
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
      style={{ background: `${color}08`, border: `1px solid ${color}18` }}
    >
      <span
        className="text-[8px] font-black tracking-[0.2em] uppercase"
        style={{ color: `${color}90` }}
      >
        {streetName}
      </span>
      {boardCards.length > 0 && (
        <div className="flex gap-1">
          {boardCards.map(c => <CardChip key={c.notation} notation={c.notation} />)}
        </div>
      )}
      <span className="ml-auto text-[8px] tabular-nums" style={{ color: "rgba(148,163,184,0.3)" }}>
        Pot {potStart.toFixed(1)}bb
      </span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface CanonicalHandTimelineProps {
  hand: CanonicalHand;
}

export default function CanonicalHandTimeline({ hand }: CanonicalHandTimelineProps) {
  const playerById = Object.fromEntries(hand.players.map(p => [p.id, p]));
  const hero = hand.players.find(p => p.is_hero);

  // Only show post-flop streets (solver is flop-onwards)
  const displayStreets = hand.streets.filter(s => s.name !== "preflop");

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(16,8,42,0.65)",
        border: "1px solid rgba(124,92,255,0.15)",
      }}
    >
      {/* Header: hand identity + hero cards */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: "#7C5CFF", boxShadow: "0 0 8px rgba(124,92,255,0.5)" }}
          />
          <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "#A78BFA" }}>
            Hand Replay
          </span>
          <span className="text-[9px]" style={{ color: "rgba(148,163,184,0.3)" }}>
            {hand.site} · {hand.stakes.display}
          </span>
        </div>

        {/* Hero cards */}
        {hero && hero.hole_cards.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "rgba(167,139,250,0.4)" }}>
              Hero ({hero.position})
            </span>
            <div className="flex gap-1">
              {hero.hole_cards.map(c => <CardChip key={c.notation} notation={c.notation} />)}
            </div>
          </div>
        )}
      </div>

      {/* Post-flop streets */}
      <div className="px-4 py-3 space-y-3">
        {displayStreets.map(street => {
          const postFlopActions = street.actions.filter(
            a => !a.action.startsWith("post_"),
          );
          if (postFlopActions.length === 0) return null;

          return (
            <div key={street.name} className="space-y-0.5">
              <StreetHeader
                streetName={street.name}
                boardCards={street.board_cards}
                potStart={street.pot_start_bb}
              />
              <div className="pl-1">
                {postFlopActions.map(action => (
                  <ActionRow
                    key={action.sequence}
                    action={action}
                    player={playerById[action.player_id]}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Final pot */}
        <div
          className="flex items-center justify-end pt-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <span className="text-[9px] font-bold tabular-nums" style={{ color: "rgba(148,163,184,0.4)" }}>
            Final pot: {hand.final_pot_bb.toFixed(1)}bb
          </span>
        </div>
      </div>
    </div>
  );
}
