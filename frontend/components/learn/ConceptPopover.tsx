'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpen, X, ArrowRight, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Static concept data (inline, no API needed) ───────────────────────────────

interface ConceptEntry {
  id: string
  title: string
  summary: string
  formula?: string
  example?: string
  related?: string[]
  domain: string
}

const CONCEPT_DATA: Record<string, ConceptEntry> = {
  pot_odds: {
    id: 'pot_odds',
    title: 'Pot Odds',
    domain: 'math',
    summary: 'The minimum equity your hand needs to make a call profitable.',
    formula: 'equity_needed = call ÷ (pot + call)',
    example: 'Facing 10bb into 20bb pot: 10 ÷ 30 = 33% equity needed.',
    related: ['mdf', 'equity_real'],
  },
  mdf: {
    id: 'mdf',
    title: 'Minimum Defense Frequency',
    domain: 'game_theory',
    summary: 'The fraction of your range you must defend to prevent profitable any-two-card bluffs.',
    formula: 'MDF = pot ÷ (pot + bet)  =  1 − alpha',
    example: 'Facing a half-pot bet: pot/(pot+0.5pot) = 67% — you must defend 67% of your range.',
    related: ['alpha', 'indifference', 'exploit'],
  },
  alpha: {
    id: 'alpha',
    title: 'Alpha (Required Fold %)',
    domain: 'game_theory',
    summary: 'The fold frequency a bluff needs to break even. Complement of MDF.',
    formula: 'alpha = bet ÷ (pot + bet)',
    example: 'Half-pot bet: 0.5 ÷ 1.5 = 33% — villain must fold 33% for the bluff to print.',
    related: ['mdf', 'bluff_basics'],
  },
  spr_theory: {
    id: 'spr_theory',
    title: 'Stack-to-Pot Ratio',
    domain: 'math',
    summary: 'SPR determines which hand types (draws vs. made hands) gain or lose value. Low SPR = commit with top pair.',
    formula: 'SPR = effective_stack ÷ pot',
    example: 'SPR 2: top pair should be committed. SPR 12: top pair may need to fold multi-street pressure.',
    related: ['equity_real', 'value_betting'],
  },
  position_value: {
    id: 'position_value',
    title: 'Position Value',
    domain: 'fundamentals',
    summary: 'Acting last gives you full information before deciding, boosting equity realization by ~8–12%.',
    formula: 'IP equity realization ≈ 55% of pot EV (symmetric ranges)',
    example: 'BTN vs BB: BTN opens 40–50% of hands because position makes marginal hands profitable.',
    related: ['range_advantage', 'cbet_theory'],
  },
  range_advantage: {
    id: 'range_advantage',
    title: 'Range Advantage',
    domain: 'ranges',
    summary: "When your entire range has higher average equity than villain's, enabling merged high-frequency small bets.",
    formula: 'Range equity = avg(hero equity for each combo vs. villain range)',
    example: 'PFR on A72r has strong range advantage → frequent small c-bets.',
    related: ['nut_advantage', 'cbet_theory', 'board_texture'],
  },
  nut_advantage: {
    id: 'nut_advantage',
    title: 'Nut Advantage',
    domain: 'ranges',
    summary: 'Holding a disproportionate share of the strongest hands, enabling polarized overbets.',
    formula: 'Nut combos (hero) > Nut combos (villain) on this board',
    example: 'BTN holds far more sets and top-two on A72r vs BB → can overbet river.',
    related: ['polarized', 'blockers'],
  },
  bluff_basics: {
    id: 'bluff_basics',
    title: 'Bluff Fundamentals',
    domain: 'strategy',
    summary: 'A bluff is only profitable if villain folds more than alpha% of the time.',
    formula: 'Bluff EV = (fold% × pot) − (call% × bet)',
    example: 'Half-pot bluff needs 33% fold equity. If villain folds 40%, the bluff is profitable.',
    related: ['alpha', 'bluff_value_ratio'],
  },
  value_betting: {
    id: 'value_betting',
    title: 'Value Betting',
    domain: 'strategy',
    summary: "Bet when ahead of villain's calling range. Size to extract maximum chips from worse hands.",
    formula: 'Value EV = call% × (win amount) − fold% × 0',
    example: 'Thin value: bet 33% pot to get called by worse hands that fold to larger sizing.',
    related: ['bluff_value_ratio', 'spr_theory'],
  },
  cbet_theory: {
    id: 'cbet_theory',
    title: 'Continuation Betting',
    domain: 'strategy',
    summary: 'PFR bets the flop. Use small merged sizing on boards with range advantage; polarized larger sizing where contested.',
    formula: 'Frequency ↑ when range EV advantage > 5%; Size ↑ when nut advantage present',
    example: 'A72r (PFR advantage) → 33% pot c-bet at 70%+ frequency. T98 (contested) → 66% at 40% frequency.',
    related: ['range_advantage', 'board_texture'],
  },
  blockers: {
    id: 'blockers',
    title: 'Blocker Effects',
    domain: 'advanced',
    summary: "Cards in your hand reduce villain's combinations of specific hands, affecting bluff selection and calls.",
    formula: 'Blocker impact ∝ (combos removed ÷ total villain combos)',
    example: "Holding A♠ blocks villain's nut flush — ideal bluff card on monotone board.",
    related: ['polarized', 'nut_advantage'],
  },
  equity_real: {
    id: 'equity_real',
    title: 'Equity Realization',
    domain: 'strategy',
    summary: 'The fraction of your theoretical equity you actually capture in a hand. Position boosts it; OOP compresses it.',
    formula: 'Realized EV = raw equity × realization factor',
    example: 'IP with suited connectors may realize 110% of equity. OOP with the same hand, 80%.',
    related: ['spr_theory', 'position_value'],
  },
  polarized: {
    id: 'polarized',
    title: 'Polarized vs Merged',
    domain: 'advanced',
    summary: 'Polarized = only nuts and bluffs, large sizing. Merged = wide middle-strength range, small sizing.',
    formula: 'Polarized: bet size → large (75%–200% pot). Merged: bet size → small (25–50% pot)',
    example: 'River nut flush + air → polarized overbet. Flop range advantage → merged 33% cbet.',
    related: ['nut_advantage', 'bluff_value_ratio'],
  },
  geometric_sizing: {
    id: 'geometric_sizing',
    title: 'Geometric Sizing',
    domain: 'advanced',
    summary: 'Size bets so the pot grows at a constant ratio each street, committing stacks by river.',
    formula: 'bet_fraction = (SPR + 1)^(1/streets_remaining) − 1',
    example: 'SPR 8, 2 streets: each bet ≈ 66% pot → commits stacks by river in 2 bets.',
    related: ['spr_theory', 'polarized'],
  },
  hand_ranges: {
    id: 'hand_ranges',
    title: 'Hand Ranges',
    domain: 'ranges',
    summary: 'The complete set of hands a player could hold in context. All decisions are made against ranges, not specific hands.',
    formula: 'Range% = selected combos ÷ 1326 total combos',
    example: 'UTG opens 14% = ~186 combos. BTN opens 45% = ~597 combos.',
    related: ['range_advantage', 'equity_real'],
  },
  board_texture: {
    id: 'board_texture',
    title: 'Board Texture',
    domain: 'postflop',
    summary: 'Board characteristics determine who has range advantage and what betting strategy applies.',
    formula: 'Texture score = connectivity + suitedness + high-card density (qualitative)',
    example: "A72r = dry, favors PFR. T98s = wet, favors caller's suited connectors.",
    related: ['range_advantage', 'cbet_theory'],
  },
  bluff_value_ratio: {
    id: 'bluff_value_ratio',
    title: 'Bluff:Value Ratio',
    domain: 'strategy',
    summary: 'At equilibrium, your bluff frequency must equal alpha to make villain indifferent to calling.',
    formula: 'bluffs ÷ (bluffs + value) = alpha = bet ÷ (pot + bet)',
    example: 'Pot-sized bet: alpha = 50% → 1 bluff per 1 value combo. Half-pot: alpha = 33% → 1 bluff per 2 value.',
    related: ['alpha', 'indifference', 'polarized'],
  },
  indifference: {
    id: 'indifference',
    title: 'Indifference Principle',
    domain: 'game_theory',
    summary: 'At equilibrium, mixed-strategy hands yield equal EV for all actions — your bet frequency makes villain exactly indifferent.',
    formula: 'At equilibrium: EV(call) = EV(fold) for any bluffcatcher',
    example: 'Pot bet: villain must call exactly 50% for you to be indifferent to bluffing.',
    related: ['mdf', 'nash_equilibrium', 'bluff_value_ratio'],
  },
  nash_equilibrium: {
    id: 'nash_equilibrium',
    title: 'Nash Equilibrium',
    domain: 'game_theory',
    summary: 'A strategy pair where neither player can improve EV by unilaterally changing actions — the foundation of GTO.',
    formula: 'No exploitable deviation exists for either player',
    related: ['indifference', 'exploit'],
  },
  exploit: {
    id: 'exploit',
    title: 'Exploitative Play',
    domain: 'strategy',
    summary: 'Deliberately deviating from GTO to maximise EV against a specific opponent leak.',
    formula: 'Exploit EV = GTO_EV + (deviation × villain_leak_magnitude)',
    example: 'Villain folds 70% to river bets: bluff any two cards (alpha only needs 50%).',
    related: ['mdf', 'nash_equilibrium'],
  },

  // ── Lesson 1: Think Like a Poker Player ──────────────────────────────────
  table_position: {
    id: 'table_position',
    title: 'Table Position',
    domain: 'fundamentals',
    summary: 'Your seat relative to the button determines when you act and how much information you have before deciding.',
    example: '9-max order: UTG → UTG+1 → UTG+2 → LJ → HJ → CO → BTN → SB → BB.',
    related: ['relative_position', 'ip_oop'],
  },
  relative_position: {
    id: 'relative_position',
    title: 'Relative Position',
    domain: 'fundamentals',
    summary: 'Position is not absolute — it depends on who you are up against in the hand.',
    example: 'CO is in position vs UTG, but out of position vs BTN.',
    related: ['table_position', 'ip_oop'],
  },
  ip_oop: {
    id: 'ip_oop',
    title: 'In Position / Out of Position',
    domain: 'fundamentals',
    summary: 'IP means you act after your opponent; OOP means you act before them. The player acting last sees more information.',
    example: 'BTN vs BB: BTN is IP for the entire postflop sequence.',
    related: ['table_position', 'relative_position'],
  },
  poker_terminology: {
    id: 'poker_terminology',
    title: 'Poker Terminology',
    domain: 'fundamentals',
    summary: 'The shared vocabulary — RFI, 3-bet, squeeze, c-bet — that lets you read strategy content and hand histories quickly.',
    related: ['rfi', 'action_lines'],
  },
  effective_stack: {
    id: 'effective_stack',
    title: 'Effective Stack',
    domain: 'fundamentals',
    summary: 'The smaller of the two stacks in a confrontation — it caps how much can actually go into the pot between them.',
    formula: 'effective_stack = min(hero_stack, villain_stack)',
    example: 'Hero 100bb vs Villain 42bb → effective stack is 42bb.',
    related: ['stack_depth', 'spr'],
  },
  bet_size_notation: {
    id: 'bet_size_notation',
    title: 'Bet-Size Notation',
    domain: 'fundamentals',
    summary: 'Bets are described either in big blinds ("raises to 2.5bb") or as a fraction of the pot ("bets 50% pot").',
    related: ['action_lines'],
  },
  nuts: {
    id: 'nuts',
    title: 'The Nuts',
    domain: 'fundamentals',
    summary: 'The strongest possible hand given the current board. Changes as new cards are dealt.',
    related: ['nut_advantage'],
  },
  rfi: {
    id: 'rfi',
    title: 'Raise First In (RFI)',
    domain: 'fundamentals',
    summary: 'Opening the pot with a raise when nobody has voluntarily entered before you — also called an "open."',
    related: ['poker_terminology', 'three_bet'],
  },
  three_bet: {
    id: 'three_bet',
    title: '3-Bet',
    domain: 'fundamentals',
    summary: 'A re-raise after an initial raise. Named for being the third bet in the sequence (blind counts as the first).',
    related: ['rfi', 'squeeze'],
  },
  squeeze: {
    id: 'squeeze',
    title: 'Squeeze',
    domain: 'fundamentals',
    summary: 'A 3-bet made after one player has raised and at least one other player has called.',
    related: ['three_bet', 'rfi'],
  },

  // ── Module 4: Preflop Aggression ──────────────────────────────────────────
  three_bet_motives: {
    id: 'three_bet_motives',
    title: 'Why 3-Bet?',
    domain: 'strategy',
    summary: 'A 3-bet can build a pot with value, generate fold equity, deny equity, isolate the opener, shrink the SPR, and punish a wide range — often several at once, not just "I have a premium."',
    related: ['three_bet', 'alpha'],
  },
  range_vs_range: {
    id: 'range_vs_range',
    title: 'Range vs Range',
    domain: 'ranges',
    summary: 'A hand is never evaluated alone — it is judged by how it performs against the specific range the opener represents.',
    related: ['hand_ranges', 'opener_range_strength'],
  },
  opener_range_strength: {
    id: 'opener_range_strength',
    title: 'Opener Range Strength',
    domain: 'ranges',
    summary: 'Earlier-position opens represent stronger, narrower ranges; later opens are wider and more marginal — the stronger the opener\'s range, the stronger your 3-bet candidates generally need to be.',
    related: ['range_vs_range', 'table_position'],
  },
  three_bet_range_construction: {
    id: 'three_bet_range_construction',
    title: 'Building a 3-Bet Range',
    domain: 'ranges',
    summary: 'A sound 3-betting range is built from value hands (win when called) and bluffs (blockers, playability, fold equity) chosen relative to the opener — not a list of favorite hands.',
    related: ['range_vs_range', 'linear_range', 'polarized'],
  },
  linear_range: {
    id: 'linear_range',
    title: 'Linear Range',
    domain: 'ranges',
    summary: 'A range built top-down by hand strength — strongest hands first, then the next strongest, with no gap in the middle.',
    related: ['polarized', 'three_bet_range_construction'],
  },
  calling_range_effect: {
    id: 'calling_range_effect',
    title: 'Calling Range ↔ 3-Bet Shape',
    domain: 'ranges',
    summary: 'When a meaningful flatting range exists, the 3-bet range can polarize (medium-strength hands stay as calls). When a strategy is mostly 3-bet-or-fold, the 3-bet range tends toward linear.',
    related: ['linear_range', 'polarized'],
  },
  players_behind_aggression: {
    id: 'players_behind_aggression',
    title: 'Players Behind',
    domain: 'strategy',
    summary: 'Aggression is never purely heads-up against the opener — every player still left to act can call, 3-bet, or wake up with a premium.',
    related: ['three_bet_motives', 'table_position'],
  },
  defending_opens: {
    id: 'defending_opens',
    title: 'Defending the Open',
    domain: 'strategy',
    summary: 'The question is never "is my hand good?" — it\'s how a hand performs against the specific range behind THIS open, from THIS seat, at THIS price and stack depth.',
    related: ['range_vs_range', 'opener_range_strength'],
  },
  pot_odds_preflop: {
    id: 'pot_odds_preflop',
    title: 'Pot Odds (Preflop)',
    domain: 'math',
    summary: 'The price to continue against an open — call ÷ (pot + call). A good price helps a hand qualify to continue, but it never guarantees the hand realizes enough equity to actually profit.',
    related: ['pot_odds', 'equity_realization_preflop'],
  },
  bb_defense: {
    id: 'bb_defense',
    title: 'BB Defense',
    domain: 'ranges',
    summary: 'The Big Blind gets the best price at the table (a blind already invested) and closes the action with no squeeze risk behind it — both factors widen how much of its range can profitably continue.',
    related: ['pot_odds_preflop', 'defending_opens'],
  },
  stack_depth_defense: {
    id: 'stack_depth_defense',
    title: 'Stack Depth and Defense',
    domain: 'strategy',
    summary: 'Stack depth changes both how wide a defending range is AND which hand types belong in it — shallower stacks favor rejamming and disfavor speculative implied-odds hands; deeper stacks support more postflop play.',
    related: ['effective_stack', 'rejam'],
  },
  equity_realization_preflop: {
    id: 'equity_realization_preflop',
    title: 'Equity Realization (Preflop Decisions)',
    domain: 'strategy',
    summary: 'Position changes how much of a hand\'s raw equity actually converts to pot share after the flop — the same hand can be worth calling in position and worth reraising out of position.',
    related: ['equity_real', 'position_three_bet'],
  },
  position_three_bet: {
    id: 'position_three_bet',
    title: 'Position and Re-Raising',
    domain: 'strategy',
    summary: 'In position, more hands can simply call and realize their equity, which lets a 3-bet range polarize. Out of position, calling is harder to profit from, which pushes strategies toward more linear or larger-sized aggression.',
    related: ['equity_real', 'linear_range', 'polarized'],
  },
  facing_three_bet: {
    id: 'facing_three_bet',
    title: 'Facing a 3-Bet',
    domain: 'strategy',
    summary: 'Every opening range has to survive resistance. The fold/call/4-bet decision depends on Hero\'s opening strength, the 3-bettor\'s position and sizing, relative position for the rest of the hand, range morphology, and stack depth.',
    related: ['three_bet', 'position_three_bet', 'four_bet'],
  },
  four_bet: {
    id: 'four_bet',
    title: '4-Bet',
    domain: 'fundamentals',
    summary: 'A reraise after a 3-bet — the fourth bet in the sequence. Motives vary: value, fold equity, denying equity, punishing an over-wide 3-bettor, or reducing a positional disadvantage.',
    related: ['three_bet', 'four_bet_bluff', 'five_bet'],
  },
  four_bet_bluff: {
    id: 'four_bet_bluff',
    title: '4-Bet Bluffing',
    domain: 'advanced',
    summary: 'Against a Villain who 3-bets too much and folds too often to 4-bets, value plus blocker-driven bluffs (like A5s) become attractive. Against a Villain who calls 4-bets too much, a more linear, value-heavy expansion punishes the leak better than blockers do.',
    related: ['four_bet', 'blockers'],
  },
  cold_four_bet: {
    id: 'cold_four_bet',
    title: 'Cold 4-Bet',
    domain: 'strategy',
    summary: 'Reraising a 3-bet without having entered the pot yet. Cold-calling instead reveals information, leaves the opener live, and can create awkward multiway spots — many strategies favor 4-bet/fold from cold over a large cold-calling range.',
    related: ['four_bet', 'three_bet'],
  },
  five_bet: {
    id: 'five_bet',
    title: '5-Bet',
    domain: 'fundamentals',
    summary: 'A reraise after a 4-bet — usually all-in at typical stack depths. The decision comes down to the same checklist as any all-in: pot odds, equity vs. the jamming range, stacks, and risk premium.',
    related: ['four_bet', 'rejam'],
  },
  rejam: {
    id: 'rejam',
    title: 'Rejam',
    domain: 'strategy',
    summary: 'An all-in reraise, most central at short stack depths where a non-all-in reraise would leave little stack behind. The call/fold decision reduces to pot odds versus the jamming range\'s equity.',
    related: ['five_bet', 'three_bet_sizing'],
  },
  alpha_three_bet: {
    id: 'alpha_three_bet',
    title: 'Alpha for a 3-Bet Bluff',
    domain: 'game_theory',
    summary: 'The fold frequency a preflop 3-bet bluff needs from Villain to break even, same formula as any bluff: risk ÷ (risk + reward). Blockers shift the real fold frequency, not the Alpha threshold itself.',
    formula: 'alpha = risk ÷ (risk + reward)',
    related: ['alpha', 'blockers'],
  },
  exploit_overfold: {
    id: 'exploit_overfold',
    title: 'Exploit: Overfolding',
    domain: 'strategy',
    summary: 'A player who folds far more than baseline to aggression (3-bets, 4-bets) should be attacked more — with sensible candidates near the normal boundary or with useful blockers, not random hands.',
    related: ['exploit', 'three_bet_motives'],
  },
  exploit_overcall: {
    id: 'exploit_overcall',
    title: 'Exploit: Overcalling',
    domain: 'strategy',
    summary: 'A player who calls aggression far more than baseline rewards a more linear, value-heavy range that dominates those calls — blocker bluffs earn little against someone who wasn\'t folding anyway.',
    related: ['exploit', 'linear_range'],
  },
  exploit_over_three_bet: {
    id: 'exploit_over_three_bet',
    title: 'Exploit: Over-3-Betting',
    domain: 'strategy',
    summary: 'A player who 3-bets far more than baseline needs their response to 4-bets checked before adjusting: over-folds to 4-bets rewards more bluffing; over-calls rewards more linear value; over-jams as a 5-bet rewards a wider stack-off range.',
    related: ['exploit', 'four_bet_bluff'],
  },
  exploit_under_three_bet: {
    id: 'exploit_under_three_bet',
    title: 'Exploit: Under-3-Betting',
    domain: 'strategy',
    summary: 'A player who 3-bets far less than baseline is under-bluffing — their 3-bet deserves extra credit, and Hero\'s marginal bluff-catchers should fold more than a balanced baseline would suggest.',
    related: ['exploit', 'facing_three_bet'],
  },
  action_lines: {
    id: 'action_lines',
    title: 'Action-Line Notation',
    domain: 'fundamentals',
    summary: 'Compact shorthand for betting sequences: x = check, b = bet, c = call, r = raise, f = fold.',
    example: 'x/r = check-raise. b/b/b = bet all three streets.',
    related: ['poker_terminology'],
  },
  range_thinking: {
    id: 'range_thinking',
    title: 'Range Thinking',
    domain: 'ranges',
    summary: 'Assigning an opponent a full set of plausible hands — weighted by likelihood — instead of guessing one exact holding.',
    related: ['hand_ranges', 'range_advantage'],
  },
  combinatorics: {
    id: 'combinatorics',
    title: 'Combinatorics',
    domain: 'math',
    summary: 'Counting exact two-card combinations behind each hand class: pairs = 6, suited = 4, offsuit = 12 (before removal).',
    formula: 'Total starting combos = 1,326',
    related: ['card_removal'],
  },
  card_removal: {
    id: 'card_removal',
    title: 'Card Removal',
    domain: 'math',
    summary: "Known cards — your hand and the board — remove combinations from what opponents can hold. The basis of blocker logic.",
    related: ['combinatorics', 'blockers'],
  },
  draws_equity: {
    id: 'draws_equity',
    title: 'Draws & Equity',
    domain: 'math',
    summary: 'Equity is your probabilistic share of the pot. Not every out is clean — some are dead, some only complete backdoor.',
    related: ['equity_real'],
  },
  spr: {
    id: 'spr',
    title: 'Stack-to-Pot Ratio (SPR)',
    domain: 'math',
    summary: 'Effective stack divided by the pot. Low SPR favors strong made hands; high SPR favors nut potential.',
    formula: 'SPR = effective_stack ÷ pot',
    related: ['effective_stack', 'spr_theory'],
  },
  range_morphology: {
    id: 'range_morphology',
    title: 'Range Morphology',
    domain: 'ranges',
    summary: 'The shape of a range — linear (best hands first), polarized (nuts + bluffs), or condensed (medium-strength heavy).',
    related: ['polarized', 'range_thinking'],
  },
}

