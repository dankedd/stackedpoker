'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Pressure Gauge (SVG semicircle) ───────────────────────────────────────────
// Visualises fold pressure / aggression pressure (0–100%)

interface PressureGaugeProps {
  /** 0–100 */
  value: number
  label?: string
  sublabel?: string
  size?: number       // SVG width/height in px
  animate?: boolean
  className?: string
}

const TICKS = [
  { pct: 0,   label: '0' },
  { pct: 25,  label: '25' },
  { pct: 50,  label: '50' },
  { pct: 75,  label: '75' },
  { pct: 100, label: '100' },
]

function pctToAngle(pct: number) {
  // -135deg = 0%, 135deg = 100% (270° sweep on a semicircle-ish arc)
  return -135 + (pct / 100) * 270
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(cx, cy, r, endAngle)
  const end = polarToXY(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

function colorForValue(v: number) {
  if (v >= 75) return '#f87171'   // red-400
  if (v >= 50) return '#fb923c'   // orange-400
  if (v >= 25) return '#fbbf24'   // amber-400
  return '#34d399'                 // emerald-400
}

function labelForValue(v: number) {
  if (v >= 80) return 'Max Pressure'
  if (v >= 60) return 'High Pressure'
  if (v >= 40) return 'Moderate'
  if (v >= 20) return 'Light Pressure'
  return 'No Pressure'
}

export function PressureGauge({
  value,
  label,
  sublabel,
  size = 160,
  animate = true,
  className,
}: PressureGaugeProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : value)

  useEffect(() => {
    if (!animate) { setDisplayed(value); return }
    const duration = 900
    const start = performance.now()
    const from = 0
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(from + (value - from) * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, animate])

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.36
  const strokeW = size * 0.06
  const startAngle = -135
  const endAngle = 135

  const trackPath = describeArc(cx, cy, r, startAngle, endAngle)
  const fillPath = describeArc(cx, cy, r, startAngle, startAngle + (displayed / 100) * 270)

  // Needle
  const needleAngle = pctToAngle(displayed)
  const needleTip = polarToXY(cx, cy, r - strokeW * 0.5, needleAngle)
  const needleBase1 = polarToXY(cx, cy, strokeW * 0.4, needleAngle + 90)
  const needleBase2 = polarToXY(cx, cy, strokeW * 0.4, needleAngle - 90)

  const color = colorForValue(value)

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Fill */}
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity="0.9"
          style={{ filter: `drop-shadow(0 0 ${strokeW * 0.6}px ${color})` }}
        />

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill={color}
          opacity={0.9}
        />
        <circle cx={cx} cy={cy} r={strokeW * 0.45} fill={color} opacity={0.9} />

        {/* Tick labels */}
        {TICKS.map(({ pct, label: tl }) => {
          const angle = pctToAngle(pct)
          const pt = polarToXY(cx, cy, r + strokeW * 1.3, angle)
          return (
            <text
              key={pct}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={size * 0.065}
              fill="rgba(255,255,255,0.25)"
              fontFamily="monospace"
              fontWeight="700"
            >
              {tl}
            </text>
          )
        })}

        {/* Center value */}
        <text
          x={cx}
          y={cy + r * 0.15}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.16}
          fill="white"
          fontWeight="900"
          fontFamily="monospace"
        >
          {displayed}%
        </text>
        <text
          x={cx}
          y={cy + r * 0.42}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.075}
          fill={color}
          fontWeight="700"
        >
          {labelForValue(displayed)}
        </text>
      </svg>

      {label && (
        <p className="text-xs font-semibold text-foreground text-center">{label}</p>
      )}
      {sublabel && (
        <p className="text-[10px] text-muted-foreground/50 text-center">{sublabel}</p>
      )}
    </div>
  )
}

// ── Compact fold frequency bar ────────────────────────────────────────────────

interface FoldFreqBarProps {
  /** 0–100 fold frequency */
  foldFreq: number
  mdf: number         // minimum defense frequency
  className?: string
}

export function FoldFreqBar({ foldFreq, mdf, className }: FoldFreqBarProps) {
  const isOverFolding = foldFreq > (100 - mdf)
  const isUnderFolding = foldFreq < (100 - mdf - 10)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground">Fold frequency</span>
        <span className={cn(
          'font-bold tabular-nums',
          isOverFolding ? 'text-red-400' : isUnderFolding ? 'text-amber-400' : 'text-emerald-400'
        )}>
          {foldFreq}%
        </span>
      </div>

      <div className="relative h-3 rounded-full bg-secondary/40 overflow-hidden">
        {/* MDF line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-violet-400 z-10"
          style={{ left: `${100 - mdf}%` }}
        />
        {/* Fold bar */}
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isOverFolding ? 'bg-red-500/70' : isUnderFolding ? 'bg-amber-500/70' : 'bg-emerald-500/70'
          )}
          style={{ width: `${foldFreq}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/40">
        <span>Never fold</span>
        <div className="flex items-center gap-1 text-violet-400/70">
          <div className="h-1.5 w-0.5 bg-violet-400/70" />
          <span>MDF boundary</span>
        </div>
        <span>Always fold</span>
      </div>
    </div>
  )
}
