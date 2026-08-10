'use client'

import { cn } from '@/lib/utils'
import { RANKS, HAND_GRID, comboCount, TOTAL_COMBOS } from '@/lib/learn/handGrid'
import type { ChartDiffEntry } from '@/lib/learn/mttRfiRanges'
import type { ActionId, RangeSemantics, RangeStrategyMap, StrategyMix } from '@/lib/learn/rangeStrategy'
import { classifyMix, pruneMix, UNSPECIFIED_ACTION } from '@/lib/learn/rangeStrategy'
import { actionCssColor, actionLabel, actionStyle } from '@/lib/learn/actionStyles'
import {
  HAND_BOARD_CATEGORY_LABEL,
  HAND_BOARD_INTERACTION_TIER,
  HAND_BOARD_INTERACTION_TIER_LABEL,
  type HandBoardCategory,
  type HandBoardInteractionTier,
} from '@/lib/learn/handBoardInteraction'

/**
 * 'category' mode palette — THREE layers, never collapsed into two:
 *   1. Out of range              -> dark/disabled, the darkest state on the grid.
 *   2. In range, 'unconnected'   -> a muted slate/blue fill, clearly BRIGHTER than
 *      out-of-range but clearly LESS saturated than any connected tier below. This is the
 *      fix for the "can't tell in-range-but-irrelevant from out-of-range" problem: a hand
 *      can be in the preflop range and still show no meaningful board interaction, and that
 *      must stay visually distinct from simply not being in the range at all.
 *   3. In range, made/connected/marginal -> increasingly saturated color, per
 *      HAND_BOARD_INTERACTION_TIER (handBoardInteraction.ts — the single source of truth,
 *      never redefined here).
 * Every tier also carries its own ring/border style (not color alone), so the distinction
 * survives grayscale/colorblind viewing too.
 *
 * NAMING NOTE: this is a board-INTERACTION tiering, not an Equity Bucket (Strong >=75% /
 * Good 50-<75% / Weak 33-<50% / Trash <33%, see `flopClassifier.ts`'s `equityBucket()`).
 * Neither the tier ids nor these labels use "strong"/"good"/"weak"/"trash" — see
 * handBoardInteraction.ts's `HandBoardInteractionTier` doc comment for why that overlap is
 * deliberately avoided everywhere in this module.
 */
const OUT_OF_RANGE_STYLE = 'bg-secondary/20 text-muted-foreground/15 border border-transparent'

const TIER_STYLE: Record<HandBoardInteractionTier, { bg: string; ring: string }> = {
  unconnected: { bg: 'bg-slate-500/35 text-slate-100/80', ring: 'ring-1 ring-slate-400/25' },
  marginal: { bg: 'bg-amber-500/40 text-amber-50', ring: 'ring-1 ring-amber-300/30' },
  connected: { bg: 'bg-sky-500/60 text-white', ring: 'ring-1 ring-sky-200/40' },
  made: { bg: 'bg-emerald-500/80 text-white', ring: 'ring-1 ring-emerald-200/60' },
}

/** Draws get a dashed ring instead of their tier's default solid one — a made hand and a
 *  draw can share a tier's color (both 'connected', say) but must never look identical. */
const DASHED_RING_CATEGORIES: HandBoardCategory[] = ['straight_draw']

/**
 * How often a hand actually takes the range-defining action (raise/call), NOT how strongly
 * it connects with the board — a separate axis from `HandBoardInteractionTier` above. Reuses
 * the exact same "diagonal hatch over a solid fill" technique `RangeXRay.tsx` already uses to
 * mark "direction known, exact number not claimed" data, so a learner who's seen one place in
 * this module already knows what hatching means in the other.
 *   - 'pure'  -> the hand takes this action essentially every time (>= 99%). No overlay.
 *   - 'mixed' -> a genuine mixed strategy (roughly 30-99%). Light hatch.
 *   - 'low'   -> the hand mostly does something else and only occasionally takes this action
 *     (< 30%, e.g. AA calling 20% of the time because it mostly 3-bets instead). Denser hatch
 *     + reduced fill opacity, so it reads as clearly less common than 'mixed' at a glance.
 * A hand with no entry in `frequencyMap` (or when `frequencyMap` is omitted entirely) is
 * treated as 'pure' — the historical, unchanged behavior for every existing caller.
 */
