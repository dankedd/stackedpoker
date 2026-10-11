"use client";

import { useState, type ReactNode } from "react";
import { Bot, Check, FileText, Upload } from "lucide-react";
import type { HomeChart } from "@/lib/home/charts";
import { cn } from "@/lib/utils";
import { StartFreeButton } from "./Cta";
import { InView, useCountUp } from "./InView";
import { Legend, MiniRangeGrid } from "./MiniRangeGrid";

/**
 * "Everything you need, nothing you don't" — six tiles, each with a small
 * animation that plays when the tile comes into view (and replays on hover
 * on desktop). Example numbers are labelled as examples.
 */
export function Bento({ btnOpen }: { btnOpen: HomeChart }) {
  return (
    <section aria-labelledby="bento-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 id="bento-title" className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
        Everything you need, nothing you don&apos;t
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-6">
        <Tile className="md:col-span-3 md:row-span-2" title="Preflop Trainer" text="Opens, defenses and push/fold for MTT and cash. Every answer graded against the full range.">
          <div className="mx-auto mt-4 w-full max-w-[300px]">
            <MiniRangeGrid chart={btnOpen} wave />
            <Legend chart={btnOpen} className="hp-fade mt-2" />
            <p className="hp-fade mt-1 text-[11px] text-white/45" style={{ ["--hp-d" as string]: "900ms" }}>
              {btnOpen.title}
            </p>
          </div>
        </Tile>
        <Tile className="md:col-span-3 md:row-span-2" title="Hand Replayer" text="Step through every hand you played: stacks, pot and actions exactly as they happened.">
          <ReplayerMini />
        </Tile>
        <Tile className="md:col-span-2" title="Hand History Import" text="Drop your PokerCraft (GGPoker) export — zip or txt.">
          <ImportMini />
        </Tile>
        <Tile className="md:col-span-2" title="AI Coach" text="Ask about the hand in front of you.">
          <CoachMini />
        </Tile>
        <Tile className="md:col-span-2" title="Bankroll Tracker" text="Sessions, goals and AI insights.">
          <BankrollMini />
        </Tile>
        <Tile className="md:col-span-6" title="Preflop check" text="Every hand you import is checked against your trainer ranges: too loose, too tight, or the right play.">
          <PreflopCheckMini />
        </Tile>
      </div>
      <div className="mt-8 flex justify-center">
        <StartFreeButton location="bento" />
      </div>
    </section>
  );
}

/** A tile whose animation runs when in view; hovering replays it (desktop). */
function Tile({ title, text, className, children }: { title: string; text: string; className?: string; children: ReactNode }) {
  const [round, setRound] = useState(0);
  return (
    <article
      onMouseEnter={() => setRound((r) => r + 1)}
      className={cn("group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5 transition-colors duration-200 hover:border-violet-400/40", className)}
    >
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-white/65">{text}</p>
      <InView key={round} threshold={0.35}>
        {children}
      </InView>
    </article>
  );
}

const Example = () => <span className="rounded-full border border-white/15 px-1.5 py-px text-[10px] uppercase tracking-wide text-white/50">Example</span>;

