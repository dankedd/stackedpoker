'use client'

import { useState } from 'react'
import { MorphologyBuilder } from '@/components/learn/steps/MorphologyBuilder'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

// TEMPORARY smoke-test route — not linked from any nav, safe to delete after manual verification.
const step: LessonStep = (() => {
  for (const lesson of LESSONS) {
    const found = lesson.steps.find((s) => s.id === 'l5-s19')
    if (found) return found
  }
  throw new Error('l5-s19 not found')
})()

export default function DevPreviewPage() {
  const [answer, setAnswer] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-sm font-bold text-foreground">DEV PREVIEW: l5-s19 (morphology_builder build)</h1>
      <MorphologyBuilder
        step={step}
        onAnswer={(response, timeMs) => setAnswer(JSON.stringify(response) + ` @${timeMs}ms`)}
      />
      {answer && (
        <div id="answer-log" className="rounded border border-emerald-500 p-2 text-xs text-emerald-400">
          onAnswer fired: {answer}
        </div>
      )}
    </div>
  )
}
