"use client";

import { Lock, Check, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ── Shared checkout helper ─────────────────────────────────────────────────

export async function startCheckout(): Promise<void> {
  // Open a blank tab NOW, synchronously, while still inside the user-interaction
  // event stack. Popup blockers only fire when window.open() is called after an
  // await (i.e. outside the original user gesture). By opening "about:blank" here
  // we secure a real tab reference before any async work, then navigate it once
  // we have the Stripe URL.
  const tab = window.open("about:blank", "_blank");
  console.log("[checkout] blank tab opened:", !!tab);

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated — please sign in again.");

    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ origin: window.location.origin }),
    });

    const data = await res.json().catch(() => ({}));
    console.log("[checkout] response:", data);

    if (!res.ok || data.error) {
      throw new Error(data.message ?? data.detail ?? "Failed to start checkout. Please try again.");
    }

    const url: string | undefined = data.url;
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      console.error("[checkout] invalid or missing URL in response:", data);
      throw new Error("Checkout failed — invalid redirect URL.");
    }

    if (tab && !tab.closed) {
      // Navigate the pre-opened tab — original tab stays put
      tab.location.href = url;
      console.log("[checkout] external tab navigated to Stripe");
    } else {
      // True fallback: popup was blocked and the user dismissed the notice
      console.warn("[checkout] popup blocked — same-tab fallback");
      window.location.href = url;
    }
  } catch (err) {
    // Avoid leaving an orphaned about:blank tab on errors
    if (tab && !tab.closed) tab.close();
    throw err;
  }
}

// ── UpgradePrompt ─────────────────────────────────────────────────────────

const PRO_BENEFITS = [
  "Unlimited hand analyses",
  "Session analysis (multi-hand)",
  "Advanced GTO coaching",
  "Unlimited puzzles",
  "Priority AI processing",
];

interface UpgradePromptProps {
  used: number;
  limit: number;
  className?: string;
}

export function UpgradePrompt({ used, limit, className }: UpgradePromptProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {/* Usage exhausted notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <Lock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            You've used all {limit} free {limit === 1 ? "analysis" : "analyses"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upgrade to Pro for unlimited access — no limits, ever.
          </p>
        </div>
      </div>

      {/* Pricing card */}
      <div className="rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/10 to-card/40 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">Pro</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">€9</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30">
            <Zap className="h-4 w-4 text-violet-400" />
          </div>
        </div>

        <ul className="space-y-2 mb-5">
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2.5 text-sm text-foreground/80">
              <Check className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>

        <Button variant="poker" size="sm" className="w-full" asChild>
          <Link href="/pricing">Upgrade to Pro</Link>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground/50">
        {used}/{limit} free analyses used · iDEAL & card · Cancel anytime
      </p>
    </div>
  );
}

// ── LoginCTA (unchanged) ───────────────────────────────────────────────────

interface LoginCTAProps {
  className?: string;
}

export function LoginCTA({ className }: LoginCTAProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 gap-5 text-center", className)}>
      <div className="h-12 w-12 rounded-full bg-secondary/50 border border-border/50 flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold text-base">Sign in to analyze your hands</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Free accounts get 3 analyses. No credit card required.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 items-center">
        <Button asChild variant="poker" size="sm" className="min-w-[140px]">
          <Link href="/signup">Create free account</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-w-[140px]">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
