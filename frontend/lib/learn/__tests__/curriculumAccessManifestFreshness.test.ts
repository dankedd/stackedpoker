/**
 * Fails loudly if backend/app/engines/learn/curriculum_access_manifest.json
 * has drifted from curriculum.ts — i.e. someone added/reordered a lesson or
 * module and forgot to run `npm run generate:curriculum-access-manifest`.
 * Without this check, the backend's server-side lesson-access enforcement
 * (curriculum_access.py) could silently disagree with the frontend's
 * lib/entitlements.ts, e.g. allowing a POST to complete a lesson the UI
 * correctly shows as locked, or vice versa.
 *
 * Mirrors rewardManifestFreshness.test.ts's exact pattern.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { buildCurriculumAccessManifest } from '../../../scripts/generate-curriculum-access-manifest'

describe('curriculum access manifest freshness', () => {
  it('matches what generate-curriculum-access-manifest.ts derives from curriculum.ts right now', () => {
    const live = buildCurriculumAccessManifest()
    const manifestPath = path.resolve(
      __dirname, '../../../../backend/app/engines/learn/curriculum_access_manifest.json',
    )
    const checkedIn = JSON.parse(readFileSync(manifestPath, 'utf-8'))

    expect(checkedIn).toEqual(live)
  })
})
