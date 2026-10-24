import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One dashboard block: the shared card shell, its loading skeleton and its empty state. */

export function Block({
  title,
  aside,
  children,
  className,
  labelledBy,
}: {
  title: string;
  /** Right of the title: a small link or label. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const id = labelledBy ?? `dash-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function BlockLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-violet-300 hover:text-violet-200">
      {children}
      <ChevronRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}

/** A clear next step when a block has nothing to show yet. */
export function EmptyState({ text, cta, href, secondary }: { text: string; cta: string; href: string; secondary?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border/60 bg-white/[0.015] px-4 py-4">
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={href}
          className="inline-flex h-9 items-center rounded-lg bg-violet-500/15 px-3.5 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/25"
        >
          {cta}
        </Link>
        {secondary && (
          <Link href={secondary.href} className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export function BlockSkeleton({ title, rows = 3, className }: { title: string; rows?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label={title} className={cn("rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-5", className)}>
      <Skeleton className="mb-4 h-2.5 w-24 rounded" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn("h-10 rounded-lg", i === rows - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div aria-busy="true" aria-label="Today" className="rounded-3xl border border-violet-500/10 bg-card/40 px-5 py-6 sm:px-8 sm:py-8">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="mt-3 h-8 w-3/4 rounded-lg" />
      <Skeleton className="mt-5 h-12 w-full rounded-xl sm:w-64" />
    </div>
  );
}
