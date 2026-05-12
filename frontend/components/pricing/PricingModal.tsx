"use client";

import { useState } from "react";
import {
  X, Check, Zap, Shield, CreditCard, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startCheckout } from "@/components/poker/UpgradePrompt";

const FREE_FEATURES = [
  { label: "3 hand analyses", included: true },
  { label: "Basic GTO coaching", included: true },
  { label: "GGPoker & PokerStars", included: true },
  { label: "Session analysis", included: false },
  { label: "Unlimited analyses", included: false },
  { label: "Advanced coaching", included: false },
  { label: "Puzzles & training", included: false },
];

const PRO_FEATURES = [
  { label: "Unlimited hand analyses", included: true },
  { label: "Advanced GTO coaching", included: true },
  { label: "GGPoker & PokerStars", included: true },
  { label: "Session analysis", included: true },
  { label: "Multi-hand sessions", included: true },
  { label: "Interactive puzzles", included: true },
  { label: "Priority AI processing", included: true },
];

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

export function PricingModal({ open, onClose }: PricingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleUpgrade() {
    setError(null);
    setLoading(true);
    try {
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl animate-fade-in">
        <div className="rounded-2xl border border-white/[0.08] bg-card/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden">

          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 border-b border-border/40">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-900/40">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Upgrade to Pro</h2>
                <p className="text-sm text-muted-foreground">Unlock unlimited access — no limits, ever.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/40">

            {/* Free column */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Free</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">€0</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
              </div>
              <ul className="space-y-2.5">
                {FREE_FEATURES.map(({ label, included }) => (
                  <li key={label} className={cn("flex items-center gap-2.5 text-sm", included ? "text-foreground/70" : "text-muted-foreground/40 line-through")}>
                    <span className={cn("h-3.5 w-3.5 rounded-full flex-shrink-0 flex items-center justify-center border",
                      included ? "border-border/60 bg-secondary/60" : "border-border/30 bg-transparent"
                    )}>
                      {included && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground/40 pt-1">Current plan</p>
            </div>

            {/* Pro column */}
            <div className="px-6 py-5 space-y-4 bg-violet-500/5">
              <div>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">Pro</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">€9</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
              </div>
              <ul className="space-y-2.5">
                {PRO_FEATURES.map(({ label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm text-foreground/80">
                    <Check className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                variant="poker"
                className="w-full gap-2"
                onClick={handleUpgrade}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  "Upgrade to Pro"
                )}
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/40 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground/50">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Secure payment via Stripe
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              iDEAL · Card · Apple Pay · Google Pay
            </span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
