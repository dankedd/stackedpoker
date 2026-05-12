"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";

/**
 * Shows a dismissible success banner when the URL contains ?upgraded=1.
 * Rendered inside the Dashboard (client-side only — reads window.location).
 */
export function UpgradeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upgraded") === "1") {
      setVisible(true);
      // Clean the URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-4 animate-fade-in">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30 shrink-0 mt-0.5">
        <CheckCircle2 className="h-4 w-4 text-violet-400" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          Welcome to Pro! <Sparkles className="h-4 w-4 text-violet-400" />
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your subscription is active. You now have unlimited hand analyses and full access to all features.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