export type FrequencyTier = 'pure' | 'mixed' | 'low'

export function frequencyTier(freq: number): FrequencyTier {
  if (freq >= 0.99) return 'pure'
  if (freq >= 0.3) return 'mixed'
  return 'low'
}

const FREQUENCY_HATCH: Record<Exclude<FrequencyTier, 'pure'>, string> = {
  mixed: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.28) 3px, rgba(0,0,0,0.28) 6px)',
  low: 'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)',
}

const FREQUENCY_TIER_LABEL: Record<FrequencyTier, string> = {
  pure: 'Always',
  mixed: 'Mixed strategy',
  low: 'Low frequency',
}

function categoryCellStyle(category: HandBoardCategory): { bg: string; ring: string } {
  const tier = HAND_BOARD_INTERACTION_TIER[category]
  const base = TIER_STYLE[tier]
  if (DASHED_RING_CATEGORIES.includes(category)) {
    return { bg: base.bg, ring: base.ring.replace('ring-1', 'ring-1 ring-dashed') }
  }
  return base
}

type PreflopAction = 'raise' | 'limp' | 'shove' | 'fold'

/** Preferred left-to-right segment order so every cell (and the legend) orders
 *  actions the same way across the whole grid — aggression first, fold last.
 *  Any action id not in this list falls in afterward, in first-seen order. */
const ACTION_PRIORITY = ['4bet', '3bet', 'squeeze', 'raise', 'jam', 'shove', 'limp', 'call', 'fold', UNSPECIFIED_ACTION]

/** Stable, grid-wide action order derived from every mix actually present —
 *  so a hand's segments (and the shared legend) are always ordered the same
 *  way no matter which hands happen to be mixed. */
function resolveActionOrder(strategies: RangeStrategyMap, absentAction: ActionId, explicit?: ActionId[]): ActionId[] {
  if (explicit && explicit.length > 0) return explicit
  // `absentAction` (fold for complete/binary sources, `other` for an action
  // slice — see `strategyAbsentMix`) is always a possible implicit action, so
  // it's always part of the order even when every explicit mix omits it.
  const seen = new Set<ActionId>([absentAction])
  for (const mix of Object.values(strategies)) {
    for (const action of Object.keys(mix)) seen.add(action)
  }
  const prioritized = ACTION_PRIORITY.filter((a) => seen.has(a))
  const rest = [...seen].filter((a) => !ACTION_PRIORITY.includes(a))
  return [...prioritized, ...rest]
}

/** Builds a hard-stop `linear-gradient` so segment widths are exactly
 *  proportional to frequency — no gradients/blur at the boundary, per spec
 *  ("a clean left-to-right split", never an ambiguous fade). */
