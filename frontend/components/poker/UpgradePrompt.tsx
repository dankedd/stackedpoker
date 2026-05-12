"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  used: number;
  limit: number;
  className?: string;
}

export function UpgradePrompt({ used, limit, className }: UpgradePromptProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 gap-5 text-center", className)}>
      <div className="h-12 w-12 rounded-full bg-secondary/50 border border-border/50 flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold text-base">
          You've used all {limit} free{" "}
          {limit === 1 ? "analysis" : "analyses"}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Upgrade to Pro for unlimited hand analysis and advanced coaching.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 items-center">
        {/* Placeholder — Stripe integration comes later */}
        <Button
          variant="poker"
          size="sm"
          disabled
          className="min-w-[160px] opacity-80 cursor-not-allowed"
          title="Coming soon"
        >
          Upgrade to Pro
        </Button>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to home
        </Link>
      </div>

      <p className="text-[11px] text-muted-foreground/60">
        Paid plans launching soon · {used}/{limit} analyses used
      </p>
    </div>
  );
}

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
