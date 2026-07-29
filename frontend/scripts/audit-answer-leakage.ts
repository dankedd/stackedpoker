// Curriculum-wide answer-leakage inventory dump.
// Run: node scripts/run-ts.js scripts/audit-answer-leakage.ts
//
// Walks every LessonStep in LESSONS that carries an `options: StepOption[]`
// array (the prose multiple-choice/decision-spot/classify shape) and reports
// steps flagged by `lib/learn/answerLeakageAudit.ts`'s heuristics: length,
// word count, explanation-connector words, extreme language, precision,
// punctuation. This is a DETECTOR only — it does not rewrite content.

import { LESSONS, LEARNING_MODULES } from '../lib/learn/curriculum'
import { auditStepOptions } from '../lib/learn/answerLeakageAudit'
import type { LessonStep } from '../lib/learn/types'
import * as fs from 'fs'
import * as path from 'path'

interface InventoryRow {
  module: string
  moduleSlug: string
  lesson: string
  lessonSlug: string
  stepId: string
  stepType: string
  question: string
  correctOption: string
  correctLabel: string
  distractors: string[]
  exempt: string | null
  flags: { reason: string; detail: string }[]
}

function questionTextFor(step: LessonStep): string {
  return step.decision_spot_question || step.narrative || '(no narrative/question text)'
}

function main() {
  const moduleBySlug = new Map(LEARNING_MODULES.map((m) => [m.slug, m]))
  const rows: InventoryRow[] = []
  let totalSteps = 0
  let stepsWithOptions = 0

  for (const lesson of LESSONS) {
    const mod = moduleBySlug.get(lesson.module_id) || LEARNING_MODULES.find((m) => m.id === lesson.module_id)
    const moduleLabel = mod ? mod.title : lesson.module_id
    const moduleSlug = mod ? mod.slug : lesson.module_id
    for (const step of lesson.steps) {
      totalSteps++
      if (!step.options || step.options.length === 0) continue
      stepsWithOptions++
      const correctIdx = step.options.findIndex((o) => o.quality === 'perfect')
      const { exempt, flags } = auditStepOptions(step.options)
      rows.push({
        module: moduleLabel,
        moduleSlug,
        lesson: lesson.title,
        lessonSlug: lesson.slug,
        stepId: step.id,
        stepType: step.type,
        question: questionTextFor(step),
        correctOption: correctIdx >= 0 ? step.options[correctIdx].id : '(none marked perfect)',
        correctLabel: correctIdx >= 0 ? step.options[correctIdx].label : '',
        distractors: step.options.filter((_, i) => i !== correctIdx).map((o) => o.label),
        exempt,
        flags,
      })
    }
  }

  const flagged = rows.filter((r) => !r.exempt && r.flags.length > 0)
  const exempted = rows.filter((r) => r.exempt)
  const clean = rows.filter((r) => !r.exempt && r.flags.length === 0)

  console.log(`Total lessons: ${LESSONS.length}`)
  console.log(`Total steps: ${totalSteps}`)
  console.log(`Steps with options[]: ${stepsWithOptions}`)
  console.log(`  exempt (canonical action / card / numeric-only / no-perfect): ${exempted.length}`)
  console.log(`  clean (eligible, no flags): ${clean.length}`)
  console.log(`  FLAGGED: ${flagged.length}`)
  console.log('')

  const byReason: Record<string, number> = {}
  for (const r of flagged) for (const f of r.flags) byReason[f.reason] = (byReason[f.reason] || 0) + 1
  console.log('Flags by reason:')
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`)
  }

  const outPath = process.env.AUDIT_OUT || path.join(process.cwd(), 'audit-output.json')
  fs.writeFileSync(outPath, JSON.stringify({ rows, summary: { totalSteps, stepsWithOptions, exempted: exempted.length, clean: clean.length, flagged: flagged.length, byReason } }, null, 2))
  console.log(`\nFull inventory written to ${outPath}`)
}

export { main }
