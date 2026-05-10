'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { User, LayoutDashboard, BookOpen, Settings, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function UserMenu() {
  const { user, signOut, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (loading) {
    return <div className="h-8 w-8 rounded-full bg-border animate-pulse" />
  }

  if (!user) return null

  const displayName =
    user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Player'
  const initials = displayName.slice(0, 2).toUpperCase()

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/history',   icon: BookOpen,        label: 'Hand History' },
    { href: '/settings',  icon: Settings,        label: 'Settings' },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Avatar */}
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-poker-green/20 border border-poker-green/40 text-poker-green text-xs font-bold">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-foreground max-w-[100px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border/60 bg-card shadow-xl animate-fade-in z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          {/* Links */}
          <div className="py-1">
            {menuItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:text-foreground hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-border/40 py-1">
            <button
              onClick={() => { setOpen(false); signOut() }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
