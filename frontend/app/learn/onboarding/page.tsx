'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome'
import { SelfAssessmentStep, type SelfAssessmentAnswers } from '@/components/onboarding/SelfAssessmentStep'
import { QuestionCard } from '@/components/onboarding/QuestionCard'
import { FinalChallengeOffer } from '@/components/onboarding/FinalChallengeOffer'
import { ResultsScreen } from '@/components/onboarding/ResultsScreen'
import { FastTrackChoice } from '@/components/onboarding/FastTrackChoice'
// Metadata only — never '@/lib/learn/curriculum'. See scripts/generateCurriculumPublic.ts.
import { MODULES_BY_SLUG } from '@/lib/learn/curriculumPublic.generated'
import {
  createInitialState, pickNextQuestion, recordAnswer, shouldStop, shouldOfferFinalChallenge,
  pickFinalChallengeQuestions, computeResults, type AssessmentEngineState, type AssessmentResults,
} from '@/lib/learn/assessmentEngine'
import { ASSESSMENT_QUESTIONS, type AssessmentQuestion, type AssessmentLeague } from '@/lib/learn/assessmentQuestions'
import { submitAssessment } from '@/lib/learn/assessmentApi'
import { useAuth } from '@/contexts/AuthContext'

// A small fixed "graduation test" for the Fast Track — easy L1/L2 questions,
// not drawn from the adaptive pool so it can't repeat what was just asked.
const FOUNDATION_CHALLENGE_QUESTIONS: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
  .filter(q => !q.isFinalChallenge && q.difficulty <= 2)
  .slice(0, 3)

type Phase =
  | 'welcome' | 'self_rating' | 'quiz' | 'final_challenge_offer' | 'final_challenge'
  | 'results' | 'fast_track_choice' | 'foundation_challenge' | 'foundation_challenge_result'

