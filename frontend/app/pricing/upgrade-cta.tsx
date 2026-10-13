"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AlreadySubscribedError, startCheckout } from "@/components/poker/UpgradePrompt";
import { refreshEntitlements, useEntitlements } from "@/hooks/useEntitlements";
import { PRO_PRICE_LABEL, type UpgradeSource } from "@/lib/billing/entitlements";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000;

/**
 * The Pro button on /pricing. Signed out it starts the free account (and with
 * it the 7-day trial); signed in it opens Stripe Checkout and waits for the
 * webhook to turn the account Pro.
 */
export function PricingCTA({ loggedIn, onTrial, source }: { loggedIn: boolean; onTrial: boolean; source: UpgradeSource }) {
  const router = useRouter();
  const { entitlements } = useEntitlements();
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);

  // Poll while the Stripe tab is open; the webhook flips the plan.
  useEffect(() => {
    if (!waiting) return;
    startedAt.current = Date.now();
    const t = setInterval(() => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) setWaiting(false);
      else void refreshEntitlements();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [waiting]);

  useEffect(() => {
    if (waiting && entitlements?.plan === "pro") {
      setWaiting(false);
      toast.success("Welcome to Pro!", { description: "Everything is unlimited now.", duration: 6000 });
      router.refresh();
    }
  }, [waiting, entitlements?.plan, router]);

  if (!loggedIn) {
    return (
      <Link
        href="/signup"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white shadow-lg shadow-[#7C5CFF]/30 transition-colors hover:bg-[#6B4BEE]"
      >
        <Sparkles className="h-4 w-4" /> Try Pro free for 7 days
      </Link>
    );
  }

  async function upgrade() {
    setLoading(true);
    setError(null);
    try {
      await startCheckout(source);
      setWaiting(true);
    } catch (e) {
      if (e instanceof AlreadySubscribedError) {
        void refreshEntitlements();
        router.refresh();
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={upgrade}
        disabled={loading || waiting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white shadow-lg shadow-[#7C5CFF]/30 transition-colors hover:bg-[#6B4BEE] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : waiting ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {loading
          ? "Opening checkout…"
          : waiting
            ? "Waiting for payment…"
            : onTrial
              ? `Keep Pro · ${PRO_PRICE_LABEL}/month`
              : `Upgrade to Pro · ${PRO_PRICE_LABEL}/month`}
        {!loading && !waiting && <ArrowRight className="h-4 w-4" />}
      </button>
      {waiting && (
        <p className="text-center text-xs text-white/55">
          Complete payment in the checkout tab.{" "}
          <button type="button" onClick={() => setWaiting(false)} className="underline underline-offset-2 hover:text-white">
            Cancel
          </button>
        </p>
      )}
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
