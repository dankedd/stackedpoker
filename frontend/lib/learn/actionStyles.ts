/**
 * Centralized action -> visual-style mapping, shared by every range grid.
 * The SAME action must mean the SAME color everywhere (spec: no grid may
 * silently reuse another action's color for something else).
 *
 * The four already-shipped colors (raise/jam/limp/fold) are carried over
 * VERBATIM from `PokerRangeGrid`'s previous local `ACTION_COLOR`/`ACTION_LABEL`
 * constants (Module 3's MTT upgrade) — this file only centralizes them so new
 * action ids (call/3bet/4bet/squeeze, for postflop/3-bet modules) get a
 * consistent home instead of being hardcoded per-lesson. `shove` is kept as an
 * alias of `jam` (same naming-collision seam `mttActionToDisplayAction`
 * already bridges in mttRfiRanges.ts).
 */
import type { ActionId } from './rangeStrategy'

export interface ActionStyle {
  label: string
  /** Solid Tailwind background class for a pure/dominant segment. */
  bg: string
  /** Text color class used on top of `bg`. */
  text: string
  /** Small swatch class for legends (may differ slightly from `bg`, e.g. fold's translucent look). */
  swatch: string
}

const FOLD_STYLE: ActionStyle = {
  label: 'Fold',
  bg: 'bg-secondary/40',
  text: 'text-muted-foreground/70',
  swatch: 'bg-secondary/40 border border-border/20',
}

/** Known action ids with a curated color. Anything not listed falls back to
 *  `unknownActionStyle` (a neutral slate) rather than colliding with an
 *  existing action's meaning. */
export const ACTION_STYLES: Record<string, ActionStyle> = {
  raise:   { label: 'Raise',   bg: 'bg-violet-500',      text: 'text-white', swatch: 'bg-violet-500' },
  jam:     { label: 'Jam',     bg: 'bg-red-500/80',      text: 'text-white', swatch: 'bg-red-500/80' },
  shove:   { label: 'Shove',   bg: 'bg-red-500/80',      text: 'text-white', swatch: 'bg-red-500/80' },
  limp:    { label: 'Limp',    bg: 'bg-sky-500/70',      text: 'text-white', swatch: 'bg-sky-500/70' },
  call:    { label: 'Call',    bg: 'bg-emerald-500',     text: 'text-white', swatch: 'bg-emerald-500' },
  '3bet':  { label: '3-Bet',   bg: 'bg-violet-500',      text: 'text-white', swatch: 'bg-violet-500' },
  '4bet':  { label: '4-Bet',  bg: 'bg-fuchsia-500',     text: 'text-white', swatch: 'bg-fuchsia-500' },
  squeeze: { label: 'Squeeze', bg: 'bg-purple-600',      text: 'text-white', swatch: 'bg-purple-600' },
  fold:    FOLD_STYLE,
  // Explicit (not the generic unknown-action fallback) "known-active hand, but the
  // remainder isn't decomposed in this chart" bucket — see rangeStrategy usage in
  // StackDepthRangeMorph.tsx for `defend`/`threebet_defense` datasets: those source
  // charts each track exactly ONE real action (call-only or 3bet-only) and their own
  // provenance comments say so explicitly, so the complement of that one action is
  // NOT "fold" (some of it is the sibling action the chart doesn't track) and must
  // never render with fold's color/label. Deliberately same visual as
  // `UNKNOWN_ACTION_STYLE` below (no new color introduced) — this just gives that
  // meaning a documented, intentional home instead of an implicit fallback.
  other:   { label: 'Other action', bg: 'bg-slate-500/70', text: 'text-white', swatch: 'bg-slate-500/70' },
}

const UNKNOWN_ACTION_STYLE: ActionStyle = {
  label: 'Other action',
  bg: 'bg-slate-500/70',
  text: 'text-white',
  swatch: 'bg-slate-500/70',
}

export function actionStyle(action: ActionId): ActionStyle {
  return ACTION_STYLES[action] ?? UNKNOWN_ACTION_STYLE
}

export function actionLabel(action: ActionId): string {
  return actionStyle(action).label
}

/** Raw color (no Tailwind opacity-modifier syntax) per action, for building an
 *  exact CSS `linear-gradient` — Tailwind's `bg-*` utility classes can't be
 *  read back out as a color value, so the segmented-cell background needs its
 *  own literal-color table kept in lockstep with `ACTION_STYLES` above. */
export const ACTION_CSS_COLOR: Record<string, string> = {
  raise: '#8b5cf6',
  jam: 'rgba(239,68,68,0.8)',
  shove: 'rgba(239,68,68,0.8)',
  limp: 'rgba(14,165,233,0.7)',
  call: '#10b981',
  '3bet': '#8b5cf6',
  '4bet': '#d946ef',
  squeeze: '#9333ea',
  fold: 'rgba(148,163,184,0.35)',
  other: 'rgba(100,116,139,0.7)',
}

const UNKNOWN_CSS_COLOR = 'rgba(100,116,139,0.7)'

export function actionCssColor(action: ActionId): string {
  return ACTION_CSS_COLOR[action] ?? UNKNOWN_CSS_COLOR
}
