'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LessonSlider } from '@/components/learn/visuals/LessonSlider'
import type { SelfExperience, SelfStakes } from './onboardingTypes'

const EXPERIENCE_OPTIONS: { id: SelfExperience; label: string }[] = [
  { id: 'never_played', label: "I've never played poker." },
  { id: 'friends_only', label: "I've only played with friends." },
  { id: 'recreational_online', label: 'I play recreationally online.' },
  { id: 'regular_cash', label: 'I regularly play online cash games.' },
  { id: 'studies_poker', label: 'I actively study poker.' },
  { id: 'advanced', label: "I'm an advanced player." },
  { id: 'professional', label: 'I play professionally.' },
]

const STAKES_OPTIONS: { id: SelfStakes; label: string }[] = [
  { id: 'never_played', label: 'Never played' },
  { id: 'play_money', label: 'Play money' },
  { id: 'nl2', label: 'NL2' },
  { id: 'nl5', label: 'NL5' },
  { id: 'nl10', label: 'NL10' },
  { id: 'nl25', label: 'NL25' },
  { id: 'nl50', label: 'NL50' },
  { id: 'nl100_plus', label: 'NL100+' },
  { id: 'live_only', label: 'Live only' },
]

export interface SelfAssessmentAnswers {
  experience: SelfExperience | null
  stakes: SelfStakes | null
  confidence: number
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T | null
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={cn(
            'rounded-xl border px-3.5 py-2 text-sm font-medium transition-all',
            value === opt.id
              ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-sm shadow-violet-500/10'
              : 'border-border/40 bg-secondary/20 text-muted-foreground hover:border-violet-500/25 hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SelfAssessmentStep({
  answers,
  onChange,
  onContinue,
}: {
  answers: SelfAssessmentAnswers
  onChange: (next: SelfAssessmentAnswers) => void
  onContinue: () => void
}) {
  const [step, setStep] = useState(0) // 0=experience, 1=stakes, 2=confidence

  const canContinue =
    step === 0 ? !!answers.experience : step === 1 ? !!answers.stakes : true

  function next() {
    if (step < 2) {
      setStep(step + 1)
    } else {
      onContinue()
    }
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 p-6 sm:p-8">
      <div className="flex items-center gap-1.5 mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-violet-500' : 'bg-border/40',
            )}
          />
        ))}
      </div>

      {step === 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">
            How would you describe your poker experience?
          </h2>
          <PillGroup
            options={EXPERIENCE_OPTIONS}
            value={answers.experience}
            onChange={(experience) => onChange({ ...answers, experience })}
          />
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">
            Which stakes do you usually play?
          </h2>
          <PillGroup
            options={STAKES_OPTIONS}
            value={answers.stakes}
            onChange={(stakes) => onChange({ ...answers, stakes })}
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-6">
            How confident are you in your current poker ability?
          </h2>
          <LessonSlider
            label="Confidence"
            value={answers.confidence}
            onChange={(confidence) => onChange({ ...answers, confidence })}
            min={1}
            max={10}
            step={1}
            format={() => ''}
            ticks={['Complete Beginner', 'Professional']}
            hint="Drag to rate yourself"
          />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={next}
          disabled={!canContinue}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all',
            canContinue
              ? 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'
              : 'bg-secondary/30 text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          {step < 2 ? 'Next' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
