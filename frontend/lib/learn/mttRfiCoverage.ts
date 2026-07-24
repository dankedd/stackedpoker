/**
 * Internal provenance/coverage map — NOT learner-facing.
 *
 * Tracks which lesson(s), step(s), and Lab/Drill pool question(s) exercise each of the
 * 32 canonical MTT_RFI_CHARTS entries, so a curriculum-integrity test can assert that
 * every transcribed chart is actually taught and drilled somewhere (no orphaned data),
 * and that every taught/drilled chart genuinely exists in the canonical dataset.
 *
 * Populated incrementally as lessons and the Lab pool are authored (Checkpoints 3-6).
 */

export interface MttRfiCoverageEntry {
  chartKey: string
  usedByLessonIds: string[]
  usedByStepIds: string[]
  usedByLabPoolQuestionIds: string[]
}

export const MTT_RFI_COVERAGE: Record<string, MttRfiCoverageEntry> = {}

export function recordCoverage(
  chartKey: string,
  opts: { lessonId?: string; stepId?: string; labPoolQuestionId?: string },
): void {
  const entry = MTT_RFI_COVERAGE[chartKey] ?? {
    chartKey,
    usedByLessonIds: [],
    usedByStepIds: [],
    usedByLabPoolQuestionIds: [],
  }
  if (opts.lessonId && !entry.usedByLessonIds.includes(opts.lessonId)) {
    entry.usedByLessonIds.push(opts.lessonId)
  }
  if (opts.stepId && !entry.usedByStepIds.includes(opts.stepId)) {
    entry.usedByStepIds.push(opts.stepId)
  }
  if (opts.labPoolQuestionId && !entry.usedByLabPoolQuestionIds.includes(opts.labPoolQuestionId)) {
    entry.usedByLabPoolQuestionIds.push(opts.labPoolQuestionId)
  }
  MTT_RFI_COVERAGE[chartKey] = entry
}
