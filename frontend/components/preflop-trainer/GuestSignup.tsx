"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { trackCustom } from "@/lib/metaPixel";
import { SIGNUP_NOTICE } from "@/lib/lifecycle/strings";
import { displayPos, scenarioTitle, spotLabel, type Deal, type Verdict } from "@/lib/ranges/logic";
import {
  SOURCE_FOR,
  bannerClosedThisSession,
  bannerVisible,
  closeBannerForSession,
  isGuestVisitor,
  markPromptSeen,
  promptDue,
  readProgress,
  readSeenPrompts,
  recordGuestHand,
  rememberSignupIntent,
  storageAvailable,
  worstSpot,
  type GuestProgress,
  type PromptTrigger,
  type SignupSource,
} from "@/lib/ranges/guestProgress";

/** The spot name a guest sees in "most missed" — the same wording as the result modal. */
export function guestSpotName(deal: Deal): string {
  return deal.type === "def" ? `${displayPos(deal.hero)}, ${spotLabel(deal).replace(/^You/, "you")}` : scenarioTitle(deal);
}

const BANNER_TRACKED_KEY = "sp_guest_banner_tracked";

/**
 * Guest progress and the sign-up prompt for the Preflop Trainer.
 *
 * Signed-in visitors (and visitors whose auth is still loading) get a no-op:
 * nothing is counted and nothing is shown. The prompt is due after hand 5
 * and hand 20, and opens once the result of that hand has been closed.
 */
export function useGuestSignup() {
  const { user, loading } = useAuth();
  const isGuest = isGuestVisitor(user, loading);
  const [enabled, setEnabled] = useState(false);
  const [progress, setProgress] = useState<GuestProgress | null>(null);
  const [seen, setSeen] = useState<PromptTrigger[]>([]);
  const [due, setDue] = useState<PromptTrigger | null>(null);
  const [bannerClosed, setBannerClosed] = useState(false);
  const active = useRef(false);
  active.current = isGuest && enabled;

  // Client only: storage is never read during SSR or hydration.
  useEffect(() => {
    if (!isGuest || !storageAvailable()) {
      setEnabled(false);
      return;
    }
    setEnabled(true);
    setProgress(readProgress());
    setSeen(readSeenPrompts());
    setBannerClosed(bannerClosedThisSession());
  }, [isGuest]);

  const recordHand = useCallback((deal: Deal, verdict: Verdict) => {
    if (!active.current) return;
    const p = recordGuestHand(guestSpotName(deal), verdict);
    if (!p) return;
    setProgress(p);
    const t = promptDue(p.hands_played, readSeenPrompts());
    if (t) setDue(t);
  }, []);

  const showPrompt = useCallback((t: PromptTrigger) => {
    markPromptSeen(t);
    setSeen(readSeenPrompts());
    trackCustom("SignupPromptShown", { trigger: t });
  }, []);

  const closePrompt = useCallback(() => setDue(null), []);
  const closeBanner = useCallback(() => {
    closeBannerForSession();
    setBannerClosed(true);
  }, []);

  return {
    active: isGuest && enabled,
    progress,
    due,
    banner: isGuest && enabled && bannerVisible(seen, bannerClosed),
    recordHand,
    showPrompt,
    closePrompt,
    closeBanner,
  };
}

type Guest = ReturnType<typeof useGuestSignup>;

function returnPath() {
  return window.location.pathname + window.location.search;
}

