"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Zap, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startCheckout } from "@/components/poker/UpgradePrompt";
import { createClient } from "@/lib/supabase/client";

// Poll the user's subscription tier until it becomes pro/admin or times out.
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS  = 10 * 60 * 1_000; // 10 minutes

export function UpgradePricingCTA({
  loggedIn,
  fullWidth = true,
}: {
  loggedIn: boolean;
  fullWidth?: boolean;
}) {
  const router     = useRouter();
  const [loading, setLoading]  = useState(false);
  const [waiting, setWaiting]  = useState(false);
  const [error,   setError]    = useState<string | null>(null);
  const startedAt  = useRef<number>(0);
  // Prevent duplicate checkout sessions from double-clicks or StrictMode
  const inFlight   = useRef(false);

  // Subscription polling — activates after checkout tab is opened
  useEffect(() => {
    if (!waiting) return;

    const supabase = createClient();
    startedAt.current = Date.now();

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

      if (profile?.subscription_tier === "pro" || profile?.subscription_tier === "admin") {
        setWaiting(false);
        toast.success("Welcome to Pro!", {
          description: "Unlimited analyses and all Pro features are now active.",
          duration: 6000,
        });
        router.refresh();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [waiting, router]);

  async function handleUpgrade() {
    if (!loggedIn) {
      router.push("/signup?next=pricing");
      return;
    }
    // Guard against double-click / StrictMode double-invoke
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      // startCheckout() opens the blank tab synchronously (popup-safe),
      // then navigates it to Stripe after the async API call.
      // The original tab never redirects.
      await startCheckout();
      setWaiting(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  const disabled = loading || waiting;

  const buttonLabel = loading
    ? "Opening checkout…"
    : waiting
    ? "Waiting for payment…"
    : loggedIn
    ? "Upgrade to Pro"
    : "Get Pro — €9/month";

  return (
    <div className="space-y-2">
      <button
        onClick={handleUpgrade}
        disabled={disabled}
        className={
          "inline-flex items-center justify-center gap-2.5 rounded-xl " +
          "bg-gradient-to-r from-violet-600 to-blue-500 " +
          "px-6 py-3.5 text-sm font-semibold text-white " +
          "shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 " +
          "hover:-translate-y-0.5 transition-all duration-200 " +
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none " +
          (fullWidth ? "w-full" : "")
        }
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : waiting ? (
          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
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
