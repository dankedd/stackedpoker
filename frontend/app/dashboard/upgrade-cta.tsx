"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/components/poker/UpgradePrompt";

export function UpgradeCTA() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      await startCheckout();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="poker"
      size="sm"
      className="gap-2 shrink-0"
      onClick={handleUpgrade}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {loading ? "Redirecting…" : "Upgrade to Pro"}
    </Button>
  );
}
