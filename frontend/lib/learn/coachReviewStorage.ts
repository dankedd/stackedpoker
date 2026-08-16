/**
 * Shared sessionStorage key for handing a just-completed lesson's Coach
 * Review context from LessonPlayer to the /coach page across a full page
 * navigation (sessionStorage survives the navigation; component state
 * doesn't). Kept in one place so the writer and reader can't drift.
 */
export const COACH_REVIEW_STORAGE_KEY = 'pokercoach:coach:pending_review'

/**
 * The same handoff, for a hand analysed on /tools/poker-hand-analyzer.
 *
 * A separate key rather than a shared one so a pending lesson review and a
 * pending hand analysis can never overwrite each other, and so each reader
 * consumes only its own payload.
 */
export const COACH_HAND_STORAGE_KEY = 'pokercoach:coach:pending_hand'
