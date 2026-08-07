import Link from "next/link";
import { Lock, Clock, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LockedLessonCardProps {
  title: string;
  subtitle?: string;
  estimatedMin: number;
  xpReward?: number;
  /** "row" — a single item inside a module's lesson list (matches the shape
   *  of app/learn/module/[slug]/page.tsx's own LessonCard). "full" — the
   *  standalone lesson page shown when a locked lesson is opened directly. */
  variant?: "row" | "full";
  className?: string;
}

/**
 * The one shared "this content is locked" card — used by the lesson page's
 * server-side gate and the module overview's per-lesson locking. Title,
 * subtitle, and duration stay fully visible (the lesson itself is never
 * hidden from the UI, only its interactive content), with a clear upgrade
 * path instead of a dead end.
 */
export function LockedLessonCard({
  title,
  subtitle,
  estimatedMin,
  xpReward,
  variant = "row",
  className,
}: LockedLessonCardProps) {
  if (variant === "full") {
    return (
      <div
        className={cn(
          "w-full max-w-md mx-auto rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-500/8 via-card/70 to-card/60 p-6 text-center shadow-xl shadow-violet-900/10",
          className,
        )}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/30">
          <Lock className="h-5 w-5 text-violet-400" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-3">
          <Lock className="h-2.5 w-2.5" />
          Premium
        </span>
        <h1 className="text-xl font-bold text-foreground mb-1.5">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{subtitle}</p>
        )}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60 mb-6">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {estimatedMin} min
          </span>
          {xpReward != null && (
            <span className="flex items-center gap-1.5 text-amber-400/80">
              <Zap className="h-3.5 w-3.5" />
              {xpReward} XP
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/50 mb-4">
          Upgrade om deze les vrij te spelen.
        </p>
        <Link
          href="/pricing"
          className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
        >
          Upgrade
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    );
  }

  return (
    <Link href="/pricing" className={cn("group block", className)}>
      <div className="flex items-center gap-4 rounded-2xl border border-border/30 bg-card/30 px-5 py-4 opacity-80 transition-all duration-200 hover:opacity-100 hover:border-violet-500/30 hover:bg-violet-500/[0.03]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-border/25 bg-secondary/10 text-muted-foreground/40">
          <Lock className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-400 uppercase tracking-wide">
              Premium
            </span>
          </div>
          <p className="font-semibold text-foreground/70 text-sm truncate">{title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
              <Clock className="h-3 w-3" />
              {estimatedMin} min
            </span>
          </div>
        </div>

        <span className="shrink-0 text-[11px] font-semibold text-violet-400/80 hidden sm:inline group-hover:text-violet-300 transition-colors">
          Upgrade
        </span>
        <ArrowRight className="h-4 w-4 text-violet-400/50 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </Link>
  );
}
