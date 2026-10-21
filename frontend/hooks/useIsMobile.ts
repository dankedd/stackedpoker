'use client'

import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'
const NARROW_PHONE_QUERY = '(max-width: 359px)'

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

/** True on the smallest phones still supported (<360px — iPhone SE and the
 *  320px floor). Same SSR-safe `false` default as `useIsMobile`.
 *
 *  Exists because the poker table's hole cards are a fixed pixel size while
 *  every other piece of its geometry is a percentage of the table. At 390px the
 *  card row is a third of the felt's width; at 320px it is nearly half, which
 *  leaves too little room either side for a seat's chip AND its label — the
 *  three genuinely do not fit, as measured rather than assumed. Below this
 *  breakpoint the cards drop one tier; everything else is unchanged. */
export function useIsNarrowPhone(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(NARROW_PHONE_QUERY)
    setIsNarrow(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isNarrow
}

const PHONE_QUERY = '(max-width: 480px)'

/** True on phones (≤480px). The preflop trainer's calmer phone table and inline
 *  result use this; tablets keep the `useIsMobile` layout. Same SSR-safe `false`
 *  default, so server markup always matches the desktop layout. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    setIsPhone(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsPhone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isPhone
}
