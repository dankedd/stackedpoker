'use client'

import { useEffect, useState } from 'react'
import { Trophy, Star, Zap, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Particle ──────────────────────────────────────────────────────────────────

interface Particle {
  id: number
  x: number
  y: number
  size: number
  color: string
  duration: number
  delay: number
  angle: number
}

function generateParticles(count = 28): Particle[] {
  const colors = [
    'bg-violet-400', 'bg-blue-400', 'bg-amber-400',
    'bg-emerald-400', 'bg-fuchsia-400', 'bg-sky-400',
  ]
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 35 + Math.random() * 30,  // cluster around center
    y: 25 + Math.random() * 50,
    size: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    duration: 600 + Math.random() * 900,
    delay: Math.random() * 400,
    angle: Math.random() * 360,
  }))
}

// ── Main overlay ─────────────────────────────────────────────────────────────

interface LevelUpOverlayProps {
  newLevel: number
  xpEarned: number
  onDismiss: () => void
  achievementName?: string
}

export function LevelUpOverlay({
  newLevel,
  xpEarned,
  onDismiss,
  achievementName,
}: LevelUpOverlayProps) {
  const [particles] = useState(() => generateParticles())
  const [visible, setVisible] = useState(false)
  const [xpCount, setXpCount] = useState(0)
  const [levelCount, setLevelCount] = useState(newLevel - 1)

  // Entrance animation sequence
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    // XP count-up
    const t2 = setTimeout(() => {
      const duration = 800
      const start = performance.now()
      function step(now: number) {
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setXpCount(Math.round(xpEarned * eased))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 300)
    // Level number flip
    const t3 = setTimeout(() => setLevelCount(newLevel), 600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [xpEarned, newLevel])

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        onClick={handleDismiss}
      />

      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className={cn(
            'absolute rounded-full pointer-events-none',
            p.color,
            'animate-bounce'
          )}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
            opacity: 0.8,
          }}
        />
      ))}

      {/* Card */}
      <div
        className={cn(
          'relative z-10 mx-4 w-full max-w-sm rounded-3xl border border-violet-500/40',
          'bg-gradient-to-b from-violet-950/95 via-card/95 to-blue-950/90',
          'shadow-2xl shadow-violet-900/60 p-8',
          'transition-transform duration-500 ease-out',
          visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'
        )}
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-violet-500/30 blur-3xl"
        />

        {/* Trophy icon */}
        <div className="flex justify-center mb-5">
          <div
            className={cn(
              'relative flex h-20 w-20 items-center justify-center rounded-full',
              'bg-gradient-to-br from-amber-400/30 to-amber-600/10',
              'border-2 border-amber-400/40',
              'shadow-lg shadow-amber-900/30'
            )}
          >
            <Trophy className="h-10 w-10 text-amber-400" />
            {/* Ring pulse */}
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 animate-ping" />
          </div>
        </div>

        {/* Level up text */}
        <div className="text-center mb-6">
          <p className="text-[11px] font-black uppercase tracking-[0.35em] text-violet-400/70 mb-1">
            Level Up
          </p>
          <div className="flex items-baseline justify-center gap-3">
            <span className="text-6xl font-black tabular-nums text-foreground">
              {levelCount}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You've reached{' '}
            <span className="font-semibold text-violet-300">Level {newLevel}</span>
          </p>
        </div>

        {/* XP earned */}
        <div className="flex justify-center mb-5">
          <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-lg font-black tabular-nums text-amber-300">
              +{xpCount} XP
            </span>
          </div>
        </div>

        {/* Achievement (optional) */}
        {achievementName && (
          <div className="flex items-center justify-center gap-2 mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-2.5">
            <Star className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm font-semibold text-emerald-300">{achievementName} unlocked</p>
          </div>
        )}

        {/* Stars decoration */}
        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2, 3, 4].map(i => (
            <Star
              key={i}
              className={cn(
                'h-5 w-5 transition-all duration-200',
                i < Math.min(newLevel, 5) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'
              )}
              style={{ transitionDelay: `${i * 80 + 600}ms` }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2',
            'rounded-xl bg-gradient-to-r from-violet-600 to-blue-500',
            'px-6 py-3.5 text-sm font-semibold text-white',
            'shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50',
            'hover:-translate-y-0.5 transition-all duration-200 overflow-hidden'
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
          Keep learning
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  )
}

// ── XP Flash — small inline burst (not full screen) ──────────────────────────

export function XPFlash({
  xp,
  className,
}: {
  xp: number
  className?: string
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10',
        'px-3 py-1 text-sm font-black text-amber-300',
        'transition-all duration-500',
        visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-3 scale-90 pointer-events-none',
        className
      )}
    >
      <Zap className="h-3.5 w-3.5" />
      +{xp} XP
    </div>
  )
}
