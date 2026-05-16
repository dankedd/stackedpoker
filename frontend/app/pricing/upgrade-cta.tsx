"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Zap, ArrowRight, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startCheckout } from "@/components/poker/UpgradePrompt";
import { createClient } from "@/lib/supabase/client";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS  = 10 * 60 * 1_000;

export function UpgradePricingCTA({
  plan = "pro",
  loggedIn,
  fullWidth = true,
}: {
  plan?: "pro" | "premium";
  loggedIn: boolean;
  fullWidth?: boolean;
}) {
  const router     = useRouter();
  const [loading, setLoading]  = useState(false);
  const [waiting, setWaiting]  = useState(false);
  const [error,   setError]    = useState<string | null>(null);
  const startedAt  = useRef<number>(0);
  const inFlight   = useRef(false);

  useEffect(() => {
    if (!waiting) return;

    const supabase = createClient();
    startedAt.current = Date.now();

    const targetTier = plan === "premium" ? "premium" : "pro";

    const interval = setInterval(async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setWaiting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      const t = profile?.subscription_tier;
      const activated =
        t === "admin" ||
        t === targetTier ||
        (targetTier === "pro" && t === "premium");

      if (activated) {
        setWaiting(false);
        toast.success(`Welcome to ${plan === "premium" ? "Premium" : "Pro"}!`, {
          description: plan === "premium"
            ? "Unlimited access to everything is now active."
            : "30 analyses per day and all Pro features are now active.",
          duration: 6000,
        });
        router.refresh();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [waiting, router, plan]);

  async function handleUpgrade() {
    if (!loggedIn) {
      router.push(`/signup?next=pricing`);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      await startCheckout(plan);
      setWaiting(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  const disabled = loading || waiting;

  const isPremium = plan === "premium";

  const buttonLabel = loading
    ? "Opening checkout…"
    : waiting
    ? "Waiting for payment…"
    : loggedIn
    ? isPremium ? "Go Premium" : "Upgrade to Pro"
    : isPremium ? `Go Premium — €34.99/month` : `Get Pro — €14.99/month`;

  return (
    <div className="space-y-2">
      <button
        onClick={handleUpgrade}
        disabled={disabled}
        className={
          "inline-flex items-center justify-center gap-2.5 rounded-xl " +
          (isPremium
            ? "bg-gradient-to-r from-amber-600 to-amber-500 shadow-lg shadow-amber-900/30 hover:shadow-amber-900/50 hover:from-amber-500 hover:to-amber-400 "
            : "bg-gradient-to-r from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 ") +
          "px-6 py-3.5 text-sm font-semibold text-white " +
          "hover:-translate-y-0.5 transition-all duration-200 " +
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none " +
          (fullWidth ? "w-full" : "")
        }
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : waiting ? (
          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
        ) : isPremium ? (
          <Crown className="h-4 w-4 shrink-0" />
        ) : (
          <Zap className="h-4 w-4 shrink-0" />
        )}
        {buttonLabel}
        {!loading && !waiting && <ArrowRight className="h-4 w-4 shrink-0" />}
      </button>

      {waiting && (
        <p className="text-center text-xs text-muted-foreground">
          Complete payment in the checkout tab.{" "}
          <button
            onClick={() => setWaiting(false)}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
