import { describe, it, expect } from 'vitest'
import { isNewLearnerIdentity, shouldSkipRehydration } from '@/contexts/LearnProgressContext'

// Regression coverage for the exact bug report: "complete a lesson, see it
// green, log out, log back into the SAME account, and it's no longer
// completed." One concrete hypothesis was that LearnProgressContext's
// hydration guard (`hydratedRef`/`hydratedForUserRef`) fails to reset across
// a logout/login transition, so the freshly-authenticated user's progress is
// never actually refetched. `isNewLearnerIdentity` is the exact comparison
// LearnProgressContext's hydration effect uses to decide this — these tests
// exercise it directly against the real transitions a browser session goes
// through, without needing to mount the React tree (this project has no DOM
// test environment configured).

describe('isNewLearnerIdentity — LearnProgressContext hydration-reset guard', () => {
  it('logout (user -> null) is always a new identity, forcing a reset to guest state', () => {
    expect(isNewLearnerIdentity('user-a', null)).toBe(true)
  })

  it('a fresh login from a logged-out/guest state (null -> user) is a new identity', () => {
    expect(isNewLearnerIdentity(null, 'user-a')).toBe(true)
  })

  it('logging back into the SAME account after logout IS a new identity relative to the post-logout null state', () => {
    // This is the exact sequence from the bug report:
    //   hydratedForUserRef: 'user-a' --(logout)--> null --(login as user-a again)--> 'user-a'
    // Step 1: logout must reset the guard.
    expect(isNewLearnerIdentity('user-a', null)).toBe(true)
    // Step 2: logging back in as the SAME user, starting from the post-logout
    // null, must ALSO be treated as a new identity — i.e. hydration must be
    // re-armed and progress refetched, not silently skipped because "we've
    // already hydrated this user id before" from the PRIOR session.
    expect(isNewLearnerIdentity(null, 'user-a')).toBe(true)
  })

  it('switching to a DIFFERENT account is a new identity (must not inherit the previous user\'s progress)', () => {
    expect(isNewLearnerIdentity('user-a', 'user-b')).toBe(true)
  })

  it('a background access-token refresh for the SAME already-hydrated user is NOT a new identity', () => {
    // This is the case the guard exists to protect: Supabase silently
    // rotates the access token periodically. That must not look like a new
    // login and re-arm the hydration guard, or an in-flight save could be
    // dropped / progress could flicker back to a loading state mid-session.
    expect(isNewLearnerIdentity('user-a', 'user-a')).toBe(false)
  })

  it('two consecutive guest states (still logged out) is not a new identity', () => {
    expect(isNewLearnerIdentity(null, null)).toBe(false)
  })

  it('simulates the full reported lifecycle end to end at the identity-guard level', () => {
    // hydratedForUserRef.current starts null (app just loaded, nobody authenticated yet)
    let hydratedForUser: string | null = null
    let hydratedRef = false

    function transition(nextUserId: string | null) {
      if (isNewLearnerIdentity(hydratedForUser, nextUserId)) {
        hydratedRef = false // force a re-fetch
      }
      hydratedForUser = nextUserId
      if (nextUserId) {
        // Simulates loadAuthedProgress() succeeding and marking hydrated.
        hydratedRef = true
      }
    }

    // 1. Log in as user-a — must hydrate.
    transition('user-a')
    expect(hydratedRef).toBe(true)
    expect(hydratedForUser).toBe('user-a')

    // 2. Complete a lesson mid-session (not modeled here — the guard doesn't
    //    change; this just documents that hydratedRef stays true while active).
    expect(hydratedRef).toBe(true)

    // 3. Log out.
    transition(null)
    expect(hydratedForUser).toBeNull()

    // 4. Log back into the SAME account — this is the exact moment the
    //    reported bug would show up if the guard failed to reset: it must
    //    re-arm and re-fetch, not silently reuse stale in-memory state.
    let refetchWasTriggered = false
    if (isNewLearnerIdentity(hydratedForUser, 'user-a')) {
      refetchWasTriggered = true
    }
    transition('user-a')
    expect(refetchWasTriggered).toBe(true)
    expect(hydratedRef).toBe(true)
    expect(hydratedForUser).toBe('user-a')
  })
})

describe('shouldSkipRehydration — avoids re-fetching progress on a same-user token refresh', () => {
  // Regression coverage for a contributing cause of "the lesson-completion
  // screen disappears / a click on it does nothing": the hydration effect
  // re-ran doMergeThenLoad() -> loadAuthedProgress() (which flips
  // progress.loading back to true) on EVERY change of the `token` value,
  // including a routine background access-token refresh for the SAME
  // already-hydrated user. app/learn/lesson/[slug]/page.tsx gates its ENTIRE
  // render behind `progress.loading`, so that spurious reload unmounts
  // LessonPlayer — discarding the celebration screen and any in-flight click
  // — even though nothing about the user's identity actually changed.

  it('a background token refresh for the same already-hydrated user must skip the re-fetch', () => {
    const isNewIdentity = isNewLearnerIdentity('user-a', 'user-a')
    expect(shouldSkipRehydration(isNewIdentity, /* alreadyHydrated */ true)).toBe(true)
  })

  it('a genuine new login/account switch must NOT skip the re-fetch, even though alreadyHydrated may still read true from the previous user', () => {
    const isNewIdentity = isNewLearnerIdentity('user-a', 'user-b')
    expect(shouldSkipRehydration(isNewIdentity, true)).toBe(false)
  })

  it('the very first load for a user (not yet hydrated) must NOT be skipped, even for the "same" identity comparison', () => {
    // hydratedForUserRef starts null, so the first ever effect run for a
    // freshly-authenticated user IS a new identity (null -> user-a) — but
    // this also covers the defensive case of alreadyHydrated=false directly.
    expect(shouldSkipRehydration(/* isNewIdentity */ false, /* alreadyHydrated */ false)).toBe(false)
  })

  it('end-to-end: simulates a lesson-completion click racing a background token refresh', () => {
    let hydratedForUser: string | null = 'user-a'
    let hydratedRef = true // already hydrated before this session's lesson began
    let loadingFlips = 0

    function onTokenChangeEffect(currentUserId: string) {
      const isNewIdentity = isNewLearnerIdentity(hydratedForUser, currentUserId)
      if (isNewIdentity) hydratedRef = false
      if (shouldSkipRehydration(isNewIdentity, hydratedRef)) return
      loadingFlips += 1 // stands in for setProgress({ ...p, loading: true })
      hydratedRef = true
      hydratedForUser = currentUserId
    }

    // A Supabase background refresh fires mid-lesson for the SAME user.
    onTokenChangeEffect('user-a')

    expect(loadingFlips).toBe(0) // must NOT have torn down the active screen
    expect(hydratedRef).toBe(true)
  })
})
