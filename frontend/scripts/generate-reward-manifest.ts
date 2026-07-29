/**
 * Generates the canonical XP reward manifest consumed by the backend
 * (backend/app/engines/learn/reward_manifest.json, loaded by
 * backend/app/engines/learn/reward_resolver.py).
 *
 * WHY THIS EXISTS: the backend has no Node/TS runtime, so it cannot import
 * curriculum.ts directly, but it must stop trusting client-submitted XP
 * amounts (see reward_resolver.py's module docstring). Rather than hand-copy
 * reward numbers into Python (which would silently drift the moment
 * curriculum.ts changes) or maintain a second hand-authored table, this
 * script extracts the REAL, live values straight out of curriculum.ts by
 * actually importing and running it — so the manifest can never disagree
 * with what the frontend evaluator itself uses, other than briefly, if
 * someone edits curriculum.ts and forgets to re-run this script. That
 * "forgot to regenerate" case is caught by
 * frontend/lib/learn/__tests__/rewardManifestFreshness.test.ts, which fails
 * the test suite if the checked-in JSON and curriculum.ts disagree.
 *
 * curriculum.ts remains the ONE authoritative source. This file (and the
 * JSON it produces) is a generated artifact, never hand-edited.
 *
 * Run via: npm run generate:reward-manifest  (from frontend/)
 */
import { writeFileSync } from 'fs'
import path from 'path'
import { LESSONS, LEARNING_MODULES } from '../lib/learn/curriculum'

export interface RewardManifest {
  lessons: Record<string, { xp_reward: number; steps: Record<string, number> }>
  modules: Record<string, number>
}

export function buildRewardManifest(): RewardManifest {
  const manifest: RewardManifest = { lessons: {}, modules: {} }

  for (const lesson of LESSONS) {
    const steps: Record<string, number> = {}
    for (const step of lesson.steps) {
      // Matches evaluator.ts's `const baseXP = step.xp ?? 10` fallback exactly.
      steps[step.id] = step.xp ?? 10
    }
    manifest.lessons[lesson.id] = { xp_reward: lesson.xp_reward, steps }
  }

  for (const learningModule of LEARNING_MODULES) {
    manifest.modules[learningModule.id] = learningModule.xp_reward
  }

  return manifest
}

// Only called by scripts/run-ts.js (see its `mod.main()` convention) — the
// freshness test imports buildRewardManifest() directly instead, so
// importing this module never has a file-write side effect on its own.
export function main() {
  const manifest = buildRewardManifest()
  const outPath = path.resolve(__dirname, '../../backend/app/engines/learn/reward_manifest.json')
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')
  const stepCount = Object.values(manifest.lessons).reduce(
    (sum, l) => sum + Object.keys(l.steps).length, 0,
  )
  console.log(
    `Wrote reward manifest: ${Object.keys(manifest.lessons).length} lessons ` +
    `(${stepCount} steps), ${Object.keys(manifest.modules).length} modules -> ${outPath}`,
  )
}
