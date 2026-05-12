"use client";

import { useState } from "react";
import { Loader2, Zap, ArrowRight } from "lucide-react";
import { startCheckout } from "@/components/poker/UpgradePrompt";

export function UpgradePricingCTA({
  loggedIn,
  fullWidth = true,
}: {
  loggedIn: boolean;
  fullWidth?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!loggedIn) {
      window.location.href = "/signup?next=pricing";
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await startCheckout();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleUpgrade}
        disabled={loading}
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
        ) : (
          <Zap className="h-4 w-4 shrink-0" />
        )}
        {loading
          ? "Redirecting to checkout…"
          : loggedIn
          ? "Upgrade to Pro"
          : "Get Pro — €9/month"}
        {!loading && <ArrowRight className="h-4 w-4 shrink-0" />}
      </button>

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
