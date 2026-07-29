/**
 * Fails loudly if backend/app/engines/learn/reward_manifest.json has drifted
 * from curriculum.ts — i.e. someone edited a lesson's xp/xp_reward and forgot
 * to run `npm run generate:reward-manifest`. Without this check, that mistake
 * would silently zero out legitimate XP for the changed lesson/step (see
 * reward_resolver.py's "unknown lesson_id/step_id" fallback), which would be
 * a confusing, hard-to-diagnose production regression.
 *
 * This is the enforcement half of "curriculum.ts remains the one
 * authoritative source, the manifest is a generated, verified artifact."
 */
import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { buildRewardManifest } from '../../../scripts/generate-reward-manifest'

describe('reward manifest freshness', () => {
  it('matches what generate-reward-manifest.ts derives from curriculum.ts right now', () => {
    const live = buildRewardManifest()
    const manifestPath = path.resolve(
      __dirname, '../../../../backend/app/engines/learn/reward_manifest.json',
    )
    const checkedIn = JSON.parse(readFileSync(manifestPath, 'utf-8'))

    expect(checkedIn).toEqual(live)
  })
})
