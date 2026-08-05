import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BankrollEmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
  size?: "default" | "compact";
}

/**
 * Icon-circle + title + message (+ optional action) empty state, used
 * whenever a /bankroll/* list has nothing to show yet (or a filter/search
 * matched nothing). Extracted since sessions/goals pages duplicated this
 * markup verbatim; the wallet page's simpler variant is the "compact" size.
 */
export function BankrollEmptyState({ icon: Icon, title, message, action, size = "default" }: BankrollEmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-border/40 bg-card/40 text-center", size === "compact" ? "p-12" : "p-16")}>
      <div className="flex justify-center mb-4">
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-secondary border border-border/60",
            size === "compact" ? "h-14 w-14" : "h-16 w-16"
          )}
        >
          <Icon className={cn("text-muted-foreground/40", size === "compact" ? "h-6 w-6" : "h-7 w-7")} />
        </div>
      </div>
      <p className="text-foreground font-semibold mb-2">{title}</p>
      <p className={cn("text-sm text-muted-foreground/60", action && "mb-6")}>{message}</p>
      {action}
    </div>
  );
}
