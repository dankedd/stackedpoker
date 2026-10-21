"use client";

import { CHIP_PALETTE, PokerChip, type ChipTone } from "@/components/poker/ChipStack";
import { DealerMarker, InlineDealerMarker } from "@/components/poker/DealerMarker";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { actionStyle } from "@/lib/learn/actionStyles";
import { actionName, availableActions, betFor, displayPos, seatStatus, seatsFor, spotLabel, villainAllIn, type Deal, type Grade } from "@/lib/ranges/logic";
import { actionSteps, chipsBySeat, stepText } from "@/lib/ranges/betSizes";
import type { RangeActionKey } from "@/lib/ranges/types";
import { cn } from "@/lib/utils";

/**
 * The trainer's table, action buttons and verdict styles — split out of
 * Trainer.tsx so they render without the page's auth and progress context
 * (the ad creatives in /ads/preflop-trainer render them statically).
 */

export const HOTKEY: Record<RangeActionKey, string> = { fold: "F", limp: "L", call: "C", raise: "R", allin: "A" };

export const VERDICT: Record<Grade["verdict"], { label: string; className: string }> = {
  correct: { label: "Correct", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  mixed: { label: "Mixed", className: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  wrong: { label: "Wrong", className: "border-red-500/40 bg-red-500/15 text-red-300" },
};

// ── Table ───────────────────────────────────────────────────────────────────

export function Table({ deal }: { deal: Deal }) {
  const mobile = useIsMobile();
  const seats = seatsFor(deal);
  const n = seats.length;
  const heroIdx = seats.indexOf(deal.hero);
  const rx = mobile ? 40 : 44;
  const ry = mobile ? 42 : 41;
  const fmtLabel = deal.kind === "pf" ? "MTT · push/fold" : deal.fmt === "cash" ? "Cash · 6-max" : "MTT · 9-handed · antes";
  const situation = deal.type === "def" ? spotLabel(deal) : "Folded to you";

  return (
    <div className={cn("relative mx-auto w-full max-w-[860px]", mobile ? "aspect-[4/5]" : "aspect-[16/9.6]")}>
      {/* Rail and felt — same tokens as PreflopTable. */}
      <div
        className="absolute rounded-[999px]"
        style={{
          inset: mobile ? "10% 12%" : "11% 8%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      />
      <div
        className="absolute rounded-[999px] border border-emerald-950/40"
        style={{
          inset: mobile ? "12% 15%" : "13% 10%",
          background: "radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)",
          boxShadow: "inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div className="absolute left-1/2 top-[44%] w-3/5 -translate-x-1/2 -translate-y-1/2 text-center sm:w-4/5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-100/60 sm:text-[11px]">
            {fmtLabel}
            {deal.type === "def" ? " · defense" : ""}
          </p>
          <p className="font-mono text-2xl font-bold tracking-tight text-emerald-50 sm:text-3xl">{deal.stack}bb</p>
          <p className="text-xs text-emerald-100/80 sm:text-sm">{situation}</p>
        </div>
      </div>

      {Array.from({ length: n }, (_, k) => {
        const pos = seats[(heroIdx + k) % n];
        const ang = Math.PI / 2 + (k * 2 * Math.PI) / n;
        const x = 50 + rx * Math.cos(ang);
        const y = 50 + ry * Math.sin(ang);
        const st = seatStatus(deal, pos);
        const bet = betFor(deal, pos);
        // Chips sit between seat and centre. Hero's go nearer the centre to clear the
        // hole cards; on a phone the felt is narrow, so the others stay close to their
        // seat instead of running into the text in the middle.
        const pullX = k === 0 ? 0.3 : mobile ? 0.76 : 0.58;
        const pullY = k === 0 ? 0.3 : mobile ? 0.74 : 0.55;
        const bx = 50 + rx * pullX * Math.cos(ang);
        const by = 50 + ry * pullY * Math.sin(ang);
        const da = ang + (k === 0 ? 0.42 : mobile ? 0.22 : 0.3);
        const dealerPull = mobile && k !== 0 ? 0.82 : 0.62;
        // All-in red, a real bet or raise blue, a posted blind grey.
        const tone: ChipTone =
          bet === `${deal.stack}bb`
            ? "allin"
            : (deal.type === "def" && pos === deal.vil) || (pos === deal.hero && /bet|raise/.test(bet))
              ? "bet"
              : "blind";
        const active = st.state === "hero" || st.state === "villain" || st.state === "waiting";
        return (
          <div key={pos}>
            {/* Every seat — hero included — is centred on the rail, so the pods line up. */}
            <div
              className={cn(
                "absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:w-[92px]",
                st.state === "hero" ? "z-[3]" : "z-[2]",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relative">
                {st.state === "hero" && (
                  // Hole cards rise out of the seat; the name plate overlaps their lower edge.
                  <div className="absolute bottom-[calc(100%-10px)] left-1/2 flex -translate-x-1/2">
                    <FourColorCard card={deal.cards[0]} size={mobile ? "sm" : "md"} style={{ transform: "rotate(-4deg)" }} />
                    <FourColorCard
                      card={deal.cards[1]}
                      size={mobile ? "sm" : "md"}
                      style={{ marginLeft: mobile ? -16 : -20, transform: "rotate(4deg) translateY(-3px)" }}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "relative min-w-[64px] rounded-xl border px-2.5 py-1 text-center shadow-md shadow-black/40 sm:min-w-[84px]",
                    st.state === "hero" && "border-violet-500/70 bg-[rgba(16,8,42,0.96)]",
                    st.state === "villain" && "border-amber-400/50 bg-[rgba(40,30,8,0.92)]",
                    st.state === "folded" && "border-border/40 bg-card/40 opacity-50 shadow-none",
                    st.state === "waiting" && "border-border/60 bg-card/90",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-bold sm:text-[13px]",
                      st.state === "hero" ? "text-violet-300" : st.state === "villain" ? "text-amber-300" : "text-foreground",
                    )}
                  >
                    {displayPos(pos)}
                  </p>
                  <p
                    className={cn(
                      "font-mono text-[10px] font-semibold sm:text-[12px]",
                      active ? "text-sky-300" : "text-muted-foreground",
                    )}
                  >
                    {deal.stack} BB
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  "min-h-3 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide",
                  st.state === "hero" ? "text-violet-300" : st.state === "villain" ? "text-amber-300" : "text-muted-foreground",
                )}
              >
                {st.text}
              </p>
            </div>
            {bet && <BetChips label={bet} tone={tone} left={bx} top={by} size={mobile ? 13 : 16} />}
            {pos === "BN" && (
              <DealerMarker
                style={{
                  left: `${50 + rx * dealerPull * Math.cos(da)}%`,
                  top: `${50 + ry * dealerPull * Math.sin(da)}%`,
                  transform: "translate(-50%,-50%)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Phone table (≤480px) ────────────────────────────────────────────────────

/**
 * The calmer phone table: no stack on other seats (everyone sits on the same
 * effective stack, shown once in the middle), folded seats greyed out without
 * a label, bets as amounts in bb in front of the bettor, and the action so far
 * as one line under the stack with the step Hero answers highlighted.
 *
 * Fixed geometry, measured for 360–430px widths: seats on an oval at 41% of
 * the box, chips between each seat and the middle (see PHONE), Hero's (smaller) cards
 * on Hero's seat between the two neighbours.
 */
// Chips sit at `chipPull` of the way from the middle to the seat, less for seats on the
// left/right edge (wide labels like "20–23" run sideways into the plate). 9-handed, Hero's
// two neighbours sit low next to Hero's cards, so theirs go further out; Hero's own sits
// just above the cards.
const PHONE = { rx: 41, ry: 41, chipPull: 0.64, sideChipPull: 0.05, upperChipPull: 0.03, neighbourChipPull: 0.74, heroChipPull: 0.42 };

export function PhoneTable({ deal }: { deal: Deal }) {
  const seats = seatsFor(deal);
  const n = seats.length;
  const heroIdx = seats.indexOf(deal.hero);
  const chips = deal.type === "def" ? chipsBySeat(deal) : ({ SB: "0.5", BB: "1" } as Record<string, string>);
  const steps = actionSteps(deal);
  const shown = steps.length > 2 ? steps.slice(-2) : steps;
  const allInVil = villainAllIn(deal);

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[430px]" data-phone-table>
      <div
        className="absolute rounded-[999px]"
        style={{
          inset: "10% 12%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      />
      <div
        className="absolute rounded-[999px] border border-emerald-950/40"
        style={{
          inset: "12% 15%",
          background: "radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)",
          boxShadow: "inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div data-phone="center" className="absolute left-1/2 top-[40%] w-max -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-mono text-[28px] font-bold leading-none tracking-tight text-emerald-50">{deal.stack}bb</p>
          {/* One step per line, oldest first (narrow, so it clears the side seats' chips); the step Hero answers is highlighted. */}
          <div className="mt-1.5 text-[10px] leading-snug text-emerald-100/70">
            {shown.length === 0 ? (
              <p>Folded to you</p>
            ) : (
              shown.map((s, i) => (
                <p key={i} className={cn("whitespace-nowrap", i === shown.length - 1 && "font-semibold text-amber-300")}>
                  {i === 0 && steps.length > shown.length && <span className="font-normal text-emerald-100/40">… </span>}
                  {stepText(s)}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {Array.from({ length: n }, (_, k) => {
        const pos = seats[(heroIdx + k) % n];
        const ang = Math.PI / 2 + (k * 2 * Math.PI) / n;
        const x = 50 + PHONE.rx * Math.cos(ang);
        const y = 50 + PHONE.ry * Math.sin(ang);
        const st = seatStatus(deal, pos);
        const isHero = st.state === "hero";
        const pull = isHero
          ? PHONE.heroChipPull
          : n === 9 && (k === 1 || k === n - 1)
            ? PHONE.neighbourChipPull
            : // Upper seats' chips hang down towards the stack and action line: keep them nearer their seat.
              PHONE.chipPull - PHONE.sideChipPull * Math.abs(Math.cos(ang)) + (Math.sin(ang) < -0.2 ? PHONE.upperChipPull : 0);
        const bet = chips[pos];
        // Villain's all-in red, a raise blue, a posted blind grey.
        const tone: ChipTone =
          deal.type === "def" && pos === deal.vil && allInVil
            ? "allin"
            : (deal.type === "def" && pos === deal.vil && deal.spot !== "limp") || (isHero && deal.type === "def" && bet && !["0.5", "1"].includes(bet))
              ? "bet"
              : "blind";
        return (
          <div key={pos}>
            <div
              data-phone="seat"
              data-pos={pos}
              className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center", isHero ? "z-[3]" : "z-[2]")}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relative">
                {/* Dealer button on the seat's label, on the side away from the chip (never on the felt). */}
                {pos === "BN" && <InlineDealerMarker below={Math.sin(ang) > 0.01} />}
                {isHero && (
                  <div data-phone="cards" className="absolute bottom-[calc(100%-8px)] left-1/2 flex -translate-x-1/2">
                    <FourColorCard card={deal.cards[0]} size="xs" style={{ transform: "rotate(-4deg)" }} />
                    <FourColorCard card={deal.cards[1]} size="xs" style={{ marginLeft: -12, transform: "rotate(4deg) translateY(-2px)" }} />
                  </div>
                )}
                <div
                  className={cn(
                    "relative rounded-lg border px-2 py-0.5 text-center shadow-md shadow-black/40",
                    isHero ? "min-w-[58px] border-violet-500/70 bg-[rgba(16,8,42,0.96)]" : "min-w-[46px]",
                    st.state === "villain" && "border-amber-400/70 bg-[rgba(40,30,8,0.92)] ring-1 ring-amber-400/40",
                    st.state === "folded" && "border-border/40 bg-card/40 opacity-[0.35] shadow-none",
                    st.state === "waiting" && "border-border/60 bg-card/90",
                  )}
                >
                  <p className={cn("text-[11px] font-bold", isHero ? "text-violet-300" : st.state === "villain" ? "text-amber-300" : "text-foreground")}>
                    {displayPos(pos)}
                  </p>
                  {/* Every seat has the effective stack; only Hero's is shown. */}
                  {isHero && <p className="font-mono text-[10px] font-semibold text-sky-300">{deal.stack}bb</p>}
                </div>
              </div>
            </div>
            {bet && (
              <div data-phone="chip" data-pos={pos}>
                <BetChips
                  label={bet}
                  tone={tone}
                  left={50 + PHONE.rx * pull * Math.cos(ang)}
                  top={50 + PHONE.ry * pull * Math.sin(ang)}
                  size={12}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A seat's committed chips: the same two-chip pile as ChipStack (PokerChip +
 * CHIP_PALETTE, shared with PreflopTable), but with a free-text label because
 * a 3-bet or 4-bet here has no size in the source data.
 */
function BetChips({ label, tone, left, top, size }: { label: string; tone: ChipTone; left: number; top: number; size: number }) {
  const spread = Math.max(3, Math.round(size * 0.22));
  return (
    <div
      className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div className="relative" style={{ width: size + spread, height: size + spread }}>
        <PokerChip tone={tone} sizePx={size} style={{ left: 0, top: spread, opacity: 0.7 }} />
        <PokerChip tone={tone} sizePx={size} style={{ left: spread, top: 0 }} />
      </div>
      <span
        className={cn(
          "whitespace-nowrap rounded-full bg-black/40 px-1.5 py-px font-mono text-[10px] font-bold leading-tight sm:text-[11px]",
          CHIP_PALETTE[tone].text,
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

const BUTTON_CLASS: Record<RangeActionKey, string> = {
  fold: "border border-border bg-card/60 text-foreground hover:bg-card",
  limp: `${actionStyle("limp").bg} text-white hover:brightness-110`,
  call: `${actionStyle("call").bg} text-white hover:brightness-110`,
  raise: `${actionStyle("raise").bg} text-white hover:brightness-110`,
  allin: `${actionStyle("allin").bg} text-white hover:brightness-110`,
};

/** `phone`: the all-in button drops its "60bb" — the stack is already in the middle of the table. */
export function ActionButtons({ deal, onChoose, disabled, phone }: { deal: Deal; onChoose: (k: RangeActionKey) => void; disabled: boolean; phone?: boolean }) {
  const keys = availableActions(deal);
  const raiseLabel =
    deal.type === "open" && deal.kind === "freq"
      ? deal.chart.actions.find((a) => a.key === "raise")?.label.replace("Raise ", "")
      : undefined;
  return (
    <>
      <div
        className={cn(
          "mx-auto mt-5 grid gap-2.5 md:mt-7",
          keys.length === 4 ? "max-w-[640px] grid-cols-2 sm:grid-cols-4" : keys.length === 3 ? "max-w-[540px] grid-cols-3" : "max-w-[360px] grid-cols-2",
        )}
        role="group"
        aria-label="Your action"
      >
        {keys.map((k) => {
          // The size stays on every screen; the hotkey letter only where there is a keyboard.
          const size = k === "allin" ? (phone ? undefined : `${deal.stack}bb`) : k === "raise" ? raiseLabel : undefined;
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChoose(k)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[15px] font-bold md:py-3 transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                BUTTON_CLASS[k],
              )}
            >
              {actionName(k, deal)}
              <small className={cn("mt-0.5 text-[11px] font-medium opacity-80", size ? "block" : "hidden md:block")}>
                {size}
                <span className="hidden md:inline">
                  {size && " · "}
                  {HOTKEY[k]}
                </span>
              </small>
            </button>
          );
        })}
      </div>
      {villainAllIn(deal) && (
        <p className="mt-2.5 text-center text-xs text-muted-foreground md:hidden">Villain is all-in: fold or call</p>
      )}
      {/* Keyboard shortcuts mean nothing on a phone. */}
      <p className="mt-2.5 hidden text-center text-xs text-muted-foreground md:block">
        {villainAllIn(deal) ? "Villain is all-in: fold or call · " : "Shortcuts: "}
        {keys.map((k) => HOTKEY[k]).join(" · ")}, Enter for the next hand
      </p>
    </>
  );
}