/** Google / email sign-up and log-in, remembering where to come back to. */
export function useSignupActions(source: SignupSource) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    google: async () => {
      rememberSignupIntent(source, returnPath());
      setBusy(true);
      const next = encodeURIComponent(returnPath());
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${getSiteUrl(window.location.origin)}/auth/callback?next=${next}` },
      });
      if (error) setBusy(false);
    },
    email: () => {
      rememberSignupIntent(source, returnPath());
      router.push("/signup");
    },
    login: () => {
      rememberSignupIntent(source, returnPath());
      router.push("/login");
    },
  };
}

/** Prompt and banner. `resultOpen`: the hand's result modal is still up, so the prompt waits. */
export function GuestSignup({ guest, resultOpen }: { guest: Guest; resultOpen: boolean }) {
  const open = guest.active && guest.due !== null && !resultOpen;
  const { showPrompt, due } = guest;

  useEffect(() => {
    if (open && due) showPrompt(due);
  }, [open, due, showPrompt]);

  useEffect(() => {
    if (!guest.banner || open) return;
    try {
      if (window.sessionStorage.getItem(BANNER_TRACKED_KEY)) return;
      window.sessionStorage.setItem(BANNER_TRACKED_KEY, "1");
    } catch {
      return;
    }
    trackCustom("SignupPromptShown", { trigger: "banner" });
  }, [guest.banner, open]);

  return (
    <>
      {guest.banner && !open && <SaveBanner onClose={guest.closeBanner} />}
      {open && guest.due && guest.progress && (
        <SignupPrompt trigger={guest.due} progress={guest.progress} onClose={guest.closePrompt} />
      )}
    </>
  );
}

function SaveBanner({ onClose }: { onClose: () => void }) {
  const actions = useSignupActions(SOURCE_FOR.banner);
  return (
    <div className="mx-auto mt-4 flex max-w-[860px] items-center gap-3 rounded-xl border border-[#7C5CFF]/30 bg-[#0B0E1A] px-4 py-2.5">
      <p className="min-w-0 flex-1 text-sm text-white/80">Your progress isn&apos;t saved.</p>
      <button
        type="button"
        onClick={actions.email}
        className="shrink-0 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
      >
        Sign up free
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide for this session"
        className="shrink-0 rounded-lg p-1 text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

const COPY: Record<PromptTrigger, { title: string; body: string }> = {
  hand_5: {
    title: "Nice, 5 hands in. Save your progress?",
    body: "Create a free account to keep your stats, see which spots you leak, and pick up where you left off on any device.",
  },
  hand_20: {
    title: "20 hands done. Don't lose them.",
    body: "Right now they only live in this browser. Create a free account to keep your stats, see which spots you leak, and pick up where you left off on any device.",
  },
};

function SignupPrompt({ trigger, progress, onClose }: { trigger: PromptTrigger; progress: GuestProgress; onClose: () => void }) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const actions = useSignupActions(SOURCE_FOR[trigger]);
  const missed = worstSpot(progress);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
    // While the prompt is open the trainer's hotkeys (F, C, R…) must not answer
    // the hand behind it. Tab and Escape still reach the dialog.
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
  }, [onClose]);

  const secondary =
    "flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] disabled:opacity-60";

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

        <h2 id={titleId} className="pr-8 text-lg font-bold leading-snug text-white">
          {COPY[trigger].title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{COPY[trigger].body}</p>

        <div className="mt-4 rounded-xl border border-[#7C5CFF]/25 bg-[#7C5CFF]/[0.08] px-4 py-3 text-sm">
          <p className="font-semibold text-white">
            You got {progress.right}/{progress.hands_played} right
          </p>
          {missed && <p className="mt-0.5 text-white/70">Most missed: {missed}</p>}
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            ref={primaryRef}
            type="button"
            onClick={actions.google}
            disabled={actions.busy}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-violet-600 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E1A] disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button type="button" onClick={actions.email} className={secondary}>
            Sign up with email
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-white/50">{SIGNUP_NOTICE}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg py-1.5 text-sm font-medium text-white/85 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
        >
          Keep practicing as guest
        </button>
        <p className="mt-2 text-center text-xs text-white/60">
          Already have an account?{" "}
          <button type="button" onClick={actions.login} className="font-medium text-violet-300 underline-offset-4 hover:underline">
            Log in
          </button>
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="rounded-full bg-white p-px">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
