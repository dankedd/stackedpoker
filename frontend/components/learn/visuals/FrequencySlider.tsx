'use client'

import { LessonSlider } from '@/components/learn/visuals/LessonSlider'

/**
 * A 0-100% frequency slider. Thin wrapper over the platform-wide
 * `LessonSlider`, kept as its own export because every Game Theory
 * Foundations (Module 10) interaction calls it and "a frequency is a
 * percentage 0-100" is a real constraint worth naming once.
 *
 * HISTORY: this used to render explicit +/- stepper buttons flanking the
 * track, added so no interaction would require precise dragging. QA found the
 * buttons had the opposite effect on comprehension — the control read as "a
 * number with two buttons", and learners did not discover it was draggable at
 * all. The buttons are gone; the affordance now comes from the slider itself
 * (large thumb, filled track, value pinned to the thumb). Coarse, non-drag
 * input is still fully supported: the underlying native range input takes
 * arrow keys, Home/End and PageUp/PageDown, and a tap anywhere on the track
 * jumps the thumb there without any dragging.
 */
export function FrequencySlider({
  label,
  value,
  onChange,
  disabled = false,
  step = 1,
  accent = 'violet',
  hint,
}: {
  label: string
  /** 0-100 */
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  step?: number
  accent?: 'violet' | 'blue'
  hint?: string | null
}) {
  return (
    <LessonSlider
      label={label}
      value={value}
      onChange={(next) => onChange(Math.max(0, Math.min(100, next)))}
      min={0}
      max={100}
      step={step}
      disabled={disabled}
      accent={accent}
      format={(v) => `${v.toFixed(0)}%`}
      hint={hint}
    />
  )
}
