/**
 * Fails loudly if lib/learn/curriculumPublic.generated.ts has drifted from
 * curriculum.ts — i.e. someone added/edited a lesson or module and forgot to
 * run `npm run generate:curriculum-public`. Without this check, stale
 * metadata could silently disagree with the real lesson content (e.g. a
 * title/estimated_min shown on the module overview no longer matching the
 * actual lesson), or worse, a newly-added lesson could be invisible to every
 * metadata-only consumer (module page, journey map, dashboard) until someone
 * happened to regenerate the file.
 *
 * This is the enforcement half of "curriculum.ts remains the one
 * authoritative source, curriculumPublic.generated.ts is a generated,
 * verified artifact." Mirrors rewardManifestFreshness.test.ts exactly.
 */
import { describe, it, expect } from 'vitest'
import { buildCurriculumPublic } from '../../../scripts/generateCurriculumPublic'
import * as generated from '../curriculumPublic.generated'

describe('curriculum public metadata freshness', () => {
  it('matches what generateCurriculumPublic.ts derives from curriculum.ts right now', () => {
    const live = buildCurriculumPublic()

    expect(generated.PUBLIC_LESSONS).toEqual(live.lessons)
    expect(generated.LEARNING_MODULES).toEqual(live.modules)
    expect(generated.LEARNING_PATHS).toEqual(live.paths)
  })
})
