/**
 * Puts the top of the current lesson step card back under the sticky header.
 *
 * The problem this solves: answering a question replaces a short question card
 * with a much taller feedback card, and the browser keeps the scroll position
 * it already had. On a phone that lands the learner somewhere in the middle of
 * the explanation, with the "Perfect Play" / "Mistake" heading, the score and
 * the Theory Engine badge all above the fold — they have to scroll up to find
 * out how they did.
 *
 * Two things make this fiddly enough to be worth centralising:
 *
 *  1. The lesson header is `position: sticky`, so scrolling the card to y=0
 *     parks its top *underneath* the header. The header's real height is
 *     measured at call time (it differs between the mobile and desktop
 *     layouts, and grows again when a lesson title wraps to two lines).
 *  2. The lesson currently scrolls the document, but a step type may one day be
 *     rendered inside its own scroll container. Rather than hard-code
 *     `window`, the nearest scrollable ancestor of the card wins.
 *
 * Elements are found by data attribute rather than by ref because the callers
 * are spread across the tree: LessonPlayer owns the phase transitions, but a
 * step type that reveals its own feedback inline (TableDecision) has no handle
 * on the card that wraps it. Any future step doing the same only needs to call
 * this function — no ref plumbing, no new props.
 */

/** Marks the card wrapping the interactive step / its feedback. */
export const LESSON_CARD_ATTR = 'data-lesson-step-card'
/** Marks the sticky lesson header whose height the scroll must clear. */
export const LESSON_HEADER_ATTR = 'data-lesson-header'

/** Breathing room between the sticky header and the card's top edge. */
const GAP_PX = 12

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Nearest ancestor that actually scrolls, or null when the document does. */
function scrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

function stickyHeaderHeight(): number {
  const header = document.querySelector<HTMLElement>(`[${LESSON_HEADER_ATTR}]`)
  if (!header) return 0
  // Only a header pinned to the top eats space at the scroll destination; one
  // that has scrolled away with the page does not.
  const { position } = getComputedStyle(header)
  if (position !== 'sticky' && position !== 'fixed') return 0
  return header.getBoundingClientRect().height
}

/**
 * Scrolls so the current step card starts just below the sticky header.
 * Falls back to the top of the page when no card is on screen (the intro and
 * completion phases, which have no step card of their own).
 *
 * Safe to call from an effect on the server-rendered tree — it no-ops without
 * a DOM.
 */
export function scrollLessonCardIntoView(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
  const card = document.querySelector<HTMLElement>(`[${LESSON_CARD_ATTR}]`)

  if (!card) {
    window.scrollTo({ top: 0, behavior })
    return
  }

  const offset = stickyHeaderHeight() + GAP_PX
  const container = scrollableAncestor(card)

  if (container) {
    const delta = card.getBoundingClientRect().top - container.getBoundingClientRect().top
    const top = Math.max(0, container.scrollTop + delta - offset)
    container.scrollTo({ top, behavior })
    return
  }

  const top = Math.max(0, window.scrollY + card.getBoundingClientRect().top - offset)
  window.scrollTo({ top, behavior })
}

/**
 * Runs `scrollLessonCardIntoView` once the newly revealed content has actually
 * been laid out. One frame lets React commit; the second lets the browser
 * finish layout for the taller card, so the measurement isn't taken against
 * the card that was on screen a moment ago.
 *
 * Returns a cancel function for effect cleanup.
 */
export function scrollLessonCardIntoViewAfterPaint(): () => void {
  if (typeof window === 'undefined') return () => {}
  let inner = 0
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(scrollLessonCardIntoView)
  })
  return () => {
    cancelAnimationFrame(outer)
    if (inner) cancelAnimationFrame(inner)
  }
}
