import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBB(bb: number | null | undefined): string {
  if (bb == null) return "—";
  return `${bb.toFixed(1)}BB`;
}

export function scoreToLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "text-poker-green" };
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
      return "text-poker-green bg-poker-green/10 border-poker-green/30";
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
