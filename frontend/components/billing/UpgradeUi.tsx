"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AlreadySubscribedError, startCheckout } from "@/components/poker/UpgradePrompt";
import { useAuth } from "@/contexts/AuthContext";
import { refreshEntitlements } from "@/hooks/useEntitlements";
import { PRO_PRICE_LABEL, formatCountdown, type UpgradeSource } from "@/lib/billing/entitlements";
import { trackUpgradePromptShown } from "@/lib/metaPixel";
import { cn } from "@/lib/utils";

/**
 * Upgrade building blocks shared by every limit moment: the button that goes
 * straight to Stripe Checkout (or to sign-up for guests), the limit modal, a
 * live countdown and the small "32/50 hands today" meter.
 */

// ── Button ──────────────────────────────────────────────────────────────────

export function UpgradeButton({
  source,
  className,
  children,
}: {
  source: UpgradeSource;
  className?: string;
  children?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  async function go() {
    if (!user) {
      window.location.assign(`/signup?next=${encodeURIComponent(`/pricing?source=${source}`)}`);
      return;
    }
    setBusy(true);
    try {
      await startCheckout(source);
      setWaiting(true);
    } catch (e) {
      if (e instanceof AlreadySubscribedError) {
        toast.success("You already have Pro.");
        void refreshEntitlements();
      } else {
        toast.error(e instanceof Error ? e.message : "Could not open checkout. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E1A] disabled:opacity-60",
          className,
        )}
      >
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
        {children ?? `Upgrade to Pro · ${PRO_PRICE_LABEL}/month`}
      </button>
      {waiting && (
        <p className="mt-2 text-center text-xs text-white/60" aria-live="polite">
          Finish paying in the Stripe tab. Pro unlocks as soon as the payment goes through.
        </p>
      )}
    </div>
  );
}

// ── Countdown ───────────────────────────────────────────────────────────────

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "4h 12m" until `iso`, ticking. Calls `onDone` once when it reaches zero. */
export function Countdown({ to, onDone }: { to: string; onDone?: () => void }) {
  const now = useNow();
  const left = new Date(to).getTime() - now;
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [left, onDone]);
  return <span className="font-mono tabular-nums">{formatCountdown(left)}</span>;
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function UpgradeModal({
  source,
  title,
  body,
  detail,
  onClose,
  dismissLabel = "Not now",
  children,
}: {
  /** The upgrade moment — also the UpgradePromptShown trigger. */
  source: UpgradeSource;
  title: string;
  body: React.ReactNode;
  /** A line under the body: the reset countdown or the next free date. */
  detail?: React.ReactNode;
  onClose: () => void;
  dismissLabel?: string;
  /** Replaces the upgrade button (e.g. sign-up buttons for guests). */
  children?: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Portals need `document`: render nothing on the server and on the first
  // client pass, so the modal is safe wherever it is mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    trackUpgradePromptShown(source);
  }, [source]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    // Keys must not reach the page behind (the trainer answers on F/C/R and
    // deals on Enter). Stopping propagation leaves the browser's default
    // action alone, so Enter/Space still press the focused button.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key !== "Tab") {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, mounted]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full rounded-t-2xl border border-white/10 bg-[#0B0E1A] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl shadow-black/60 sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#B9A8FF]">
          <Sparkles aria-hidden="true" className="h-3 w-3" /> Pro
        </span>
        <h2 id={titleId} className="mt-3 pr-8 text-lg font-bold leading-snug text-white">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-white/70">{body}</div>
        {detail && (
          <div className="mt-4 rounded-xl border border-[#7C5CFF]/25 bg-[#7C5CFF]/[0.08] px-4 py-3 text-sm text-white/85">{detail}</div>
        )}

        <div className="mt-5 space-y-2.5">{children ?? <UpgradeButton source={source} />}</div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg py-1.5 text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
        >
          {dismissLabel}
        </button>
        <p className="mt-1 text-center text-xs text-white/45">
          {PRO_PRICE_LABEL}/month incl. VAT · cancel anytime ·{" "}
          <Link href={`/pricing?source=${source}`} className="underline underline-offset-2 hover:text-white/70">
            compare plans
          </Link>
        </p>
      </div>
    </div>,
    document.body,
  );
}

// ── Usage meter ─────────────────────────────────────────────────────────────

/** "32/50 hands today". Turns amber at the last unit and red when used up. */
export function UsageMeter({
  used,
  limit,
  label,
  className,
}: {
  used: number;
  limit: number;
  label: string;
  className?: string;
}) {
  const left = limit - used;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs tabular-nums",
        left <= 0
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : left <= Math.max(1, Math.ceil(limit * 0.1))
            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
            : "border-border/60 bg-card/40 text-muted-foreground",
        className,
      )}
      aria-label={`${used} of ${limit} ${label}`}
    >
      <b className="font-mono font-semibold text-foreground">
        {Math.min(used, limit)}/{limit}
      </b>
      {label}
    </span>
  );
}
