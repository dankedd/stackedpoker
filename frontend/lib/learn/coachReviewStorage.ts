/**
 * Shared sessionStorage key for handing a just-completed lesson's Coach
 * Review context from LessonPlayer to the /coach page across a full page
 * navigation (sessionStorage survives the navigation; component state
 * doesn't). Kept in one place so the writer and reader can't drift.
 */
export const COACH_REVIEW_STORAGE_KEY = 'pokercoach:coach:pending_review'
