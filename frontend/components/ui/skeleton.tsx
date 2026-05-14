import type React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/40 bg-card/40 p-5 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-2.5 w-44 rounded" />
        </div>
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-4/5 rounded" />
      <Skeleton className="h-8 w-24 rounded-lg mt-1" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-3 rounded-lg", className)}>
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-2.5 w-48 rounded" />
      </div>
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}

export function SkeletonStatTile({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/40 bg-card/40 px-4 py-3.5 space-y-2", className)}>
      <Skeleton className="h-2.5 w-20 rounded" />
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-2 w-28 rounded" />
    </div>
  );
}
