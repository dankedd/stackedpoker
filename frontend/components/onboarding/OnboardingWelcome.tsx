'use client'

import { Sparkles, Clock, ShieldCheck } from 'lucide-react'

export function OnboardingWelcome({
  onStart,
  onSkip,
}: {
  onStart: () => void
  onSkip: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/80 to-blue-950/20 px-6 py-10 sm:px-10 sm:py-14 text-center">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/25">
          <Sparkles className="h-7 w-7 text-violet-400" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Welcome to StackedPoker.
        </h1>
        <p className="text-violet-300/80 text-sm sm:text-base font-medium mb-6">
          Let&apos;s personalize your learning experience.
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 mb-3">
          <Clock className="h-3.5 w-3.5" />
          This takes under <span className="font-semibold text-foreground/80">1 minute</span>.
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-1.5">
          One quick question about your poker experience is all it takes to
          recommend the best learning path for you.
        </p>
        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400/80 mb-8">
          <ShieldCheck className="h-3.5 w-3.5" />
          There are no wrong answers.
        </div>

        <button
          type="button"
          onClick={onStart}
          className="group relative w-full overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          Get Started
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="mt-3 text-xs font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
