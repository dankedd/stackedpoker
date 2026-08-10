'use client'

import { Trophy } from 'lucide-react'

export function FinalChallengeOffer({
  onAccept,
  onDecline,
}: {
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-card/80 to-violet-950/20 px-6 py-9 sm:px-10 text-center">
      <div aria-hidden className="pointer-events-none absolute -top-14 -right-14 h-52 w-52 rounded-full bg-amber-500/12 blur-3xl" />

      <div className="relative mx-auto max-w-md">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30">
          <Trophy className="h-6 w-6 text-amber-400" />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-2">
          Final Challenge
        </p>
        <h2 className="text-xl font-bold text-foreground mb-3">
          You&apos;ve answered every question correctly so far.
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          This last question is intentionally difficult and helps us determine
          whether you&apos;re an advanced player.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-xl border border-border/40 bg-secondary/20 px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
          >
            Skip it
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            Take the Challenge
          </button>
        </div>
      </div>
    </div>
  )
}
