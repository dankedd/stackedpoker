"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, RotateCcw, X } from "lucide-react";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { ANSWER_LABEL, SEATS_6, coachLine, displayPos, gradeDemo, type DemoAnswer, type DemoSpot } from "@/lib/home/demoLogic";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { cn } from "@/lib/utils";
import { StartFreeButton } from "./Cta";
import { InView } from "./InView";

const ANSWERS: DemoAnswer[] = ["fold", "call", "raise"];
// Same action colours as every range grid on the site (lib/learn/actionStyles.ts).
const BAR_COLOR: Record<DemoAnswer, string> = { raise: "bg-[#8b5cf6]", call: "bg-[#10b981]", fold: "bg-[rgba(148,163,184,0.35)]" };
const VERDICT = {
  correct: { label: "Right play", icon: Check, flash: "bg-emerald-400", text: "text-emerald-300" },
  mixed: { label: "Mixed — sometimes", icon: Check, flash: "bg-amber-400", text: "text-amber-300" },
  wrong: { label: "Not this time", icon: X, flash: "bg-rose-500", text: "text-rose-300" },
} as const;

/** Seats around an oval, Hero at the bottom; x/y in % of the table box. */
function seatXY(k: number, n: number) {
  const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
  return { x: 50 + 44 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
}

/**
 * The hero's mini-trainer: real spots from the Preflop Trainer's charts
 * (resolved on the server, see lib/home/demoSpots.ts). No account needed.
 */
export function HeroDemo({ spots }: { spots: DemoSpot[] }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<DemoAnswer | null>(null);
  const spot = spots[i];
  const last = i === spots.length - 1;
  const verdict = answer ? gradeDemo(spot, answer) : null;

  const choose = (a: DemoAnswer) => {
    if (answer) return;
    setAnswer(a);
    trackEvent(SEO_EVENTS.heroDemoAnswered, { spot: `${spot.hero}v${spot.opener}_${spot.hand}`, answer: a, verdict: gradeDemo(spot, a), step: i + 1 });
  };

  const heroIdx = SEATS_6.indexOf(spot.hero as (typeof SEATS_6)[number]);
  const openerIdx = SEATS_6.indexOf(spot.opener as (typeof SEATS_6)[number]);

  return (
    <div className="relative w-full rounded-3xl border border-white/10 bg-[#0B1220]/80 p-4 shadow-2xl shadow-black/50 sm:p-5">
      <div className="mb-3 flex items-center justify-between text-xs text-white/60">
        <span className="font-semibold uppercase tracking-wider">Try it · Spot {i + 1} of {spots.length}</span>
        <span className="font-mono">Cash · 6-max · {spot.stackBb} BB</span>
      </div>

      {/* Table */}
      <InView key={i} className="relative mx-auto mb-8 aspect-[4/3] w-full sm:mb-6 sm:aspect-[16/10]" threshold={0.1}>
        <div className="absolute inset-[9%_7%] rounded-[999px] border border-emerald-950/50 bg-[radial-gradient(ellipse_at_50%_40%,#17402f_0%,#0f2c21_60%,#08190f_100%)] shadow-[inset_0_0_40px_rgba(0,0,0,0.55)]" />
        <p className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 text-center font-mono text-[11px] text-emerald-100/70 sm:text-xs">
          Pot {(spot.openBb + 1.5).toFixed(1)} BB
        </p>
        {SEATS_6.map((pos, j) => {
          const k = (j - heroIdx + 6) % 6;
          const { x, y } = seatXY(k, 6);
          const isHero = j === heroIdx;
          // Preflop order LJ, HJ, CO, BTN, SB, BB: everyone before Hero except the opener has folded;
          // seats after Hero have not acted yet (the blinds have posted).
          const folded = j < heroIdx && j !== openerIdx;
          const blind = pos === "SB" ? 0.5 : pos === "BB" ? 1 : 0;
          const bet = j === openerIdx ? spot.openBb : folded ? 0 : blind;
          return (
            <div key={pos} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
              {isHero ? (
                <div className="flex flex-col items-center">
                  <div className="mb-[-6px] flex" style={{ perspective: 600 }}>
                    {spot.cards.map((c, n) => (
                      <span key={c} className="hp-deal" style={{ ["--hp-i" as string]: n + 1, ["--hp-dx" as string]: n ? "-20px" : "20px" }}>
                        <FourColorCard card={c} size="sm" style={{ marginLeft: n ? -10 : 0, transform: `rotate(${n ? 4 : -4}deg)` }} />
                      </span>
                    ))}
                  </div>
                  <span className="relative rounded-lg border border-violet-400/70 bg-[#160c34] px-2.5 py-0.5 text-[11px] font-bold text-violet-200">You · {displayPos(pos)}</span>
                </div>
              ) : (
                <span
                  className={cn(
                    "block rounded-lg border px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]",
                    j === openerIdx ? "border-amber-400/60 bg-amber-400/10 text-amber-200" : "border-white/10 bg-black/30 text-white/60",
                    folded && "opacity-40",
                  )}
                >
                  {displayPos(pos)}
                  {j === openerIdx && <span className="ml-1 font-mono">raise {spot.openBb}</span>}
                  {folded && <span className="ml-1">· fold</span>}
                </span>
              )}
              {bet > 0 && !isHero && (
                <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/40 px-1.5 font-mono text-[10px] text-sky-200">{bet} BB</span>
              )}
            </div>
          );
        })}
        {verdict && <span aria-hidden className={cn("pointer-events-none absolute inset-[9%_7%] rounded-[999px] opacity-0 [animation:hp-flash-good_500ms_var(--hp-ease)]", VERDICT[verdict].flash)} />}
      </InView>

      <p className="mt-2 text-center text-sm text-white/85">
        {displayPos(spot.opener)} opens to {spot.openBb} BB. You&apos;re on the <b>{displayPos(spot.hero)}</b>. Your move?
      </p>

      {/* Answers */}
      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Your action">
        {ANSWERS.map((a) => (
          <button
            key={a}
            type="button"
            disabled={!!answer}
            aria-pressed={answer === a}
            onClick={() => choose(a)}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold transition-[transform,opacity] duration-200 [transition-timing-function:var(--hp-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
              answer === a ? "border-white/60 bg-white/15 text-white" : "border-white/15 bg-white/[0.04] text-white/90 hover:-translate-y-0.5 hover:bg-white/10",
              answer && answer !== a && "opacity-50",
            )}
          >
            {ANSWER_LABEL[a]}
          </button>
        ))}
      </div>

      {/* Result */}
      <div aria-live="polite" className="min-h-[132px]">
        {answer && verdict && (
          <div className="mt-3 space-y-2.5">
            <p className={cn("flex items-center gap-1.5 text-sm font-semibold", VERDICT[verdict].text)}>
              {(() => {
                const Icon = VERDICT[verdict].icon;
                return <Icon className="h-4 w-4" aria-hidden />;
              })()}
              {VERDICT[verdict].label}
            </p>
            <FreqBar freqs={spot.freqs} />
            <CoachBubble key={i} text={coachLine(spot)} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {last ? (
                <StartFreeButton location="demo" size="sm">Get 100+ spots like this → Start training free</StartFreeButton>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setI(i + 1);
                      setAnswer(null);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 px-3.5 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Next hand
                  </button>
                  <StartFreeButton location="demo" size="sm" className="bg-transparent shadow-none ring-1 ring-violet-400/50">
                    Get 100+ spots like this
                  </StartFreeButton>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FreqBar({ freqs }: { freqs: Record<DemoAnswer, number> }) {
  const order: DemoAnswer[] = ["raise", "call", "fold"];
  return (
    <InView className="space-y-1" threshold={0}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5" role="img" aria-label={order.map((a) => `${ANSWER_LABEL[a]} ${Math.round(freqs[a] * 100)}%`).join(", ")}>
        {order.map((a, n) =>
          freqs[a] > 0.004 ? <span key={a} className={cn("hp-grow-x h-full", BAR_COLOR[a])} style={{ width: `${freqs[a] * 100}%`, ["--hp-i" as string]: n }} /> : null,
        )}
      </div>
      <div className="flex gap-3 font-mono text-[11px] text-white/70">
        {order.map((a) => (
          <span key={a} className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", BAR_COLOR[a])} />
            {ANSWER_LABEL[a]} {Math.round(freqs[a] * 100)}%
          </span>
        ))}
      </div>
    </InView>
  );
}

function CoachBubble({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setShown(text.length);
      return;
    }
    const id = setInterval(() => setShown((n) => (n >= text.length ? n : n + 1)), 25);
    return () => clearInterval(id);
  }, [text]);
  return (
    <div className="hp-in flex items-start gap-2">
      <span className="hp-pop flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500">
        <Bot className="h-3.5 w-3.5 text-white" aria-hidden />
      </span>
      <p className="hp-reveal rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] leading-relaxed text-white/90">
        <span className="sr-only">{text}</span>
        <span aria-hidden>
          {text.slice(0, shown)}
          {!done && <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 bg-violet-300/80" />}
        </span>
      </p>
    </div>
  );
}
