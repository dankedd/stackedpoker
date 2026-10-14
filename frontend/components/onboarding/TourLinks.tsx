"use client";

import Link from "next/link";
import { Compass, X } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { dashboardTipTour, tourDone, TOUR_META, TOURS, tourHref } from "@/lib/onboarding/state";

/** Dashboard tip: "Take the Hand Review tour, 2 min", until done or dismissed. */
export function TourTip() {
  const ob = useOnboarding();
  const tour = ob.loaded ? dashboardTipTour(ob.row, ob.signupSource) : null;
  if (!tour) return null;
  const meta = TOUR_META[tour];
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.07] px-4 py-3 animate-fade-in">
      <Compass aria-hidden="true" className="h-4 w-4 shrink-0 text-[#B9A8FF]" />
      <Link href={tourHref(tour)} className="min-w-0 flex-1 text-sm font-medium text-foreground hover:underline">
        Take the {meta.title} tour, {meta.minutes} min
      </Link>
      <button
        type="button"
        onClick={() => void ob.dismissTip()}
        aria-label="Dismiss tip"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Settings: replay either tour any time. */
export function ProductToursCard() {
  const ob = useOnboarding();
  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40">
      <div className="px-6 py-4">
        <h2 className="font-semibold text-foreground">Product tours</h2>
      </div>
      <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row">
        {TOURS.map((t) => (
          <Link
            key={t}
            href={tourHref(t)}
            className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3 text-sm transition-colors hover:border-[#7C5CFF]/50"
          >
            <span className="font-medium text-foreground">{TOUR_META[t].title}</span>
            <span className="text-xs text-muted-foreground">
              {tourDone(ob.row, t) ? "Replay" : "Start"} · {TOUR_META[t].minutes} min
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
