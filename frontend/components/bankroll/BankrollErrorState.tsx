import { AlertTriangle, RotateCcw } from "lucide-react";

interface BankrollErrorStateProps {
  message?: string;
  onRetry: () => void;
}

/** Shown when a page's primary data fetch fails, instead of silently rendering as if the user just has no data. Every /bankroll/* client page previously only console.error'd on fetch failure with no visible fallback. */
export function BankrollErrorState({ message = "Couldn't load this page.", onRetry }: BankrollErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center">
      <div className="flex justify-center mb-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/25">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
      </div>
      <p className="text-sm text-foreground font-semibold mb-1">{message}</p>
      <p className="text-xs text-muted-foreground/60 mb-5">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 bg-card/60 text-foreground text-xs font-semibold hover:border-red-500/30 hover:bg-red-500/5 transition-all"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}
