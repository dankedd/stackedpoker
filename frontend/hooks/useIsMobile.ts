'use client'

import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'

/** True on narrow (<768px, Tailwind's `md`) viewports. Defaults to `false` so
 *  server-rendered and pre-hydration markup always matches the desktop layout —
 *  the mobile layout only takes over once the media query resolves client-side. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
