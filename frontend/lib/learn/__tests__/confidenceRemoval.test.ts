import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { LESSONS } from '../curriculum'

/**
 * Regression coverage for the removal of the learner-facing "confidence
 * check" (How confident are you before you answer? Low/Medium/High) that
 * used to gate certain steps across Modules 4-7. See MEMORY (feedback):
 * confidence prompts were removed globally, not just from the module being
 * viewed at the time. Nothing should ever reintroduce them.
 */

function walkSteps(step: unknown, visit: (s: Record<string, unknown>) => void) {
  if (!step || typeof step !== 'object') return
  const s = step as Record<string, unknown>
  visit(s)
  if (Array.isArray(s.remediation_ladder)) {
    for (const rung of s.remediation_ladder) walkSteps(rung, visit)
  }
}

describe('confidence check removal — curriculum data', () => {
  it('no lesson step, at any nesting depth (including remediation ladder rungs), carries ask_confidence', () => {
    const offenders: string[] = []
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        walkSteps(step, (s) => {
          if ('ask_confidence' in s) offenders.push(`${lesson.id}/${String(s.id)}`)
        })
      }
    }
    expect(offenders).toEqual([])
  })

  it('no lesson step carries a reinforcement_step (the other confidence-only field — never authored, now removed from the type entirely)', () => {
    const offenders: string[] = []
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        walkSteps(step, (s) => {
          if ('reinforcement_step' in s) offenders.push(`${lesson.id}/${String(s.id)}`)
        })
      }
    }
    expect(offenders).toEqual([])
  })

  it('every lesson still has at least one real step — removing confidence never zeroed out a lesson', () => {
    for (const lesson of LESSONS) {
      expect(lesson.steps.length).toBeGreaterThan(0)
    }
  })

  it('step ids within a lesson are unique — confirms no leftover placeholder/blank step from the removal', () => {
    for (const lesson of LESSONS) {
      const ids = lesson.steps.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('remediation ladders (the only surviving piece of the adaptive-confidence system) still contain real, typed steps', () => {
    const laddersFound: string[] = []
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.remediation_ladder && step.remediation_ladder.length > 0) {
          laddersFound.push(step.id)
          for (const rung of step.remediation_ladder) {
            expect(rung.id).toBeTruthy()
            expect(rung.type).toBeTruthy()
          }
        }
      }
    }
    // Sanity: the 5 ladder-bearing lessons found in the pre-removal audit are still intact.
    expect(laddersFound.length).toBe(5)
  })
})

describe('confidence check removal — source code (no reintroduction)', () => {
  const frontendRoot = path.resolve(__dirname, '../../..')
  const FORBIDDEN = ['ask_confidence', 'learner_confidence', 'ConfidencePrompt', 'pendingConfidence', 'handleConfidenceSelect']

  const filesToScan = [
    'components/learn/LessonPlayer.tsx',
    'lib/learn/types.ts',
    'lib/learn/adaptiveEngine.ts',
    'lib/learn/curriculum.ts',
  ]

  it('ConfidencePrompt.tsx no longer exists', () => {
    const p = path.join(frontendRoot, 'components/learn/ConfidencePrompt.tsx')
    expect(fs.existsSync(p)).toBe(false)
  })

  for (const relPath of filesToScan) {
    it(`${relPath} contains none of the removed confidence identifiers`, () => {
      const full = path.join(frontendRoot, relPath)
      const src = fs.readFileSync(full, 'utf8')
      for (const token of FORBIDDEN) {
        expect(src.includes(token)).toBe(false)
      }
    })
  }
})
