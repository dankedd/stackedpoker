"use client";

import { useCallback, useEffect, useState } from "react";
import { patchEntitlements, refreshEntitlements, useEntitlements } from "@/hooks/useEntitlements";
import { FREE_LIMITS } from "@/lib/billing/entitlements";
import { guestHandsToday, nextAmsterdamMidnight, recordGuestDailyHand } from "@/lib/billing/guestLimit";
import { trainerLimitDetail, type TrainerUsage } from "@/lib/ranges/api";
import { Countdown, UpgradeModal, UsageMeter } from "@/components/billing/UpgradeUi";
import { GoogleIcon, useSignupActions } from "./GuestSignup";

/**
 * The Free plan's 50 answered hands per day in the Preflop Trainer.
 *
 * Signed in: the server counts and refuses hand 51 (POST
 * /api/preflop-trainer/hands → 429); this hook mirrors its numbers and shows
 * the limit screen. Signed out: counted in this browser, and hand 51 asks
 * for a free account (which starts the 7-day Pro trial).
 */
export function useTrainerLimit(signedIn: boolean) {
  const { entitlements } = useEntitlements();
  const [guestUsed, setGuestUsed] = useState(0);
  const [guestReady, setGuestReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Client only: storage is never read during SSR.
  useEffect(() => {
    if (signedIn) return;
    setGuestUsed(guestHandsToday());
    setGuestReady(true);
  }, [signedIn]);

  const limit = signedIn ? (entitlements ? entitlements.limits.trainerHandsPerDay : null) : FREE_LIMITS.trainerHandsPerDay;
  const used = signedIn ? (entitlements?.usage.trainerHandsToday ?? 0) : guestUsed;
  const resetAt = signedIn ? (entitlements?.dailyResetAt ?? null) : guestReady ? new Date(nextAmsterdamMidnight(Date.now())).toISOString() : null;
  const known = signedIn ? Boolean(entitlements) : guestReady;
  const blocked = known && limit !== null && used >= limit;

  /** Call before playing a hand: false (and the limit screen) once the day's hands are used. */
  const allowHand = useCallback(() => {
    if (!blocked) return true;
    setDismissed(false);
    return false;
  }, [blocked]);

  const recordGuestHand = useCallback(() => {
    const n = recordGuestDailyHand();
    if (n > 0) setGuestUsed(n);
  }, []);

  /** The usage the server returned with a hand. */
  const applyServerUsage = useCallback((u: TrainerUsage | null | undefined) => {
    if (!u) return;
    patchEntitlements((e) => ({
      ...e,
      usage: { ...e.usage, trainerHandsToday: u.used },
      dailyResetAt: u.reset_at || e.dailyResetAt,
    }));
  }, []);

  /** True when the error was the daily limit (the screen is then shown). */
  const handleServerError = useCallback((err: unknown) => {
    const d = trainerLimitDetail(err);
    if (!d) return false;
    patchEntitlements((e) => ({
      ...e,
      limits: { ...e.limits, trainerHandsPerDay: d.limit },
      usage: { ...e.usage, trainerHandsToday: d.used },
      dailyResetAt: d.reset_at || e.dailyResetAt,
    }));
    setDismissed(false);
    return true;
  }, []);

  const onReset = useCallback(() => {
    if (signedIn) void refreshEntitlements();
    else setGuestUsed(guestHandsToday());
    setDismissed(false);
  }, [signedIn]);

  return {
    signedIn,
    used,
    limit,
    resetAt,
    blocked,
    /** Show the screen: right after the last free hand's result, and on any later attempt. */
    showScreen: blocked && !dismissed,
    dismiss: () => setDismissed(true),
    allowHand,
    recordGuestHand,
    applyServerUsage,
    handleServerError,
    onReset,
  };
}

type TrainerLimit = ReturnType<typeof useTrainerLimit>;

/** Usage meter under the table, and the limit screen. `resultOpen`: the hand's result is still up. */
export function TrainerLimitGate({ limit, resultOpen }: { limit: TrainerLimit; resultOpen: boolean }) {
  const { limit: max, used, resetAt, signedIn } = limit;
  return (
    <>
      {max !== null && (
        <div data-tour="trainer-usage" className="mx-auto mt-3 flex max-w-[860px] justify-center">
          <UsageMeter used={used} limit={max} label="hands today" />
        </div>
      )}
      {limit.showScreen && !resultOpen && max !== null && (
        signedIn ? (
          <UpgradeModal
            source="hand_limit"
            title={`You've hit today's ${max} free hands.`}
            body="Keep drilling with Pro, or come back tomorrow."
            detail={resetAt ? <ResetLine resetAt={resetAt} onReset={limit.onReset} /> : undefined}
            onClose={limit.dismiss}
            dismissLabel="Come back tomorrow"
          />
        ) : (
          <GuestLimitScreen max={max} resetAt={resetAt} onClose={limit.dismiss} onReset={limit.onReset} />
        )
      )}
    </>
  );
}

function ResetLine({ resetAt, onReset }: { resetAt: string; onReset: () => void }) {
  return (
    <>
      Free hands reset in <b className="text-white"><Countdown to={resetAt} onDone={onReset} /></b>
      <span className="text-white/55"> · at 00:00 Amsterdam time</span>
    </>
  );
}

function GuestLimitScreen({
  max,
  resetAt,
  onClose,
  onReset,
}: {
  max: number;
  resetAt: string | null;
  onClose: () => void;
  onReset: () => void;
}) {
  const actions = useSignupActions("trainer_limit");
  return (
    <UpgradeModal
      source="hand_limit"
      title={`You've played ${max} hands today.`}
      body="Create a free account to keep going. New accounts get 7 days of Pro: unlimited hands, tournament reviews and AI Coach. No card needed."
      detail={resetAt ? <ResetLine resetAt={resetAt} onReset={onReset} /> : undefined}
      onClose={onClose}
      dismissLabel="Come back tomorrow"
    >
      <button
        type="button"
        onClick={actions.google}
        disabled={actions.busy}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E1A] disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>
      <button
        type="button"
        onClick={actions.email}
        className="flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
      >
        Sign up with email
      </button>
      <p className="text-center text-xs text-white/60">
        Already have an account?{" "}
        <button type="button" onClick={actions.login} className="font-medium text-violet-300 underline-offset-4 hover:underline">
          Log in
        </button>
      </p>
    </UpgradeModal>
  );
}
