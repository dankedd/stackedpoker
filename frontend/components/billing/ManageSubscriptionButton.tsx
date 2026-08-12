"use client";

import { Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useManageSubscription } from "@/hooks/useManageSubscription";
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
  const { handleManage, loading, error } = useManageSubscription();

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
