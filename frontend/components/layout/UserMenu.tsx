'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { LayoutDashboard, BookOpen, Settings, LogOut, ChevronDown, CreditCard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const DROPDOWN_W = 224 // w-56 = 14rem

interface DropdownPos {
  top: number
  left: number
  originX: string
}

export function UserMenu() {
  const { user, signOut, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, originX: '50%' })
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const computePos = useCallback(() => {
    if (!triggerRef.current) return
    const r   = triggerRef.current.getBoundingClientRect()
    const vw  = window.innerWidth

    // Center under trigger, clamp to viewport with 8 px margin
    let left = r.left + r.width / 2 - DROPDOWN_W / 2
    if (left < 8) left = 8
    if (left + DROPDOWN_W > vw - 8) left = vw - DROPDOWN_W - 8

    // Bottom-collision: if not enough space below, flip above
    const DROPDOWN_H_EST = 280
    const top = r.bottom + window.scrollY + 8 > window.innerHeight + window.scrollY - DROPDOWN_H_EST
      ? r.top - DROPDOWN_H_EST - 8   // flip above
      : r.bottom + 8                  // normal below (fixed so no scroll offset needed)

    setPos({
      top,
      left,
      originX: `${r.left + r.width / 2 - left}px`,
    })
  }, [])

  function handleToggle() {
    if (!open) computePos()
    setOpen(v => !v)
  }

  // Close on outside click (trigger + portal both excluded)
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (
        triggerRef.current?.contains(t) ||
        dropdownRef.current?.contains(t)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Recompute on scroll / resize while open
  useEffect(() => {
    if (!open) return
    const update = () => computePos()
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, computePos])

  if (loading) {
    return <div className="h-8 w-8 rounded-full bg-white/[0.06] animate-pulse" />
  }

  if (!user) return null

  const displayName =
    user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Player'
  const initials = displayName.slice(0, 2).toUpperCase()

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/history',   icon: BookOpen,        label: 'Hand History' },
    { href: '/pricing',   icon: CreditCard,      label: 'Upgrade to Pro' },
    { href: '/settings',  icon: Settings,        label: 'Settings' },
  ]

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: DROPDOWN_W,
        zIndex: 9999,
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
          </div>
        </div>

        {/* Nav links */}
        <div className="p-1.5">
          {menuItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 transition-all duration-150 group"
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-violet-400 transition-colors duration-150" />
              {label}
            </Link>
          ))}
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
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/80 to-blue-500/80 border border-violet-400/30 text-white text-[11px] font-bold shadow-sm shadow-violet-500/30">
          {initials}
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
