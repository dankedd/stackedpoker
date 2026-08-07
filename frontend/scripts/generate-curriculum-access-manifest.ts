/**
 * Generates the tiny lesson/module ORDERING manifest the backend needs to
 * enforce Learn's free-tier access rule server-side
 * (backend/app/engines/learn/curriculum_access_manifest.json, loaded by
 * backend/app/engines/learn/curriculum_access.py).
 *
 * WHY THIS EXISTS: the backend has no Node/TS runtime, so it cannot import
 * curriculum.ts or lib/entitlements.ts directly, but api/routes/learn.py's
 * step-result and lesson-complete endpoints must reject writes for a lesson
 * the caller's subscription tier doesn't unlock — otherwise a locked lesson
 * could still be "completed" via a raw API call even though the UI/lesson
 * page correctly blocks it (see the membership-system plan's "server-side
 * security" requirement: URL/API/console/direct-request access must all be
 * closed, not just the page route).
 *
 * Reuses generateCurriculumPublic.ts's buildCurriculumPublic() — the exact
 * same lesson/module ordering data, not a second computation — and keeps
 * ONLY the fields curriculum_access.py's rule actually needs (module_id,
 * sort_order, module order), never lesson content.
 *
 * curriculum.ts remains the ONE authoritative source. This file (and the
 * JSON it produces) is a generated artifact, never hand-edited — mirrors
 * generate-reward-manifest.ts's exact pattern, including a freshness test
 * (see lib/learn/__tests__/curriculumAccessManifestFreshness.test.ts).
 *
 * Run via: npm run generate:curriculum-access-manifest  (from frontend/)
 */
import { writeFileSync } from 'fs'
import path from 'path'
import { buildCurriculumPublic } from './generateCurriculumPublic'

export interface CurriculumAccessManifest {
  lessons: Record<string, { module_id: string; sort_order: number }>
  modules: Record<string, { order: number | null }>
}

export function buildCurriculumAccessManifest(): CurriculumAccessManifest {
  const data = buildCurriculumPublic()
  const manifest: CurriculumAccessManifest = { lessons: {}, modules: {} }

  for (const lesson of data.lessons) {
    manifest.lessons[lesson.id] = { module_id: lesson.module_id, sort_order: lesson.sort_order }
  }
  for (const learningModule of data.modules) {
    manifest.modules[learningModule.id] = { order: learningModule.order ?? null }
  }

  return manifest
}

export function main() {
  const manifest = buildCurriculumAccessManifest()
  const outPath = path.resolve(__dirname, '../../backend/app/engines/learn/curriculum_access_manifest.json')
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(
    `Wrote curriculum access manifest: ${Object.keys(manifest.lessons).length} lessons, ` +
    `${Object.keys(manifest.modules).length} modules -> ${outPath}`,
  )
}
