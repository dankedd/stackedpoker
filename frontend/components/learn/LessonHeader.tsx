"use client";

import Link from "next/link";
import { ChevronLeft, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { LESSON_HEADER_ATTR } from "@/lib/learn/lessonScroll";

/**
 * The lesson-page header — the one place a learner reads "where am I, what am
 * I taking, how far am I, what does it pay".
 *
 * Mobile (<640px) and desktop (>=640px) are two *separate* layouts rather than
 * one layout squeezed down, because the desktop shape (back | centered title +
 * per-step dots | XP badge, all on a single 3-column row) has nowhere near
 * enough horizontal room on a 320-375px viewport: the back label clips, the
 * title fights the dots for the middle column, and a 14-dot row renders as an
 * unreadable smear of 1.5px marks.
 *
 *   Mobile   — row 1: ← Back / XP badge (both >=44px touch targets)
 *              row 2: centered lesson title (up to two lines)
 *              row 3: "Step 5 of 14" + "36% Complete", over a full-width bar
 *   Desktop  — unchanged from the original 3-column grid, dots included.
 *
 * Both variants live in the DOM and are swapped with `sm:hidden` /
 * `hidden sm:grid`; the desktop branch below is a verbatim copy of the
 * previous markup (its `px-4 sm:px-6` / `gap-2 sm:gap-4` / `max-w-[10rem]
 * sm:max-w-xs` pairs collapsed to their >=sm value, since it now only ever
 * renders at >=sm).
 */

// ── Step progress dots (desktop only) ─────────────────────────────────────────
// Three visual states, independent of the header's left/right content:
//  - completed (i < current): solid violet
//  - current   (i === current): larger + brighter, the focal point
//  - upcoming  (i > current): dark gray, deliberately recessive
//
// Deliberately absent on mobile: at 14+ steps the row is simultaneously too
// wide for the viewport and too small to read. The mobile bar replaces it.

function HeaderDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-300",
              i < current && "h-1.5 w-4 bg-violet-500",
              i === current && "h-2.5 w-2.5 bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)] ring-2 ring-violet-400/30",
              i > current && "h-1.5 w-1.5 bg-zinc-700"
            )}
          />
        ))}
      </div>
      <p className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
        {Math.min(current + 1, total)} / {total}
      </p>
    </div>
  );
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

/** The sticky, blurred bar every lesson-page header sits in.
 *
 *  The data attribute is how lessonScroll.ts measures how much of the viewport
 *  this header covers, so scrolling a step card "to the top" parks it just
 *  below the header instead of behind it. */
function HeaderShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      {...{ [LESSON_HEADER_ATTR]: '' }}
      className="relative z-40 sticky top-0 border-b border-border/25 bg-background/90 backdrop-blur-md"
    >
      {children}
    </div>
  );
}

/** Back control. The mobile variant pads out to a 44x44 touch target and always
 *  reads "Back" — the module title is the one label that cannot be guaranteed
 *  to fit beside the XP badge at 320px, and it is the first thing to clip. */
function BackLink({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant: "mobile" | "desktop";
}) {
  if (variant === "mobile") {
    return (
      <Link
        href={href}
        className="-ml-2 inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:bg-white/5"
      >
        <ChevronLeft className="h-5 w-5 shrink-0" />
        Back
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors justify-self-start min-w-0 group"
    >
      <ChevronLeft className="h-4 w-4 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function XPBadge({ xp, className }: { xp: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold shrink-0 text-amber-400 bg-amber-500/8 border border-amber-500/15 px-2.5 py-1 rounded-full",
        className
      )}
    >
      <Star className="h-3 w-3 fill-amber-400/50" />
      {xp} XP
    </div>
  );
}

// ── Full lesson header ────────────────────────────────────────────────────────

interface LessonHeaderProps {
  /** Where "Back" goes — the parent module, or /learn if it can't be resolved. */
  backHref: string;
  /** Desktop-only back label (the module title). Mobile always says "Back". */
  backLabel: string;
  title: string;
  /** Zero-based index of the step on screen. */
  currentStep: number;
  totalSteps: number;
  xpReward: number;
}

export function LessonHeader({
  backHref,
  backLabel,
  title,
  currentStep,
  totalSteps,
  xpReward,
}: LessonHeaderProps) {
  // Injected adaptive steps can push the live index past the authored step
  // count, so clamp rather than letting the header read "Step 15 of 14".
  const stepNumber = totalSteps > 0 ? Math.min(currentStep + 1, totalSteps) : 0;
  // The step on screen counts as reached — "Step 5 of 14" reads as 36%, which
  // is what a learner expects, not the 29% a completed-steps-only ratio gives.
  const pct = totalSteps > 0 ? Math.round((stepNumber / totalSteps) * 100) : 0;

  return (
    <HeaderShell>
      {/* ── Mobile ─────────────────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pt-1.5 pb-3.5">
        {/* Row 1 — navigation and reward: the two things that never change
            during the lesson, pushed to opposite edges and out of the way. */}
        <div className="flex items-center justify-between gap-3">
          <BackLink href={backHref} label={backLabel} variant="mobile" />
          <XPBadge xp={xpReward} className="px-3 py-1.5" />
        </div>

        {/* Row 2 — which lesson. Two lines are allowed; anything longer is
            clamped rather than pushing the progress row further down. */}
        <p className="mt-2 px-4 text-center text-[15px] font-semibold leading-snug text-foreground/90 line-clamp-2 break-words">
          {title}
        </p>

        {/* Row 3 — how far in. */}
        <div className="mt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold tabular-nums text-foreground/70">
              Step {stepNumber} of {totalSteps}
            </span>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {pct}% Complete
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`Step ${stepNumber} of ${totalSteps}`}
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Desktop (unchanged) ────────────────────────────────────────────────
          A 3-column grid (1fr / auto / 1fr) keeps the center column's midpoint
          locked to the viewport center: unlike a flex `justify-between` layout,
          unequal left/right content widths (a long module name vs. a
          fixed-width XP badge) can never pull it off-center. */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3.5">
        <BackLink href={backHref} label={backLabel} variant="desktop" />

        {/* Center — title + step dots, always the grid's true middle column */}
        <div className="flex flex-col items-center gap-1.5 min-w-0">
          <p className="text-xs font-semibold text-foreground/80 truncate max-w-xs">
            {title}
          </p>
          <HeaderDots total={totalSteps} current={currentStep} />
        </div>

        <XPBadge xp={xpReward} className="justify-self-end" />
      </div>
    </HeaderShell>
  );
}

// ── Status header (completion screen) ─────────────────────────────────────────

/** The stripped-back header shown once the lesson itself is over: back control
 *  plus a status word. Shares LessonHeader's shell and its 44px mobile touch
 *  target so the two never read as different products. */
export function LessonStatusHeader({
  backHref,
  backLabel,
  status,
}: {
  backHref: string;
  backLabel: string;
  status: string;
}) {
  return (
    <HeaderShell>
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-1.5 sm:py-3.5">
        <div className="min-w-0 sm:hidden">
          <BackLink href={backHref} label={backLabel} variant="mobile" />
        </div>
        <div className="hidden min-w-0 sm:block">
          <BackLink href={backHref} label={backLabel} variant="desktop" />
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/60">
          {status}
        </span>
      </div>
    </HeaderShell>
  );
}