function segmentedBackground(mix: StrategyMix, order: ActionId[]): string {
  const pruned = pruneMix(mix)
  const total = Object.values(pruned).reduce((s, f) => s + f, 0)
  if (total <= 1e-9) return actionCssColor('fold')
  let cumulative = 0
  const stops: string[] = []
  for (const action of order) {
    const freq = pruned[action]
    if (!freq) continue
    const color = actionCssColor(action)
    const start = (cumulative / total) * 100
    cumulative += freq
    const end = (cumulative / total) * 100
    stops.push(`${color} ${start}%`, `${color} ${end}%`)
  }
  if (stops.length === 0) return actionCssColor('fold')
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** Exact-percentage breakdown text for hover (title) / tap (detail bubble),
 *  descending by frequency — "Call 72%, Fold 28%". */
function formatMixBreakdown(mix: StrategyMix, order: ActionId[]): string {
  const pruned = pruneMix(mix)
  return order
    .filter((a) => pruned[a] != null)
    .map((a) => `${actionLabel(a)} ${Math.round(pruned[a] * 100)}%`)
    .join(', ')
}

const ACTION_DIFF_COLOR: Record<ChartDiffEntry['kind'], string> = {
  added: 'bg-emerald-500/70 text-white',
  removed: 'bg-red-500/60 text-white',
  changed: 'bg-amber-500/60 text-white',
  unchanged: 'bg-secondary/30 text-muted-foreground/15',
}

const ACTION_DIFF_LABEL: Record<ChartDiffEntry['kind'], string> = {
  added: 'Added (fold -> in)',
  removed: 'Removed (in -> fold)',
  changed: 'Action changed',
  unchanged: 'Unchanged',
}

const ACTION_COLOR: Record<PreflopAction, string> = {
  raise: 'bg-violet-500 text-white',
  shove: 'bg-red-500/80 text-white',
  limp: 'bg-sky-500/70 text-white',
  fold: 'bg-secondary/40 text-muted-foreground/30',
}

const ACTION_LABEL: Record<PreflopAction, string> = {
  raise: 'Raise',
  shove: 'Shove',
  limp: 'Limp',
  fold: 'Fold',
}

interface PokerRangeGridProps {
  /** Hand notations included in the range, e.g. ['AA', 'KQs', 'JTs']. In 'diff' mode, this is the BASELINE range. */
  range: string[]
  className?: string
  /** 'membership' (default) = binary in/out. 'three_action' = color by actionMap.
   *  'diff' = compare `range` (baseline) against `comparisonRange` (learner/example), boolean membership only.
   *  'action_diff' = compare two MttRfiCharts' dominant actions via `actionDiff` (added/removed/changed/unchanged).
   *  'strategy' = the canonical mixed-frequency renderer: each cell is a proportional left-to-right
   *  split of every action in that hand's `strategies[hand]` mix (see rangeStrategy.ts), rather than
   *  collapsing to one dominant color. Use this for any AUTHORITATIVE reveal of a real strategy —
   *  superseded the old opacity-shaded 'frequency' mode, which only supported one action's frequency
   *  and had no exact-percentage hover/tap detail.
   *  'category' = colors each in-range hand by its live hand-vs-board classification (Module 8's
   *  Range Collision Viewer — see `categoryMap`/`handBoardInteraction.ts`). Never an equity gradient —
   *  a discrete category per cell, with both color AND ring-style distinguishing tiers. */
  mode?: 'membership' | 'three_action' | 'diff' | 'action_diff' | 'strategy' | 'category'
  /** 'category' mode: hand -> its live classification against the current board (see
   *  `classifyRangeVsBoard` in handBoardInteraction.ts). A hand absent from this map, or not in
   *  `range`, renders as plain out-of-range/'none' styling. */
  categoryMap?: Record<string, HandBoardCategory>
  /** 'category' mode: which categories to visually call out via the legend — defaults to every
   *  category actually present in `categoryMap`. */
  categoryLegend?: HandBoardCategory[]
  /** 'category' mode (optional): real per-hand action frequency (0-1) for hands in `range` —
   *  see `frequencyTier`'s doc comment. A hand present in `range` but absent here (or when this
   *  whole prop is omitted) renders as 'pure', identical to today's behavior. Never a mode of
   *  its own — this only ever adds shading on top of 'category' mode's existing board-interaction
   *  coloring, so a mixed-frequency hand's category color is still fully visible underneath. */
  frequencyMap?: Record<string, number>
  /** 'three_action' mode: which action each hand takes. */
  actionMap?: Record<string, PreflopAction>
  /** 'diff' mode: the range being compared against the baseline (`range`). */
  comparisonRange?: string[]
  /** 'action_diff' mode: precomputed per-hand diff (see mttRfiRanges.ts#computeChartDiff). */
  actionDiff?: ChartDiffEntry[]
  /** 'strategy' mode: hand -> full action-frequency mix (see rangeStrategy.ts). A hand absent from
   *  this map renders using `strategySemantics`' own absent-hand default — see below. */
  strategies?: RangeStrategyMap
  /** 'strategy' mode: what `strategies` actually proves (see `RangeSemantics` in rangeStrategy.ts).
   *  Governs the ONLY thing that's genuinely ambiguous about a hand absent from `strategies` —
   *  HAND_GRID always renders all 169 hand classes regardless of `strategies`' coverage, so an
   *  absent hand needs a well-defined fallback. `complete_strategy`/`binary` sources may safely
   *  default an absent hand to 100% fold (matching the historical sparse-chart convention: an
   *  RFI chart that omits 72o really does mean "72o folds"). `action_slice` sources must NEVER do
   *  this — an absent hand there means "0% of the one tracked action," which is not proof of fold.
   *  Defaults to `{ kind: 'complete_strategy' }` (i.e. the historical fold-default) when omitted,
   *  so existing complete-strategy callers (MTT RFI charts, etc.) are unaffected. */
  strategySemantics?: RangeSemantics
  /** 'strategy' mode: explicit left-to-right action order (defaults to a stable aggression-first
   *  order derived from every action actually present in `strategies`). */
  strategyActionOrder?: ActionId[]
  /** Rings the given cell(s) (e.g. the just-tested hand, or every hand seen across a lesson's
   *  puzzles) without touching their existing color. A single string keeps the historical
   *  one-hand behavior; an array rings every hand it contains. */
  highlightHand?: string | string[]
  /** 'standard' (default) = a solo grid's own comfortable cap (520px) — never sprawls to
   *  fill an oversized ancestor container. 'compact' = one half of a two-grid comparison
   *  (480px) — sized so two of them plus a realistic gap fit inside the widened lesson
   *  container's actual content width. Either way this is a MAX-width, not a fixed width:
   *  it only ever shrinks what an oversized parent offers, never forces overflow into a
   *  smaller one — see PokerRangeGrid's own outer wrapper below. */
  size?: 'standard' | 'compact'
}

const SIZE_MAX_WIDTH: Record<'standard' | 'compact', string> = {
  standard: 'max-w-[520px]',
  compact: 'max-w-[480px]',
}

// ── Legend styling — ONE definition, reused by every mode's legend block
// below (membership/three_action/diff/action_diff/strategy/category), so
// every Range Grid across the whole platform stays visually consistent and a
// future readability tweak only ever needs one edit here, never a per-mode
// or per-module override. Sizes/spacing only — swatch colors, hatch
// patterns, and every existing className driving them are untouched.
const LEGEND_CONTAINER = 'flex flex-wrap items-center justify-center gap-x-4 gap-y-2'
const LEGEND_ITEM = 'flex items-center gap-2'
const LEGEND_SWATCH = 'h-3.5 w-3.5 rounded-[3px] shrink-0'
const LEGEND_TEXT = 'text-[13px] text-muted-foreground/60'

/** Read-only 13x13 range-grid display — membership, frequency-shaded, 3-4 action colored, a
 *  baseline-vs-comparison diff, or a two-chart action-level diff. */
export function PokerRangeGrid({
  range,
  className,
  mode = 'membership',
  actionMap,
  comparisonRange,
  actionDiff,
  strategies,
  strategyActionOrder,
  strategySemantics = { kind: 'complete_strategy' },
  highlightHand,
  categoryMap,
  categoryLegend,
  frequencyMap,
  size = 'standard',
}: PokerRangeGridProps) {
  const inRange = new Set(range)
  const inComparison = new Set(comparisonRange ?? [])
  const highlightedHands = new Set(
    highlightHand == null ? [] : Array.isArray(highlightHand) ? highlightHand : [highlightHand],
  )
  const combos = range.reduce((sum, h) => sum + comboCount(h), 0)
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1)
  const diffByHand = new Map((actionDiff ?? []).map((d) => [d.hand, d]))
  // The ONLY safe default for a hand HAND_GRID renders but `strategies` doesn't
  // cover. 'action_slice' sources never get to claim fold here — see the prop doc.
  const strategyAbsentMix: StrategyMix =
    strategySemantics.kind === 'action_slice' ? { [UNSPECIFIED_ACTION]: 1 } : { fold: 1 }
  const strategyOrder =
    mode === 'strategy' ? resolveActionOrder(strategies ?? {}, Object.keys(strategyAbsentMix)[0], strategyActionOrder) : []
  // 'category' mode legend: which interaction tiers are actually worth explaining right now —
  // every tier present among the range's real categories, unioned with whatever this specific
  // lesson step asked to emphasize (`categoryLegend`), so the legend never shows a tier with
  // zero cells on the current board while still guaranteeing an authored emphasis always appears.
  const presentCategoryTiers =
    mode === 'category'
      ? Array.from(
          new Set(
            [...Object.values(categoryMap ?? {}), ...(categoryLegend ?? [])].map(
              (c) => HAND_BOARD_INTERACTION_TIER[c],
            ),
          ),
        ).filter((t): t is Exclude<HandBoardInteractionTier, 'unconnected'> => t !== 'unconnected')
      : []
  const TIER_LEGEND_ORDER: Exclude<HandBoardInteractionTier, 'unconnected'>[] = ['made', 'connected', 'marginal']
  // Which frequency tiers actually appear among this grid's in-range hands right now — so the
  // legend only ever mentions "Mixed strategy" / "Low frequency" when at least one visible cell
  // uses that shading, and stays silent (identical to pre-frequencyMap behavior) otherwise.
  const presentFrequencyTiers =
    mode === 'category' && frequencyMap
      ? new Set(range.map((h) => frequencyTier(frequencyMap[h] ?? 1)).filter((t) => t !== 'pure'))
      : new Set<FrequencyTier>()

  function cellClasses(hand: string, isPair: boolean, isSuited: boolean): string {
    if (mode === 'action_diff') {
      const entry = diffByHand.get(hand)
      return entry ? ACTION_DIFF_COLOR[entry.kind] : ACTION_DIFF_COLOR.unchanged
    }

    if (mode === 'three_action' && actionMap) {
      const action = actionMap[hand]
      return action ? ACTION_COLOR[action] : 'bg-secondary/30 text-muted-foreground/15'
    }

    if (mode === 'diff') {
      const inBase = inRange.has(hand)
      const inComp = inComparison.has(hand)
      if (inBase && inComp) return 'bg-emerald-500/70 text-white' // correctly included
      if (inBase && !inComp) return 'bg-amber-500/60 text-white' // missed
      if (!inBase && inComp) return 'bg-red-500/60 text-white' // too-wide
      return isPair
        ? 'bg-secondary/70 text-muted-foreground/30'
        : isSuited
        ? 'bg-secondary/50 text-muted-foreground/20'
        : 'bg-secondary/30 text-muted-foreground/15'
    }

    // 'membership' (default)
    const included = inRange.has(hand)
    return included
      ? isPair
        ? 'bg-violet-500 text-white shadow-sm shadow-violet-500/40'
        : isSuited
        ? 'bg-violet-600/80 text-white'
        : 'bg-violet-500/60 text-white'
      : isPair
      ? 'bg-secondary/70 text-muted-foreground/30'
      : isSuited
      ? 'bg-secondary/50 text-muted-foreground/20'
      : 'bg-secondary/30 text-muted-foreground/15'
  }

  return (
    // Outer cap — a genuine max-width, so a lone grid (or one half of a stacked-on-mobile
    // comparison) can never sprawl to fill an oversized ancestor container, no matter how
    // wide the lesson container itself gets for a given step type. `mx-auto` centers it
    // whenever the cap actually binds; it's a no-op once the parent is already narrower.
    <div className={cn('mx-auto w-full', SIZE_MAX_WIDTH[size])}>
    <div className={cn('space-y-3 w-full min-w-0', className)}>
      {/* No horizontal scroll container here on purpose — the whole 13x13 matrix must always
       *  be visible without scrolling or clipped columns. `min-w-0` on this block (and every
       *  flex row/cell inside it) is what lets the grid actually shrink to whatever width its
       *  parent gives it instead of overflowing: a plain flex child defaults to
       *  `min-width: auto`, which floors its shrink at the content's natural (min-content)
       *  width — for a 13-column hand grid with non-wrapping cell text, that floor is wider
       *  than most comparison layouts, which is exactly what forced the old
       *  `overflow-x-auto` + `inline-block` wrapper into a scrollbar instead of a fit. */}
      <div className="w-full min-w-0">
        {/* Column headers. `gap-px` (not per-cell `m-px` margins) keeps the same hairline
         *  spacing while costing roughly half the horizontal space at the narrowest
         *  supported widths — 12 gaps of 1px instead of 13 cells x 2px of margin. */}
        <div className="flex gap-px ml-5 mb-0.5">
          {RANKS.map((r) => (
            <div
              key={r}
              className="flex-1 min-w-0 text-center text-[8px] sm:text-[10px] font-bold text-muted-foreground/40 leading-none"
            >
              {r}
            </div>
          ))}
        </div>

        {/* Rows */}
        {HAND_GRID.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-px">
            <div className="w-5 text-[8px] sm:text-[10px] font-bold text-muted-foreground/40 text-center shrink-0">
              {RANKS[rowIdx]}
            </div>
            {row.map((hand, colIdx) => {
              const isPair = rowIdx === colIdx
              const isSuited = rowIdx < colIdx

              if (mode === 'category') {
                // LAYER 1 (range membership) is checked first and independently of LAYER 2/3
                // (board interaction) — an in-range hand ALWAYS gets in-range styling, even
                // when its category is 'none'/'overcards' (no meaningful board interaction).
                // Board interaction only ever adds emphasis on top of range membership; it
                // never demotes an in-range hand down to the out-of-range style.
                const inR = inRange.has(hand)
                const category: HandBoardCategory = categoryMap?.[hand] ?? 'none'
                const tier = HAND_BOARD_INTERACTION_TIER[category]
                const style = inR ? categoryCellStyle(category) : undefined
                const tierLabel = HAND_BOARD_INTERACTION_TIER_LABEL[tier]
                const categoryLabel = HAND_BOARD_CATEGORY_LABEL[category]
                const freq = frequencyMap?.[hand] ?? 1
                const freqTier: FrequencyTier = inR ? frequencyTier(freq) : 'pure'
                const freqPct = Math.round(freq * 100)
                const preflopLine =
                  !inR
                    ? 'Not in range'
                    : freqTier === 'pure'
                    ? 'In range'
                    : `In range — ${FREQUENCY_TIER_LABEL[freqTier].toLowerCase()} (${freqPct}%)`

                return (
                  <div
                    key={colIdx}
                    tabIndex={0}
                    role="group"
                    aria-label={
                      inR
                        ? `${hand}: in range, ${categoryLabel.toLowerCase()}${freqTier !== 'pure' ? `, ${FREQUENCY_TIER_LABEL[freqTier].toLowerCase()} ${freqPct}%` : ''}`
                        : `${hand}: not in range`
                    }
                    title={inR ? `${hand} — In range — ${categoryLabel}${freqTier !== 'pure' ? ` (${freqPct}%)` : ''}` : `${hand} — Not in range`}
                    className={cn(
                      'group relative flex-1 min-w-0 aspect-square flex items-center justify-center',
                      'rounded-[3px] select-none text-[8px] sm:text-[10px] font-bold leading-none cursor-default',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:z-20',
                      inR ? style!.bg : OUT_OF_RANGE_STYLE,
                      inR && style!.ring,
                      inR && freqTier === 'low' && 'opacity-75',
                      highlightedHands.has(hand) && 'ring-2 ring-white ring-offset-1 ring-offset-background z-10 relative',
                    )}
                    style={inR && freqTier !== 'pure' ? { backgroundImage: FREQUENCY_HATCH[freqTier] } : undefined}
                  >
                    <span className="truncate px-0.5">{hand}</span>
                    {/* Hover/focus/tap detail — always in the DOM, shown via CSS only, present
                        for EVERY cell (in-range or not) so "why is this dark?" always has an
                        answer instead of only the in-range cells getting a rich tooltip. */}
                    <div
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 w-max max-w-[10rem] -translate-x-1/2',
                        'rounded-md border border-border/30 bg-popover px-2 py-1 text-left text-[9px] font-medium leading-tight text-popover-foreground shadow-lg',
                        'opacity-0 scale-95 transition-all duration-100',
                        'group-hover:opacity-100 group-hover:scale-100 group-focus:opacity-100 group-focus:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100',
                      )}
                    >
                      <p className="font-bold">{hand}</p>
                      <p className="text-muted-foreground">Preflop: {preflopLine}</p>
                      {inR && <p className="text-muted-foreground">Board: {categoryLabel}{tier !== 'unconnected' ? ` (${tierLabel})` : ''}</p>}
                    </div>
                  </div>
                )
              }

              if (mode === 'strategy') {
                const mix = strategies?.[hand] ?? strategyAbsentMix
                const breakdown = formatMixBreakdown(mix, strategyOrder)
                const mixInfo = classifyMix(mix, actionLabel)

                return (
                  <div
                    key={colIdx}
                    tabIndex={0}
                    role="group"
                    aria-label={`${hand}: ${breakdown}`}
                    title={`${hand}\n${breakdown}`}
                    className={cn(
                      'group relative flex-1 min-w-0 aspect-square flex items-center justify-center',
                      'rounded-[3px] select-none text-[8px] sm:text-[10px] font-bold leading-none cursor-default',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:z-20',
                      highlightedHands.has(hand) && 'ring-2 ring-white ring-offset-1 ring-offset-background z-10 relative',
                    )}
                    style={{ background: segmentedBackground(mix, strategyOrder) }}
                  >
                    <span className="relative z-10 truncate rounded-sm bg-black/30 px-0.5 text-white drop-shadow-sm">
                      {hand}
                    </span>
                    {/* Hover/focus/tap detail — always in the DOM (SSR/testable), shown via CSS only. */}
                    <div
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute bottom-full z-30 mb-1 w-max max-w-[9rem]',
                        // Anchored by column, not always centred. This tooltip
                        // is always in the DOM and merely faded out, so a
                        // centred one on an edge column adds ~70px of scroll
                        // width to the PAGE even though nothing is visible —
                        // which is exactly how a phone ends up able to swipe
                        // sideways on a lesson. Edge columns hang inward
                        // instead; the middle of the grid is unchanged.
                        colIdx <= 2
                          ? 'left-0'
                          : colIdx >= RANKS.length - 3
                          ? 'right-0'
                          : 'left-1/2 -translate-x-1/2',
                        'rounded-md border border-border/30 bg-popover px-2 py-1 text-left text-[9px] font-medium leading-tight text-popover-foreground shadow-lg',
                        'opacity-0 scale-95 transition-all duration-100',
                        'group-hover:opacity-100 group-hover:scale-100 group-focus:opacity-100 group-focus:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100',
                      )}
                    >
                      <p className="font-bold">{hand} — {mixInfo.label}</p>
                      <p className="text-muted-foreground">{breakdown}</p>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={colIdx}
                  className={cn(
                    'flex-1 min-w-0 aspect-square flex items-center justify-center',
                    'rounded-[3px] select-none text-[8px] sm:text-[10px] font-bold leading-none',
                    cellClasses(hand, isPair, isSuited),
                    highlightHand === hand && 'ring-2 ring-white ring-offset-1 ring-offset-background z-10 relative',
                  )}
                >
                  <span className="truncate px-0.5">{hand}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend / stats — sizing/spacing centralized above (LEGEND_*); each
          mode below only ever supplies its own colors/labels/hatch patterns. */}
      {mode === 'category' ? (
        <div className={cn(LEGEND_CONTAINER, 'pt-1', LEGEND_TEXT)}>
          <div className={LEGEND_ITEM}>
            <div className={cn(LEGEND_SWATCH, OUT_OF_RANGE_STYLE)} />
            <span>Not in range</span>
          </div>
          <div className={LEGEND_ITEM}>
            <div className={cn(LEGEND_SWATCH, TIER_STYLE.unconnected.bg)} />
            <span>In range</span>
          </div>
          {TIER_LEGEND_ORDER.filter((t) => presentCategoryTiers.includes(t)).map((tier) => (
            <div key={tier} className={LEGEND_ITEM}>
              <div className={cn(LEGEND_SWATCH, TIER_STYLE[tier].bg)} />
              <span>{HAND_BOARD_INTERACTION_TIER_LABEL[tier]}</span>
            </div>
          ))}
          {(['mixed', 'low'] as const)
            .filter((t) => presentFrequencyTiers.has(t))
            .map((t) => (
              <div key={t} className={LEGEND_ITEM}>
                <div
                  className={cn(LEGEND_SWATCH, TIER_STYLE.unconnected.bg, t === 'low' && 'opacity-75')}
                  style={{ backgroundImage: FREQUENCY_HATCH[t] }}
                />
                <span>{FREQUENCY_TIER_LABEL[t]} (hatched)</span>
              </div>
            ))}
        </div>
      ) : mode === 'strategy' ? (
        <div className={cn(LEGEND_CONTAINER, 'pt-1', LEGEND_TEXT)}>
          {strategyOrder.map((a) => (
            <div key={a} className={LEGEND_ITEM}>
              <div className={cn(LEGEND_SWATCH, actionStyle(a).swatch)} />
              <span>{actionLabel(a)}</span>
            </div>
          ))}
        </div>
      ) : mode === 'three_action' && actionMap ? (
        <div className={cn(LEGEND_CONTAINER, 'pt-1', LEGEND_TEXT)}>
          {(['raise', 'limp', 'shove', 'fold'] as PreflopAction[])
            .filter((a) => Object.values(actionMap).includes(a))
            .map((a) => (
              <div key={a} className={LEGEND_ITEM}>
                <div className={cn(LEGEND_SWATCH, ACTION_COLOR[a])} />
                <span>{ACTION_LABEL[a]}</span>
              </div>
            ))}
        </div>
      ) : mode === 'diff' ? (
        <div className={cn(LEGEND_CONTAINER, 'pt-1', LEGEND_TEXT)}>
          <div className={LEGEND_ITEM}>
            <div className={cn(LEGEND_SWATCH, 'bg-emerald-500/70')} />
            <span>Correctly included</span>
          </div>
          <div className={LEGEND_ITEM}>
            <div className={cn(LEGEND_SWATCH, 'bg-amber-500/60')} />
            <span>Missed</span>
          </div>
          <div className={LEGEND_ITEM}>
            <div className={cn(LEGEND_SWATCH, 'bg-red-500/60')} />
            <span>Too wide</span>
          </div>
        </div>
      ) : mode === 'action_diff' ? (
        <div className={cn(LEGEND_CONTAINER, 'pt-1', LEGEND_TEXT)}>
          {(['added', 'changed', 'removed'] as ChartDiffEntry['kind'][]).map((kind) => (
            <div key={kind} className={LEGEND_ITEM}>
              <div className={cn(LEGEND_SWATCH, ACTION_DIFF_COLOR[kind])} />
              <span>{ACTION_DIFF_LABEL[kind]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1', LEGEND_TEXT)}>
          <div className={LEGEND_ITEM}>
            <div className={cn(LEGEND_SWATCH, 'bg-violet-500')} />
            <span>In range</span>
          </div>
          <span>
            {combos} combos <span className="text-muted-foreground/45">({pct}% of all hands)</span>
          </span>
        </div>
      )}
    </div>
    </div>
  )
}
