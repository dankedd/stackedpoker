"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import { refreshEntitlements, useEntitlements } from "@/hooks/useEntitlements";
import { FREE_LIMITS, trialDaysLeft, trialEndedRecently, trialEndingSoon, type UpgradeSource } from "@/lib/billing/entitlements";
import { TRIAL } from "@/lib/billing/strings";
import { trackUpgradePromptShown } from "@/lib/metaPixel";
import { createClient } from "@/lib/supabase/client";
import { UpgradeButton, UpgradeModal } from "./UpgradeUi";

/**
 * Site-wide reverse-trial notices, mounted once in the root layout:
 *   - last 3 days of the trial: "Your Pro trial ends in X days" banner
 *   - first visit after the trial: the one-time "Your trial ended" screen
 *   - after that, for TRIAL_ENDED_BANNER_DAYS: "Your Pro trial has ended" banner
 * Both banners go straight to Stripe Checkout and can be dismissed for a day.
 */

const HIDDEN_ON = ["/login", "/signup", "/auth", "/onboarding", "/checkout", "/embed"];
const BANNER_DISMISSED_KEY = "sp_trial_banner_dismissed";

export function BillingNotices() {
  const pathname = usePathname() ?? "";
  const { entitlements } = useEntitlements();
  if (!entitlements || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (entitlements.trialEnded && !entitlements.trialEndedSeen) return <TrialEndedScreen />;
  if (trialEndingSoon(entitlements) && entitlements.trialEndsAt) {
    return (
      <TrialBanner
        source="trial_ending"
        title={TRIAL.endingTitle(trialDaysLeft(entitlements.trialEndsAt))}
        body={TRIAL.endingBody}
        cta={TRIAL.endingCta}
      />
    );
  }
  if (trialEndedRecently(entitlements)) {
    return <TrialBanner source="trial_ended" title={TRIAL.endedTitle} body={TRIAL.endedBody} cta={TRIAL.endedCta} />;
  }
  return null;
}

function TrialBanner({ source, title, body, cta }: { source: UpgradeSource; title: string; body: string; cta: string }) {
  const day = new Date().toDateString();
  const key = `${BANNER_DISMISSED_KEY}:${source}`;
  const [hidden, setHidden] = useState(true);

  // Dismissed for the rest of the day; storage read on the client only.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(key) === day;
    } catch {}
    setHidden(dismissed);
    if (!dismissed) trackUpgradePromptShown(source);
  }, [day, key, source]);

  if (hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:max-w-sm sm:px-0">
      <div role="status" className="relative rounded-2xl border border-[#7C5CFF]/40 bg-[#0B0E1A] p-4 shadow-2xl shadow-black/60 animate-fade-in">
        <button
          type="button"
          aria-label={TRIAL.dismiss}
          onClick={() => {
            try {
              window.localStorage.setItem(key, day);
            } catch {}
            setHidden(true);
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <p className="flex items-center gap-1.5 pr-8 font-semibold text-white">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-[#B9A8FF]" />
          {title}
        </p>
        <p className="mt-1 text-sm text-white/65">{body}</p>
        <div className="mt-3">
          <UpgradeButton source={source}>{cta}</UpgradeButton>
        </div>
      </div>
    </div>
  );
}

const KEEP = [
  `${FREE_LIMITS.trainerHandsPerDay} Preflop Trainer hands a day`,
  `${FREE_LIMITS.tournamentsPerWeek} tournament a week, with every analysis option`,
  `${FREE_LIMITS.aiQuestionsPerDay} AI Coach questions a day`,
  "Your XP, streaks and everything you uploaded",
];

const ADDS = [
  "Unlimited hands",
  "Unlimited tournaments and your full upload history",
  "Unlimited AI Coach",
  "The Flop Explorer: all 1,755 flops, hand by hand",
];

function TrialEndedScreen() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const close = () => {
    setOpen(false);
    // Just chose Free: no "trial has ended" banner on top of that today.
    try {
      window.localStorage.setItem(`${BANNER_DISMISSED_KEY}:trial_ended`, new Date().toDateString());
    } catch {}
    void Promise.resolve(createClient().rpc("mark_trial_ended_seen")).finally(() => void refreshEntitlements());
  };

  return (
    <UpgradeModal
      source="trial_ended"
      title="Your trial ended. Here's what you keep and what Pro adds."
      body={
        <div className="mt-1 grid gap-4 sm:grid-cols-2">
          <List title="Free keeps" items={KEEP} />
          <List title="Pro adds" items={ADDS} accent />
        </div>
      }
      onClose={close}
      dismissLabel="Continue on Free"
    />
  );
}

function List({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  return (
    <div>
      <p className={accent ? "text-xs font-semibold uppercase tracking-wide text-[#B9A8FF]" : "text-xs font-semibold uppercase tracking-wide text-white/50"}>
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-snug text-white/80">
            <Check aria-hidden="true" className={accent ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B9A8FF]" : "mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40"} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