const DOMAIN_COLORS: Record<string, string> = {
  math: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  game_theory: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  fundamentals: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  strategy: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  ranges: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  postflop: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
  advanced: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
}

// ── ConceptPopover ─────────────────────────────────────────────────────────────
// A small badge that expands into a full concept card on click

interface ConceptPopoverProps {
  conceptId: string
  children?: React.ReactNode
  className?: string
}

export function ConceptPopover({ conceptId, children, className }: ConceptPopoverProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const entry = CONCEPT_DATA[conceptId]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('keydown', onKey)
      document.addEventListener('mousedown', onOutside)
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [open])

  if (!entry) {
    return <span className={cn('text-violet-400/70 underline decoration-dotted cursor-help', className)}>{children ?? conceptId}</span>
  }

  const domainCls = DOMAIN_COLORS[entry.domain] ?? DOMAIN_COLORS.strategy

  return (
    <span className="relative inline-block" ref={panelRef}>
      {/* Trigger badge */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
          'text-[11px] font-semibold cursor-pointer transition-all duration-150',
          'hover:scale-105 active:scale-100',
          domainCls,
          className
        )}
      >
        <BookOpen className="h-2.5 w-2.5 shrink-0" />
        {children ?? entry.title}
      </button>

      {/* Expanded panel */}
      {open && (
        <div
          className={cn(
            'absolute z-50 left-0 top-full mt-2 w-72 rounded-2xl border border-border/60',
            'bg-card/95 backdrop-blur-sm shadow-2xl shadow-black/50',
            'animate-in fade-in slide-in-from-top-2 duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 p-4 pb-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg border shrink-0',
                  domainCls
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className={cn('text-[9px] font-bold uppercase tracking-widest', domainCls.split(' ')[0])}>
                  {entry.domain.replace(/_/g, ' ')}
                </p>
                <h3 className="text-sm font-bold text-foreground leading-tight">{entry.title}</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-px bg-border/30 mx-4" />

          <div className="p-4 pt-3 space-y-3">
            {/* Summary */}
            <p className="text-xs text-muted-foreground leading-relaxed">{entry.summary}</p>

            {/* Formula */}
            {entry.formula && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/8 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400/60 mb-1">
                  Formula
                </p>
                <code className="text-xs font-mono text-violet-200/90 leading-relaxed">
                  {entry.formula}
                </code>
              </div>
            )}

            {/* Example */}
            {entry.example && (
              <div className="rounded-lg border border-amber-500/15 bg-amber-500/6 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/60 mb-1">
                  Example
                </p>
                <p className="text-xs text-amber-200/70 leading-relaxed">{entry.example}</p>
              </div>
            )}

            {/* Related */}
            {entry.related && entry.related.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-1.5">
                  Related concepts
                </p>
                <div className="flex flex-wrap gap-1">
                  {entry.related.map(rel => {
                    const relEntry = CONCEPT_DATA[rel]
                    if (!relEntry) return null
                    const relCls = DOMAIN_COLORS[relEntry.domain] ?? ''
                    return (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => {
                          // Navigate to related — caller can handle via context
                        }}
                        className={cn(
                          'flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
                          'transition-opacity hover:opacity-80',
                          relCls
                        )}
                      >
                        {relEntry.title}
                        <ArrowRight className="h-2 w-2" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  )
}

// ── InlineConcept — lightweight text-only badge without popup ─────────────────

export function InlineConcept({ conceptId, className }: { conceptId: string; className?: string }) {
  const entry = CONCEPT_DATA[conceptId]
  const domainCls = entry ? (DOMAIN_COLORS[entry.domain] ?? '') : ''
  return (
    <ConceptPopover conceptId={conceptId} className={className}>
      {entry?.title ?? conceptId.replace(/_/g, ' ')}
    </ConceptPopover>
  )
}

// ── ConceptTagRow — row of concept tags with popovers ────────────────────────

export function ConceptTagRow({
  conceptIds,
  className,
}: {
  conceptIds: string[]
  className?: string
}) {
  if (!conceptIds.length) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {conceptIds.map(id => (
        <ConceptPopover key={id} conceptId={id} />
      ))}
    </div>
  )
}

// ── Export raw data for other components ──────────────────────────────────────

export { CONCEPT_DATA }
export type { ConceptEntry }
