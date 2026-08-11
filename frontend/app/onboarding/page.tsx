'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome'
import { LevelSelectStep } from '@/components/onboarding/LevelSelectStep'
import { RecommendationScreen } from '@/components/onboarding/RecommendationScreen'
import { computeRecommendation, type ExperienceLevel, type Recommendation } from '@/lib/learn/experienceLevel'
import { submitAssessment } from '@/lib/learn/assessmentApi'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'
import { trackEvent, SEO_EVENTS } from '@/lib/seo/analytics'

type Phase = 'welcome' | 'level_select' | 'recommendation'

export default function OnboardingPage() {
  const router = useRouter()
  const { session } = useAuth()
  const { subscription } = useSubscription()

  const [phase, setPhase] = useState<Phase>('welcome')
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    trackEvent(SEO_EVENTS.onboardingStarted)
  }, [])

  function handleSelectLevel(level: ExperienceLevel) {
    trackEvent(SEO_EVENTS.onboardingLevelSelected, { level })
    const rec = computeRecommendation(level, subscription?.tier)
    setRecommendation(rec)
    trackEvent(SEO_EVENTS.onboardingRecommendationShown, { level, start_module_id: rec.startModuleId })
    setPhase('recommendation')
  }

  async function handleSkip() {
    // "Skip for now" still needs to clear the gate — otherwise middleware
    // just bounces the learner right back here on their next request.
    // Defaults to beginner, same fallback the acceptance criteria implies
    // for anyone who never picked ("every user receives a recommendation").
    await finish('beginner')
  }

  async function finish(level: ExperienceLevel) {
    setSubmitting(true)
    setSubmitError(null)
    const rec = recommendation ?? computeRecommendation(level, subscription?.tier)
    trackEvent(SEO_EVENTS.onboardingStartLearningClicked, { level })
    try {
      await submitAssessment(session?.access_token ?? '', {
        experience_level: level,
        recommended_module_id: rec.startModuleId,
      })
      trackEvent(SEO_EVENTS.onboardingCompleted, { level })
      // Only navigate on a confirmed save — middleware gates every
      // authenticated route on assessment_completed, so pushing to
      // /dashboard before the write actually lands just bounces straight
      // back here with no visible error, which looks like the page hung.
      router.push('/dashboard')
    } catch (err) {
      setSubmitting(false)
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong saving your answer.',
      )
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />
      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          {phase === 'welcome' && (
            <OnboardingWelcome onStart={() => setPhase('level_select')} onSkip={handleSkip} />
          )}

          {phase === 'level_select' && <LevelSelectStep onSelect={handleSelectLevel} />}

          {phase === 'recommendation' && recommendation && (
            <RecommendationScreen
              recommendation={recommendation}
              onStartLearning={() => finish(recommendation.level)}
            />
          )}

          {submitting && (
            <p className="mt-4 text-center text-xs text-muted-foreground/50">Saving…</p>
          )}

          {submitError && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.05] px-4 py-3 text-center">
              <p className="text-xs text-red-300/90 mb-2">
                Couldn&apos;t save your answer — {submitError}
              </p>
              <button
                type="button"
                onClick={() => finish(recommendation?.level ?? 'beginner')}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
