"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Coach marks over the real UI: the target is highlighted, the rest dimmed,
 * with Next / Back / Skip tour and progress dots. Desktop gets a card next to
 * the target, narrow screens a bottom (or top) sheet that never covers it.
 *
 * - Escape skips the tour; focus moves to each new step.
 * - A target that does not show up within MISSING_MS is skipped, so a slow
 *   or missing element never leaves the tour hanging.
 * - `interactive` steps let clicks through to the highlighted element (e.g.
 *   the action buttons); `advanceWhen` moves on by itself once it is true.
 */

export interface TourStep {
  id: string;
  /** CSS selector; the first visible match is highlighted. null = centred card, everything dimmed. */
  target: string | null;
  title: string;
  body: React.ReactNode;
  /** Clicks reach the highlighted element. */
  interactive?: boolean;
  /** Polled while the step is open; true moves to the next step. Hides "Next". */
  advanceWhen?: () => boolean;
  /** Shown instead of "Next" while waiting for advanceWhen. */
  waitingHint?: string;
  /** Replaces the Next/Back row (the finish step's own buttons). */
  actions?: React.ReactNode;
  /** Wider centred card (e.g. the PokerCraft screenshots). */
  wide?: boolean;
  /** The closing card: not counted in the progress (1/4 …). */
  final?: boolean;
  /** No Back button (going back would undo what the step waits for). */
  noBack?: boolean;
}

