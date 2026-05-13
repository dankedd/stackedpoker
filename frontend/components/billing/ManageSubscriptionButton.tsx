"use client";

import { useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createPortalSession } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ManageSubscriptionButtonProps {
  className?: string;
  variant?: "outline" | "ghost" | "poker";
  size?: "sm" | "default" | "lg";
}

export function ManageSubscriptionButton({
  className,
  variant = "outline",
  size = "sm",
}: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManage() {
    setError(null);
    setLoading(true);

    // Open blank tab synchronously (within user-interaction event stack) to
    // avoid popup blockers, then navigate it once we have the portal URL.
    const tab = window.open("about:blank", "_blank");
    console.log("[billing-portal] blank tab opened:", !!tab);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const { url } = await createPortalSession(token);
      console.log("[billing-portal] URL ready, navigating tab");

      if (tab && !tab.closed) {
        tab.location.href = url;
        console.log("[billing-portal] external tab navigated to billing portal");
        setLoading(false);
      } else {
        console.warn("[billing-portal] popup blocked — same-tab fallback");
        window.location.href = url;
      }
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      setError(err instanceof Error ? err.message : "Failed to open billing portal.");
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <Button
        variant={variant}
        size={size}
        onClick={handleManage}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Settings className="h-3.5 w-3.5" />
        )}
        {loading ? "Opening portal…" : "Manage Subscription"}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