export default function OnboardingPage() {
  const router = useRouter()
  const { session } = useAuth()

  const [phase, setPhase] = useState<Phase>('welcome')
  const [selfAnswers, setSelfAnswers] = useState<SelfAssessmentAnswers>({
    experience: null, stakes: null, confidence: 5,
  })
  const [quizState, setQuizState] = useState<AssessmentEngineState>(createInitialState())
  const [finalChallengeQs, setFinalChallengeQs] = useState<AssessmentQuestion[]>([])
  const [finalChallengeAnswers, setFinalChallengeAnswers] = useState<boolean[]>([])
  const [results, setResults] = useState<AssessmentResults | null>(null)
  const [fcIndex, setFcIndex] = useState(0)
  const [foundationPassed, setFoundationPassed] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const currentQuestion = useMemo(
    () => (phase === 'quiz' ? pickNextQuestion(quizState) : null),
    [phase, quizState],
  )

  async function finish(finalResults: AssessmentResults, chosenStartLeague: AssessmentLeague, fastTrack: { taken: boolean; passed?: boolean }) {
    setSubmitting(true)
    try {
      await submitAssessment(session?.access_token ?? '', {
        self_experience: selfAnswers.experience,
        self_stakes: selfAnswers.stakes,
        self_confidence: selfAnswers.confidence,
        questions_answered: quizState.trace.length,
        correct_count: quizState.trace.filter(t => t.correct).length,
        assessment_score: finalResults.assessmentScore,
        final_challenge_offered: finalChallengeQs.length > 0,
        final_challenge_passed: finalChallengeAnswers.length > 0 ? finalChallengeAnswers.every(Boolean) : null,
        answer_trace: quizState.trace,
        estimated_league: finalResults.estimatedLeague,
        recommended_league: finalResults.estimatedLeague,
        chosen_start_league: chosenStartLeague,
        fast_track_taken: fastTrack.taken,
        fast_track_passed: fastTrack.passed ?? null,
        recommended_module_id: finalResults.recommendedModuleId,
        strongest_topics: finalResults.strongestTopics,
        weakest_topics: finalResults.weakestTopics,
        estimated_study_hours: finalResults.estimatedStudyHours,
      })
    } catch {
      // Non-fatal: the learner still gets into /learn even if the write
      // failed — worst case they see the assessment gate again next visit.
    } finally {
      router.push('/learn')
    }
  }

  function handleSkip() {
    finish(
      { estimatedLeague: 'foundation', assessmentScore: 0, strongestTopics: [], weakestTopics: [], estimatedStudyHours: 0, recommendedModuleId: 'poker-fundamentals-module' },
      'foundation',
      { taken: false },
    )
  }

  function handleQuizAnswer(correct: boolean) {
    if (!currentQuestion) return
    const nextState = recordAnswer(quizState, currentQuestion, correct)
    setQuizState(nextState)
  }

  function handleQuizNext() {
    if (shouldStop(quizState)) {
      if (shouldOfferFinalChallenge(quizState)) {
        setPhase('final_challenge_offer')
      } else {
        const r = computeResults(quizState.trace, undefined)
        setResults(r)
        setPhase('results')
      }
    }
    // else: re-render with the same phase — currentQuestion recomputes via useMemo
  }

  function handleAcceptFinalChallenge() {
    const qs = pickFinalChallengeQuestions()
    setFinalChallengeQs(qs)
    setFinalChallengeAnswers([])
    setFcIndex(0)
    setPhase('final_challenge')
  }

  function handleDeclineFinalChallenge() {
    const r = computeResults(quizState.trace, undefined)
    setResults(r)
    setPhase('results')
  }

  function handleFinalChallengeAnswer(correct: boolean) {
    setFinalChallengeAnswers(prev => [...prev, correct])
  }

  function handleFinalChallengeNext() {
    if (fcIndex + 1 < finalChallengeQs.length) {
      setFcIndex(fcIndex + 1)
    } else {
      const passed = [...finalChallengeAnswers].every(Boolean) && finalChallengeAnswers.length === finalChallengeQs.length
      const r = computeResults(quizState.trace, passed)
      setResults(r)
      setPhase('results')
    }
  }

  function handleResultsContinue() {
    if (!results) return
    if (results.estimatedLeague !== 'foundation') {
      setPhase('fast_track_choice')
    } else {
      finish(results, 'foundation', { taken: false })
    }
  }

  function handleStartAtFoundation() {
    if (!results) return
    finish(results, 'foundation', { taken: false })
  }

  function handleTakeFoundationChallenge() {
    setFcIndex(0)
    setPhase('foundation_challenge')
  }

  function handleFoundationAnswer(correct: boolean) {
    setFinalChallengeAnswers(prev => [...prev, correct])
  }

  function handleFoundationNext() {
    if (fcIndex + 1 < FOUNDATION_CHALLENGE_QUESTIONS.length) {
      setFcIndex(fcIndex + 1)
    } else {
      const passed = finalChallengeAnswers.every(Boolean) && finalChallengeAnswers.length === FOUNDATION_CHALLENGE_QUESTIONS.length
      setFoundationPassed(passed)
      setPhase('foundation_challenge_result')
    }
  }

  function handleFoundationResultContinue() {
    if (!results) return
    const passed = !!foundationPassed
    finish(
      results,
      passed ? results.estimatedLeague : 'foundation',
      { taken: true, passed },
    )
  }

  const recommendedModuleTitle = results
    ? MODULES_BY_SLUG[results.recommendedModuleId]?.title ?? 'Poker Fundamentals'
    : ''

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />
      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          {phase === 'welcome' && (
            <OnboardingWelcome onStart={() => setPhase('self_rating')} onSkip={handleSkip} />
          )}

          {phase === 'self_rating' && (
            <SelfAssessmentStep
              answers={selfAnswers}
              onChange={setSelfAnswers}
              onContinue={() => setPhase('quiz')}
            />
          )}

          {phase === 'quiz' && currentQuestion && (
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              index={quizState.trace.length + 1}
              total={12}
              onAnswer={handleQuizAnswer}
              onNext={handleQuizNext}
            />
          )}

          {phase === 'final_challenge_offer' && (
            <FinalChallengeOffer onAccept={handleAcceptFinalChallenge} onDecline={handleDeclineFinalChallenge} />
          )}

          {phase === 'final_challenge' && finalChallengeQs[fcIndex] && (
            <QuestionCard
              key={finalChallengeQs[fcIndex].id}
              question={finalChallengeQs[fcIndex]}
              index={fcIndex + 1}
              total={finalChallengeQs.length}
              onAnswer={handleFinalChallengeAnswer}
              onNext={handleFinalChallengeNext}
            />
          )}

          {phase === 'results' && results && (
            <ResultsScreen
              results={results}
              moduleTitle={recommendedModuleTitle}
              onContinue={handleResultsContinue}
              continueLabel={submitting ? 'Saving…' : 'Continue'}
            />
          )}

          {phase === 'fast_track_choice' && results && (
            <FastTrackChoice
              recommendedLeague={results.estimatedLeague}
              onStartAtFoundation={handleStartAtFoundation}
              onTakeFinalChallenge={handleTakeFoundationChallenge}
            />
          )}

          {phase === 'foundation_challenge' && FOUNDATION_CHALLENGE_QUESTIONS[fcIndex] && (
            <QuestionCard
              key={FOUNDATION_CHALLENGE_QUESTIONS[fcIndex].id}
              question={FOUNDATION_CHALLENGE_QUESTIONS[fcIndex]}
              index={fcIndex + 1}
              total={FOUNDATION_CHALLENGE_QUESTIONS.length}
              onAnswer={handleFoundationAnswer}
              onNext={handleFoundationNext}
            />
          )}

          {phase === 'foundation_challenge_result' && results && (
            <div className="rounded-2xl border border-border/40 bg-card/70 p-6 sm:p-8 text-center">
              <h2 className="text-lg font-bold text-foreground mb-2">
                {foundationPassed ? 'Challenge passed!' : 'Not quite this time'}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {foundationPassed
                  ? `${results.estimatedLeague[0].toUpperCase()}${results.estimatedLeague.slice(1)} is unlocked.`
                  : 'You\'ll start at Foundation — you can always retake the assessment later.'}
              </p>
              <button
                type="button"
                onClick={handleFoundationResultContinue}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Continue to Learn'}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
