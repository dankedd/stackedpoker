"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, RotateCcw } from "lucide-react";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { cn } from "@/lib/utils";
import { StartFreeButton } from "./Cta";
import { InView } from "./InView";

/**
 * A real hand from a hand-history import (anonymised): Hero calls an all-in
 * with A♥Q♦ against J♠J♦. The numbers in the coach callout are the replayer's
 * own analysis of that hand (pot odds and equity against the villain's
 * trainer range), not invented.
 */
const STEPS = [
  { text: "UTG+1 raises to 2 BB", board: 0 },
  { text: "HJ goes all-in for 16 BB", board: 0 },
  { text: "You (BB) call all-in with A♥Q♦", board: 0 },
  { text: "HJ shows J♠J♦", board: 0, show: true },
  { text: "Flop 6♣ 8♠ 7♣", board: 3, show: true },
  { text: "Turn K♠", board: 4, show: true },
  { text: "River 4♠ — JJ holds", board: 5, show: true },
];
const BOARD = ["6c", "8s", "7c", "Ks", "4s"];

export function ReviewShowcase() {
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(STEPS.length - 1);
      return;
    }
    setStep(0);
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS.length - 1) {
          if (timer.current) clearInterval(timer.current);
          return s;
        }
        return s + 1;
      });
    }, 900);
  };
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const cur = STEPS[Math.max(0, step)];
  const finished = step >= STEPS.length - 1;

  return (
    <section aria-labelledby="review-title" className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
      <div>
        <h2 id="review-title" className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Find your leaks in hands you actually played.
        </h2>
        <ul className="mt-6 space-y-3 text-[16px] text-white/80">
          {["Upload your PokerCraft export in seconds", "Replay every hand street by street", "The AI coach flags the costly decisions — with real numbers"].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              {t}
            </li>
          ))}
        </ul>
        <StartFreeButton location="showcase" className="mt-8">
          Review your hands free
        </StartFreeButton>
      </div>

      <InView key={run} onEnter={start} threshold={0.45} className="rounded-3xl border border-white/10 bg-[#0B1220]/80 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-white/55">
          <span className="font-semibold uppercase tracking-wider">Hand replayer</span>
          <span className="font-mono">Tournament · Level 19 · 1,500/3,000</span>
        </div>
        <div className="relative flex aspect-[16/9] items-center justify-center rounded-[999px] bg-[radial-gradient(ellipse_at_50%_40%,#17402f,#08190f)]">
          <div className="absolute left-1/2 top-[10%] flex -translate-x-1/2 gap-1 transition-opacity duration-300" style={{ opacity: cur.show && step >= 0 ? 1 : 0 }}>
            <FourColorCard card="Js" size="sm" />
            <FourColorCard card="Jd" size="sm" style={{ marginLeft: -12 }} />
          </div>
          <div className="flex gap-1">
            {BOARD.map((c, n) => (
              <span key={c} className="transition-[opacity,transform] duration-300 [transition-timing-function:var(--hp-ease)]" style={{ opacity: n < cur.board ? 1 : 0, transform: n < cur.board ? "none" : "translateY(-8px)" }}>
                <FourColorCard card={c} size="sm" style={{ width: 40, height: 56 }} />
              </span>
            ))}
          </div>
          <div className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 gap-1">
            <FourColorCard card="Ah" size="sm" />
            <FourColorCard card="Qd" size="sm" style={{ marginLeft: -12 }} />
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-1 gap-0.5 font-mono text-[12px] sm:grid-cols-2" aria-label="Actions">
          {STEPS.map((s, n) => (
            <li key={s.text} className={cn("rounded px-2 py-0.5 transition-colors duration-200", n === step ? "bg-violet-500/25 text-white" : n < step ? "text-white/60" : "text-white/50")}>
              {s.text}
            </li>
          ))}
        </ol>
        <div aria-live="polite" className="min-h-[92px]">
          {finished && (
            <div className="hp-in mt-3 flex items-start gap-2">
              <span className="hp-pop flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500">
                <Bot className="h-3.5 w-3.5 text-white" aria-hidden />
              </span>
              <p className="hp-reveal rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] leading-relaxed text-white/90">
                The call was right, even though JJ held: you needed <b className="font-mono">37.4%</b> equity and had{" "}
                <b className="font-mono">49.9%</b> against the HJ&apos;s shove range. That&apos;s chip EV — ICM can change it near the money.
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/60 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
        </button>
      </InView>
    </section>
  );
}
