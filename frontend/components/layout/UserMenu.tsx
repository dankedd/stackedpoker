'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { LayoutDashboard, Settings, LogOut, ChevronDown, CreditCard, Loader2, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLearnProgress } from '@/contexts/LearnProgressContext'
import { useSubscription } from '@/hooks/useSubscription'
import { useManageSubscription } from '@/hooks/useManageSubscription'
import { PlanBadge } from '@/components/layout/PlanBadge'
import { isPaidTier } from '@/lib/entitlements'
import {
  MENU_Z_INDEX,
  useAnchoredMenuPosition,
  useDismissOnOutsideOrEscape,
  useRecomputeOnScrollResize,
} from '@/hooks/useAnchoredMenu'

const DROPDOWN_W = 224 // w-56 = 14rem

/** One row style, so the upgrade link and the billing-portal button are
 *  indistinguishable to the eye. */
const ROW_CLASS =
  'flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 transition-all duration-150 group disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-slate-400'

const ROW_ICON_CLASS =
  'h-4 w-4 shrink-0 text-slate-600 group-hover:text-violet-400 transition-colors duration-150'

type MenuEntry =
  | { kind: 'link'; href: string; icon: LucideIcon; label: string }
  | { kind: 'action'; onClick: () => void; icon: LucideIcon; label: string; busy: boolean }

export function UserMenu() {
  const { user, signOut, loading } = useAuth()
  const { progress } = useLearnProgress()
  const { subscription } = useSubscription()
  const { handleManage, loading: managingSubscription } = useManageSubscription()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { pos, triggerRef, computePos } = useAnchoredMenuPosition({ width: DROPDOWN_W })

  function handleToggle() {
    if (!open) computePos()
    setOpen(v => !v)
  }

  useDismissOnOutsideOrEscape(open, () => setOpen(false), triggerRef, dropdownRef)
  useRecomputeOnScrollResize(open, computePos)

  if (loading) {
    return <div className="h-8 w-8 rounded-full bg-white/[0.06] animate-pulse" />
  }

  if (!user) return null

  const displayName =
    user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Player'
  const initials = displayName.slice(0, 2).toUpperCase()

  // Dashboard -> subscription -> Settings, then Sign out below the divider.
  //
  // The middle entry is the only one that changes: a free account is offered
  // the upgrade, a paying one gets the billing portal instead of being sold
  // something it already has. It is a button rather than a link there, so the
  // two shapes are modelled explicitly and share one row style below.
  //
  // "Hand History" used to sit between Dashboard and the subscription entry.
  // It pointed at /history, which is not a finished feature — the menu is not
  // the place to advertise it, so it is gone rather than disabled.
  const isPaid = isPaidTier(subscription?.tier)

  const menuItems: MenuEntry[] = [
    { kind: 'link', href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    isPaid
      ? {
          kind: 'action',
          onClick: handleManage,
          icon: CreditCard,
          label: 'Manage subscription',
          busy: managingSubscription,
        }
      : { kind: 'link', href: '/pricing', icon: CreditCard, label: 'Upgrade to Plus' },
    { kind: 'link', href: '/settings', icon: Settings, label: 'Settings' },
  ]

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: DROPDOWN_W,
        zIndex: MENU_Z_INDEX,
        transformOrigin: `${pos.originX} top`,
      }}
      className="animate-dropdown-in"
    >
      <div className="rounded-2xl border border-white/[0.1] bg-[#070C1B] shadow-2xl shadow-black/70 overflow-hidden">

        {/* User header */}
        <div className="px-4 py-3.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/80 to-blue-500/80 border border-violet-400/30 text-white text-xs font-bold shadow-sm shadow-violet-500/30">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
            {!progress.isGuest && (
              <span className="ml-auto shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                LVL {progress.skill.level}
              </span>
            )}
          </div>
          {subscription && (
            <div className="mt-2.5">
              <PlanBadge tier={subscription.tier} />
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="p-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            if (item.kind === 'action') {
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.busy}
                  onClick={() => { setOpen(false); item.onClick() }}
                  className={ROW_CLASS}
                >
                  {item.busy
                    ? <Loader2 className={`${ROW_ICON_CLASS} animate-spin`} />
                    : <Icon className={ROW_ICON_CLASS} />}
                  {item.label}
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={ROW_CLASS}
              >
                <Icon className={ROW_ICON_CLASS} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Sign out */}
        <div className="p-1.5 border-t border-white/[0.07]">
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 group"
          >
            <LogOut className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-red-400 transition-colors duration-150" />
            Sign out
          </button>
        </div>

      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.06] transition-colors duration-150 focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/80 to-blue-500/80 border border-violet-400/30 text-white text-[11px] font-bold shadow-sm shadow-violet-500/30">
          {initials}
          {!progress.isGuest && (
            <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-[#070C1B] bg-violet-500 px-1 text-[9px] font-bold leading-[13px] text-white">
              {progress.skill.level}
            </span>
          )}
        </div>
        <span className="hidden sm:block text-[13px] font-medium text-slate-300 max-w-[96px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && createPortal(dropdown, document.body)}
    </>
  )
}
