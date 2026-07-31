import { LESSONS, LEARNING_MODULES } from '../lib/learn/curriculum'

const TARGET_TYPES = new Set(['range_build', 'range_build_multi'])
const moduleBySlug = new Map(LEARNING_MODULES.map((m) => [m.id, m]))

for (const lesson of LESSONS) {
  const mod = moduleBySlug.get(lesson.module_id)
  for (const step of lesson.steps) {
    if (!TARGET_TYPES.has(step.type as string)) continue
    const hasPos = !!step.hero_position
    const hasStack = step.effective_stack_bb != null
    const hasSize = step.table_size != null
    const missing: string[] = []
    if (!hasPos) missing.push('hero_position')
    if (!hasStack) missing.push('effective_stack_bb')
    if (!hasSize) missing.push('table_size')
    console.log(
      `${mod ? mod.title : lesson.module_id} | ${lesson.title} (${lesson.id}) | ${step.id} | ${step.type} | ` +
      `pos=${step.hero_position ?? '-'} stack=${step.effective_stack_bb ?? '-'} size=${step.table_size ?? '-'} | ` +
      (missing.length ? `MISSING: ${missing.join(',')}` : 'OK')
    )
  }
}
