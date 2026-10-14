'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Clock, FileSearch, Loader2, Target } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { LearnOnboarding } from '@/components/onboarding/LearnOnboarding'
import { useAuth } from '@/contexts/AuthContext'
import { useOnboarding } from '@/hooks/useOnboarding'
import { useSubscription } from '@/hooks/useSubscription'
import { canUseFeature } from '@/lib/features'
import { TOUR_META, tourHref, type Tour } from '@/lib/onboarding/state'
import { cn } from '@/lib/utils'

/**
 * First stop after sign-up: pick the Preflop Trainer or the Hand Review tour
 * (the other one is offered right after). Also the "Product tours" page in
 * the user menu — once the choice was made, picking here just replays a tour.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  )
}

const CARDS: { tour: Tour; icon: typeof Target; text: string }[] = [
  { tour: 'preflop', icon: Target, text: 'Drill real tournament spots and learn your ranges by position and stack depth.' },
  { tour: 'hands', icon: FileSearch, text: 'Upload your tournament and find the hands where you lost chips.' },
]

function Onboarding() {
  const params = useSearchParams()
  const { subscription } = useSubscription()
  if (params.get('flow') === 'learn' && canUseFeature('learn', subscription?.tier)) return <LearnOnboarding />
  return <ChoiceScreen />
}

function ChoiceScreen() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const ob = useOnboarding()
  const [busy, setBusy] = useState<Tour | 'skip' | null>(null)
  // Seen before = opened from "Product tours": replay, don't record a new choice.
  const replay = Boolean(ob.row?.onboarding_choice_seen_at)
  const ready = Boolean(user) && !loading && !busy

  async function pick(choice: Tour | 'skip') {
    setBusy(choice)
    // Saved before navigating: middleware sends users without a choice back here.
    if (!replay) await ob.choose(choice)
    router.push(choice === 'skip' ? '/dashboard' : tourHref(choice))
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />
      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/80 to-blue-950/20 px-5 py-10 sm:px-10 sm:py-12">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative text-center">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Welcome to Stacked Poker</h1>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-violet-300/80 sm:text-base">
                What do you want to learn first? You can do the other one right after.
              </p>
            </div>

            <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
              {CARDS.map(({ tour, icon: Icon, text }) => (
                <button
                  key={tour}
                  type="button"
                  disabled={!ready}
                  onClick={() => pick(tour)}
                  className={cn(
                    'group flex flex-col rounded-2xl border border-white/10 bg-[#0B0E1A]/70 p-5 text-left transition-all',
                    'hover:-translate-y-0.5 hover:border-[#7C5CFF]/60 hover:shadow-lg hover:shadow-violet-900/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] disabled:cursor-wait disabled:opacity-70',
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/15">
                    {busy === tour ? <Loader2 className="h-5 w-5 animate-spin text-[#B9A8FF]" /> : <Icon className="h-5 w-5 text-[#B9A8FF]" />}
                  </span>
                  <span className="mt-4 text-lg font-bold text-foreground">{TOUR_META[tour].title}</span>
                  <span className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</span>
                  <span className="mt-4 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                      <Clock className="h-3.5 w-3.5" /> ~{TOUR_META[tour].minutes} min
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#B9A8FF]">
                      Start tour <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="relative mt-6 text-center">
              <button
                type="button"
                disabled={!ready}
                onClick={() => pick('skip')}
                className="text-xs font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground disabled:opacity-60"
              >
                {replay ? 'Back to the dashboard' : "Skip, I'll explore myself"}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
