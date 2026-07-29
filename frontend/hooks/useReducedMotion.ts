'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** True when the user has requested reduced motion. Defaults to `false` so
 *  server-rendered markup never assumes a preference before hydration —
 *  mirrors `useIsMobile`'s shape. Every JS-scheduled animation (timers,
 *  rAF loops, intervals) must check this before scheduling anything, since
 *  CSS `@media (prefers-reduced-motion: reduce)` alone only neutralizes
 *  already-running CSS animations, not JS timers. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
