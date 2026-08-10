import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBB(bb: number | null | undefined): string {
  if (bb == null) return "—";
  return `${bb.toFixed(1)}BB`;
}

export function formatCurrency(amount: number | null | undefined, currency: string = "USD"): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(value: number | null | undefined, opts?: { decimals?: number; signed?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const decimals = opts?.decimals ?? 1;
  const sign = opts?.signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Extracts a human-readable message from a caught error, for use in toasts.
 * Not just `err instanceof Error ? err.message : String(err)` — Supabase's
 * PostgrestError (what every bankroll_* insert/update throws on failure) is
 * a plain object shaped `{message, details, hint, code}`, not an Error
 * instance, so that check always fell through to `String(err)`, which on a
 * plain object produces the literal text "[object Object]" instead of the
 * actual database error. This checks for a string `.message` property
 * first, which covers both real Errors and PostgrestError alike.
 */
export function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** "1st", "2nd", "3rd", "4th", ... — used for tournament finishing positions. */
export function formatOrdinal(n: number): string {
  const rounded = Math.round(n);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  switch (rounded % 10) {
    case 1: return `${rounded}st`;
    case 2: return `${rounded}nd`;
    case 3: return `${rounded}rd`;
    default: return `${rounded}th`;
  }
}

export function scoreToLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "text-violet-400" };
  if (score >= 70) return { label: "Good", color: "text-green-400" };
  if (score >= 55) return { label: "Okay", color: "text-yellow-400" };
  if (score >= 40) return { label: "Weak", color: "text-orange-400" };
  return { label: "Poor", color: "text-red-400" };
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "mistake":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    case "suboptimal":
      return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "good":
      return "text-violet-400 bg-violet-500/10 border-violet-500/30";
    case "note":
      return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    default:
      return "text-muted-foreground bg-muted/10 border-border";
  }
}

export function severityIcon(severity: string): string {
  switch (severity) {
    case "mistake":
      return "✗";
    case "suboptimal":
      return "△";
    case "good":
      return "✓";
    case "note":
      return "ℹ";
    default:
      return "•";
  }
}