const MISSING_MS = 3000;
const PAD = 8;
const CARD_W = 360;
const MARGIN = 16;
const NARROW = 640;

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(selector: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function CoachMarks({
  steps,
  index,
  onIndexChange,
  onSkip,
  onFinish,
  label,
}: {
  steps: TourStep[];
  index: number;
  onIndexChange: (i: number) => void;
  onSkip: () => void;
  /** "Next" on the last step. */
  onFinish: () => void;
  /** Tour name for screen readers, e.g. "Preflop Trainer tour". */
  label: string;
}) {
  const step = steps[index];
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const last = index === steps.length - 1;
  const counted = steps.filter((s) => !s.final);

  useEffect(() => setMounted(true), []);

  const next = useCallback(() => (last ? onFinish() : onIndexChange(index + 1)), [last, onFinish, onIndexChange, index]);

  // Find the target, follow it while the step is open, skip it if it never comes.
  useLayoutEffect(() => {
    if (!step) return;
    setRect(null);
    if (!step.target) return;
    const started = Date.now();
    let scrolled = false;
    let raf = 0;
    let skipped = false;
    const tick = () => {
      const el = findTarget(step.target!);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const r = el.getBoundingClientRect();
        setRect((p) =>
          p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height
            ? p
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      } else if (!scrolled && Date.now() - started > MISSING_MS && !skipped) {
        skipped = true;
        next();
        return;
      } else if (scrolled) {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Steps that finish themselves (the user played the hand, closed the result…).
  useEffect(() => {
    if (!step?.advanceWhen) return;
    const t = setInterval(() => {
      if (step.advanceWhen!()) next();
    }, 150);
    return () => clearInterval(t);
  }, [step, next]);

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Escape skips; focus follows the steps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onSkip]);

  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
  }, [index, mounted]);

  if (!mounted || !step) return null;

  const narrow = vw > 0 && vw < NARROW;
  const hole = rect && {
    top: Math.max(0, rect.top - PAD),
    left: Math.max(0, rect.left - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // Card position: next to the target on desktop, a sheet on phones.
  let cardStyle: React.CSSProperties = {};
  let sheet: "bottom" | "top" | null = null;
  if (narrow) {
    // A target that fills most of the screen (a modal) keeps its controls at
    // the bottom, so the sheet goes on top; otherwise opposite the target.
    sheet = hole && (hole.height > vh * 0.6 || hole.top + hole.height / 2 > vh * 0.55) ? "top" : "bottom";
  } else if (hole) {
    const width = Math.min(CARD_W, vw - MARGIN * 2);
    const left = Math.min(Math.max(MARGIN, hole.left + hole.width / 2 - width / 2), vw - width - MARGIN);
    const below = hole.top + hole.height + 12;
    const spaceBelow = vh - below;
    const spaceRight = vw - (hole.left + hole.width) - MARGIN * 2;
    const spaceLeft = hole.left - MARGIN * 2;
    const sideTop = Math.min(Math.max(MARGIN, hole.top), vh - 260);
    cardStyle =
      spaceBelow > 220
        ? { top: below, left, width }
        : hole.top > 240
          ? { bottom: vh - hole.top + 12, left, width }
          : spaceRight >= 280
            ? { top: sideTop, left: hole.left + hole.width + MARGIN, width: Math.min(CARD_W, spaceRight) }
            : spaceLeft >= 280
              ? { top: sideTop, left: MARGIN, width: Math.min(CARD_W, spaceLeft) }
              : { top: MARGIN, left: vw - width - MARGIN, width };
  }

  // No CSS transition on these: the hole must stick to the target while the page scrolls.
  const dim = "pointer-events-auto fixed bg-black/65";
  const overlay = hole ? (
    <>
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
      <div className={dim} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
      <div className={dim} style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
      <div className={dim} style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-xl ring-2 ring-[#7C5CFF] shadow-[0_0_0_4px_rgba(124,92,255,0.25)]"
        style={hole}
      />
      {/* Non-interactive steps: the highlighted element is shown, not clickable. */}
      {!step.interactive && <div className="pointer-events-auto fixed" style={hole} />}
    </>
  ) : (
    <div className="pointer-events-auto fixed inset-0 bg-black/65" />
  );

  const centred = !hole && !narrow;

  // The layer itself lets clicks through; the dimmed parts and the card block them.
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {overlay}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-label={step.final ? label : `${label}, step ${index + 1} of ${counted.length}`}
        className={cn(
          "pointer-events-auto fixed z-[91] border border-white/10 bg-[#0B0E1A] p-5 text-white shadow-2xl shadow-black/60 animate-fade-in",
          sheet === "bottom" && "inset-x-0 bottom-0 rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          sheet === "top" && "inset-x-0 top-0 rounded-b-2xl pt-[max(1.25rem,env(safe-area-inset-top))]",
          !sheet && "rounded-2xl",
          centred && "left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
          centred && (step.wide ? "max-w-2xl" : "max-w-md"),
          sheet && "max-h-[70vh] overflow-y-auto",
        )}
        style={sheet || centred ? undefined : cardStyle}
      >
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip tour"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        {!step.final && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B9A8FF]">
            {index + 1}/{counted.length}
          </p>
        )}
        <h2 id={titleId} className="mt-1 pr-8 text-base font-bold leading-snug">
          {step.title}
        </h2>
        <div id={bodyId} className="mt-1.5 text-sm leading-relaxed text-white/75">
          {step.body}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {!step.final && (
            <ol className="flex gap-1.5" aria-hidden="true">
              {counted.map((s, i) => (
                <li key={s.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-[#7C5CFF]" : "w-1.5 bg-white/25")} />
              ))}
            </ol>
          )}
          <div className={cn("flex items-center gap-2", step.final ? "w-full sm:ml-auto sm:w-auto" : "ml-auto")}>
            {step.actions ?? (
              <>
                {index > 0 && !step.noBack && (
                  <button
                    type="button"
                    onClick={() => onIndexChange(index - 1)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                  >
                    Back
                  </button>
                )}
                {step.advanceWhen ? (
                  <span className="text-xs font-medium text-[#D6CCFF]" aria-live="polite">
                    {step.waitingHint ?? "Waiting…"}
                  </span>
                ) : (
                  <button
                    type="button"
                    data-primary
                    onClick={next}
                    className="rounded-lg bg-[#7C5CFF] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E1A]"
                  >
                    {last ? "Done" : "Next"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {!step.actions && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-3 text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