function ReplayerMini() {
  const board = ["Q♠", "8♥", "4♦", "J♣", "2♥"];
  const red = (c: string) => c.endsWith("♥") || c.endsWith("♦");
  const actions = ["CO raises 2.5", "BTN calls", "Flop: CO bets 3", "BTN calls", "Turn: check, check", "River: CO bets 9", "BTN calls"];
  return (
    <div className="mt-4 space-y-3">
      <div className="relative mx-auto flex h-28 max-w-sm items-center justify-center rounded-[999px] bg-[radial-gradient(ellipse_at_50%_40%,#17402f,#08190f)]">
        {[0, 1, 2].map((n) => (
          <span
            key={n}
            aria-hidden
            className="hp-chipfly absolute h-4 w-4 rounded-full border-2 border-dashed border-white/70 bg-violet-500"
            style={{ left: `${20 + n * 30}%`, bottom: "8%", ["--hp-tx" as string]: `${(1 - n) * 40}px`, ["--hp-ty" as string]: "-40px", ["--hp-i" as string]: n }}
          />
        ))}
        <div className="flex gap-1" style={{ perspective: 500 }}>
          {board.map((c, n) => (
            <span
              key={c}
              className={cn("hp-flip flex h-11 w-8 items-center justify-center rounded-md bg-white text-sm font-bold", red(c) ? "text-rose-600" : "text-slate-900")}
              style={{ ["--hp-i" as string]: n, ["--hp-d" as string]: "300ms" }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Example />
      </div>
      <ol className="space-y-0.5 font-mono text-[11px]">
        {actions.map((a, n) => (
          <li key={a} className="hp-reveal rounded px-2 py-0.5 text-white/70 odd:bg-white/[0.03]" style={{ ["--hp-i" as string]: n + 2 }}>
            {a}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ImportMini() {
  const [done, setDone] = useState(false);
  const n = useCountUp(1248, done, 800);
  return (
    <div className="mt-4 space-y-2">
      <div className="relative flex h-20 items-center justify-center rounded-2xl border border-dashed border-white/20">
        <span className="hp-drop absolute top-3 flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/80">
          <FileText className="h-3.5 w-3.5" aria-hidden /> export.zip
        </span>
        <Upload className="mt-6 h-4 w-4 text-white/40" aria-hidden />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className="hp-grow-x block h-full bg-violet-500" style={{ ["--hp-i" as string]: 6 }} onAnimationEnd={() => setDone(true)} />
      </div>
      <p className="flex items-center gap-1.5 text-sm text-white/85">
        <Check className="h-4 w-4 text-emerald-400" aria-hidden />
        <span className="font-mono tabular-nums">{n.toLocaleString("en-US")}</span> hands imported <Example />
      </p>
    </div>
  );
}

function CoachMini() {
  return (
    <div className="mt-4 space-y-2 text-[13px]">
      <p className="hp-reveal ml-auto w-fit rounded-2xl rounded-tr-sm bg-violet-600/25 px-3 py-1.5 text-white/90">Was this call correct?</p>
      <div className="flex items-start gap-2">
        <span className="hp-pop flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500" style={{ ["--hp-i" as string]: 3 }}>
          <Bot className="h-3 w-3 text-white" aria-hidden />
        </span>
        <p className="hp-reveal rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.05] px-3 py-1.5 text-white/85" style={{ ["--hp-i" as string]: 8 }}>
          Yes. You needed 37.4% equity and had 49.9% against their shove range.
        </p>
      </div>
      <p className="text-[11px] text-white/45">From a real hand review · chip EV</p>
    </div>
  );
}

function BankrollMini() {
  const [done, setDone] = useState(false);
  const v = useCountUp(1840, done, 900);
  return (
    <div className="mt-4">
      <svg viewBox="0 0 200 70" className="h-20 w-full" aria-hidden>
        <path
          d="M2 60 L30 52 L55 56 L80 40 L105 44 L130 30 L155 33 L180 16 L198 10"
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hp-draw"
          style={{ ["--hp-len" as string]: 260 }}
          onTransitionEnd={() => setDone(true)}
        />
      </svg>
      <p className="flex items-center gap-2 font-mono text-lg font-bold text-emerald-300 tabular-nums">
        +€{v.toLocaleString("en-US")} <Example />
      </p>
    </div>
  );
}

function PreflopCheckMini() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {[
        { label: "Too tight", cls: "border-orange-500/40 bg-orange-500/15 text-orange-200", text: "LJ · 11 BB · 5♣5♥ folded — your range shoves." },
        { label: "Too loose", cls: "border-rose-500/40 bg-rose-500/15 text-rose-200", text: "UTG+1 · 12 BB · Q♥8♥ shoved — your range folds." },
        { label: "Correct", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", text: "BTN · 26 BB · T♠8♦ open-raised." },
      ].map((v, n) => (
        <p key={v.label} className="hp-reveal flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" style={{ ["--hp-i" as string]: n }}>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", v.cls)}>{v.label}</span>
          <span className="text-white/80">{v.text}</span>
        </p>
      ))}
      <span className="text-[11px] text-white/45">From a real tournament import</span>
    </div>
  );
}
