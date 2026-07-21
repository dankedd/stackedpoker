/**
 * Poker Learning Platform — Static Curriculum Data
 *
 * This file is the source of truth for all learning paths, modules, and lessons.
 * Types are imported from ./types; do not redefine them here.
 */

import type { LearningPath, LearningModule, Lesson } from './types'

// ── Learning Paths ────────────────────────────────────────────────────────────

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'beginner',
    title: 'Foundations',
    description: 'Master the fundamentals of poker strategy',
    tier_required: 'free',
    sort_order: 1,
  },
  {
    id: 'intermediate',
    title: 'Range Thinking',
    description: 'Think in ranges and dominate postflop',
    tier_required: 'pro',
    sort_order: 2,
  },
  {
    id: 'advanced',
    title: 'GTO Mastery',
    description: 'Exploit-proof your game with game theory',
    tier_required: 'premium',
    sort_order: 3,
  },
  {
    id: 'pro',
    title: 'Pro / Elite',
    description: 'Solver-level thinking, ICM mastery, and exploit balancing for serious players',
    tier_required: 'premium',
    sort_order: 4,
  },
]

// ── Learning Modules ──────────────────────────────────────────────────────────

export const LEARNING_MODULES: LearningModule[] = [
  // ── Beginner path ────────────────────────────────────────────────────
  {
    id: 'poker-fundamentals-module',
    path_id: 'beginner',
    slug: 'poker-fundamentals-module',
    title: 'Poker Fundamentals',
    description: 'The language, structure, and building blocks behind every poker decision — the true entry point into the curriculum.',
    concept_ids: ['table_position', 'range_thinking', 'poker_terminology', 'combinatorics', 'draws_equity', 'spr', 'range_morphology'],
    unlock_after: [],
    sort_order: 0,
    xp_reward: 300,
  },
  {
    id: 'positions-module',
    path_id: 'beginner',
    slug: 'positions-module',
    title: 'Positions & Positional Advantage',
    description: 'Master the 6-max seat map, IP vs OOP dynamics, and how acting order determines preflop ranges and postflop leverage.',
    concept_ids: ['position_value', 'ip_advantage'],
    unlock_after: ['poker-fundamentals-module'],
    sort_order: 1,
    xp_reward: 200,
  },
  {
    id: 'pot-odds-module',
    path_id: 'beginner',
    slug: 'pot-odds-module',
    title: 'Pot Odds Intuition',
    description: 'Quickly calculate whether a call is mathematically correct.',
    concept_ids: ['pot_odds'],
    unlock_after: ['positions-module'],
    sort_order: 2,
    xp_reward: 100,
  },
  {
    id: 'value-betting-module',
    path_id: 'beginner',
    slug: 'value-betting-module',
    title: 'Value Betting',
    description: 'Extract maximum chips when you hold the best hand.',
    concept_ids: ['value_betting'],
    unlock_after: ['pot-odds-module'],
    sort_order: 3,
    xp_reward: 150,
  },
  {
    id: 'bluff-basics-module',
    path_id: 'beginner',
    slug: 'bluff-basics-module',
    title: 'Bluff Fundamentals',
    description: 'Understand when and why bluffs work — and when they backfire.',
    concept_ids: ['alpha', 'bluff_basics'],
    unlock_after: ['value-betting-module'],
    sort_order: 4,
    xp_reward: 150,
  },
  {
    id: 'preflop-module',
    path_id: 'beginner',
    slug: 'preflop-module',
    title: 'Preflop Ranges',
    description: 'Build solid opening and calling ranges from every position.',
    concept_ids: ['hand_ranges'],
    unlock_after: ['bluff-basics-module'],
    sort_order: 5,
    xp_reward: 200,
  },

  // ── Intermediate path ────────────────────────────────────────────────
  {
    id: 'range-construction-module',
    path_id: 'intermediate',
    slug: 'range-construction-module',
    title: 'Range Construction',
    description: 'Build balanced, exploitative ranges pre- and postflop.',
    concept_ids: ['hand_ranges', 'range_advantage'],
    unlock_after: [],
    sort_order: 1,
    xp_reward: 200,
  },
  {
    id: 'board-texture-module',
    path_id: 'intermediate',
    slug: 'board-texture-module',
    title: 'Board Texture Reading',
    description: 'Classify any flop in seconds and immediately adjust your strategy.',
    concept_ids: ['board_texture'],
    unlock_after: [],
    sort_order: 2,
    xp_reward: 200,
  },
  {
    id: 'cbet-module',
    path_id: 'intermediate',
    slug: 'cbet-module',
    title: 'C-Bet Strategy',
    description: 'Know when to c-bet, when to check, and which sizing to reach for.',
    concept_ids: ['cbet_theory'],
    unlock_after: ['board-texture-module'],
    sort_order: 3,
    xp_reward: 250,
  },
  {
    id: 'mdf-module',
    path_id: 'intermediate',
    slug: 'mdf-module',
    title: 'MDF & Defense Frequencies',
    description: 'Stop over-folding and over-calling — defend at exactly the right frequency.',
    concept_ids: ['mdf', 'alpha'],
    unlock_after: [],
    sort_order: 4,
    xp_reward: 250,
  },
  {
    id: 'equity-real-module',
    path_id: 'intermediate',
    slug: 'equity-real-module',
    title: 'Equity Realization',
    description: 'Understand how position, initiative, and SPR affect how much equity you capture.',
    concept_ids: ['equity_real', 'spr_theory'],
    unlock_after: ['mdf-module'],
    sort_order: 5,
    xp_reward: 300,
  },

  // ── Advanced path ────────────────────────────────────────────────────
  {
    id: 'polarized-module',
    path_id: 'advanced',
    slug: 'polarized-module',
    title: 'Polarized vs Merged Ranges',
    description: 'Master the art of structuring your betting range on every street.',
    concept_ids: ['polarized'],
    unlock_after: [],
    sort_order: 1,
    xp_reward: 300,
  },
  {
    id: 'geometric-module',
    path_id: 'advanced',
    slug: 'geometric-module',
    title: 'Geometric Sizing',
    description: "Use mathematically optimal bet sizing to put villain to the hardest decisions.",
    concept_ids: ['geometric_sizing'],
    unlock_after: [],
    sort_order: 2,
    xp_reward: 350,
  },
  {
    id: 'blockers-module',
    path_id: 'advanced',
    slug: 'blockers-module',
    title: 'Blockers & Unblockers',
    description: "Choose your bluffs and value bets based on what your cards remove from villain's range.",
    concept_ids: ['blockers'],
    unlock_after: [],
    sort_order: 3,
    xp_reward: 400,
  },
  {
    id: 'exploit-module',
    path_id: 'advanced',
    slug: 'exploit-module',
    title: 'Exploitative Play',
    description: 'Identify opponent leaks and deviate from GTO to maximise EV against specific tendencies.',
    concept_ids: ['exploit'],
    unlock_after: ['polarized-module'],
    sort_order: 4,
    xp_reward: 450,
  },
  {
    id: 'mixed-strategies-module',
    path_id: 'advanced',
    slug: 'mixed-strategies-module',
    title: 'Mixed Strategies & Frequencies',
    description: 'Master indifference-based frequency play and stop being exploited by observant opponents.',
    concept_ids: ['indifference', 'nash_equilibrium'],
    unlock_after: ['mdf-module'],
    sort_order: 5,
    xp_reward: 500,
  },

  // ── Pro / Elite path ────────────────────────────────────────────────
  {
    id: 'icm-module',
    path_id: 'pro',
    slug: 'icm-module',
    title: 'ICM & Tournament Pressure',
    description: 'Convert chip stacks to real-money equity and tighten calling ranges near pay jumps.',
    concept_ids: ['icm'],
    unlock_after: [],
    sort_order: 1,
    xp_reward: 500,
  },
  {
    id: 'population-reads-module',
    path_id: 'pro',
    slug: 'population-reads-module',
    title: 'Population Reads',
    description: 'Exploit systematic leaks that most player pools share: over-folds, over-calls, and more.',
    concept_ids: ['exploit'],
    unlock_after: ['icm-module'],
    sort_order: 2,
    xp_reward: 500,
  },
  {
    id: 'advanced-ranges-module',
    path_id: 'pro',
    slug: 'advanced-ranges-module',
    title: 'Solver-Level Range Construction',
    description: 'Build statically and dynamically balanced ranges the way modern solvers construct them.',
    concept_ids: ['hand_ranges', 'equity_buckets', 'bluff_value_ratio'],
    unlock_after: ['population-reads-module'],
    sort_order: 3,
    xp_reward: 600,
  },
  {
    id: 'multistreet-planning-module',
    path_id: 'pro',
    slug: 'multistreet-planning-module',
    title: 'Multi-Street Planning',
    description: 'Plan your entire hand from flop to river using geometric sizing and EV trees.',
    concept_ids: ['geometric_sizing', 'equity_real'],
    unlock_after: ['advanced-ranges-module'],
    sort_order: 4,
    xp_reward: 700,
  },
]

// ── Lessons ───────────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [
  {
    id: 'think-like-a-poker-player',
    module_id: 'poker-fundamentals-module',
    slug: 'think-like-a-poker-player',
    title: 'Think Like a Poker Player',
    subtitle: 'The language, structure, and building blocks behind every poker decision.',
    lesson_type: 'micro',
    concept_ids: ['table_position', 'range_thinking', 'poker_terminology', 'combinatorics', 'draws_equity', 'spr', 'range_morphology'],
    estimated_min: 35,
    xp_reward: 300,
    sort_order: 1,
    next_lesson_teaser: 'The Math Behind Every Decision',
    chapters: [
      { title: 'Your Seat Changes Everything', step_ids: ['c1-s1', 'c1-s2', 'c1-s3', 'c1-s4', 'c1-s5a', 'c1-s5b', 'c1-s5c'] },
      { title: 'Speak the Language', step_ids: ['c2-s6', 'c2-s7', 'c2-s8', 'c2-s9', 'c2-s10', 'c2-s11', 'c2-s12', 'c2-s13', 'c2-s13b', 'c2-s14'] },
      { title: 'Actions & Hand Histories', step_ids: ['c3-s14', 'c3-s15a', 'c3-s15b', 'c3-s15c', 'c3-s16', 'c3-s17', 'c3-s18', 'c3-s19', 'c3-s20', 'c3-s20b'] },
      { title: 'Stop Thinking in One Hand', step_ids: ['c4-s21', 'c4-s22', 'c4-s23'] },
      { title: 'The 13×13 Range Map', step_ids: ['c5-s24', 'c5-s25', 'c5-s26'] },
      { title: 'Combinations & Card Removal', step_ids: ['c6-s27', 'c6-s27b', 'c6-s28', 'c6-s29', 'c6-s30', 'c6-s31', 'c6-s31b'] },
      { title: 'Draws, Outs & Equity', step_ids: ['c7-s32', 'c7-s33', 'c7-s34', 'c7-s35', 'c7-s36', 'c7-s37', 'c7-s38', 'c7-s39', 'c7-s40', 'c7-s41', 'c7-s42'] },
      { title: 'Stacks Change Hand Value', step_ids: ['c8-s43', 'c8-s44', 'c8-s45', 'c8-s46'] },
      {
        title: 'The Shape of a Range',
        step_ids: [
          'c9-s47', 'c9-s48', 'c9-s49', 'c9-s50', 'c9-s51', 'c9-s52', 'c9-s53', 'c9-s54', 'c9-s55',
          'c9-fc1', 'c9-fc2', 'c9-fc3', 'c9-fc4', 'c9-fc5', 'c9-fc6', 'c9-fc7', 'c9-fc8', 'c9-fc9', 'c9-fc10',
        ],
      },
    ],
    steps: [
      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 1 — Your Seat Changes Everything
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c1-s1',
        type: 'concept_reveal',
        concept_ids: ['table_position'],
        concept_title: 'Before Your Cards Matter, Your Seat Matters',
        concept_content:
          "Every poker decision happens from a position at the table. Your position determines when you act, how much information you have, and which opponents are still waiting behind you.",
        visual: 'table',
        xp: 2,
      },
      {
        id: 'c1-s2',
        type: 'position_table',
        concept_ids: ['table_position'],
        position_table_mode: 'explore',
        narrative:
          "Nine-handed poker has three broad zones — early, middle, and late position — plus the two blinds. Tap every seat to learn what it means.",
        xp: 5,
      },
      {
        id: 'c1-s3',
        type: 'position_table',
        concept_ids: ['table_position', 'relative_position'],
        position_table_mode: 'quiz',
        position_table_highlight: ['HJ', 'BTN', 'BB'],
        position_table_prompt: 'Which player will act last after the flop?',
        options: [
          { id: 'HJ', label: 'HJ', quality: 'mistake', feedback: 'HJ acts early postflop against BTN and BB — not last.' },
          { id: 'BTN', label: 'BTN', quality: 'perfect', feedback: 'Correct. Acting later gives you information before you make your decision.' },
          { id: 'BB', label: 'BB', quality: 'mistake', feedback: 'BB is usually first to act postflop against non-blind positions, not last.' },
        ],
        xp: 5,
      },
      {
        id: 'c1-s4',
        type: 'concept_reveal',
        concept_ids: ['ip_oop', 'relative_position'],
        concept_title: 'In Position vs Out of Position',
        concept_content:
          "IN POSITION (IP): you act after your opponent. OUT OF POSITION (OOP): you act before them. Position is relative — BTN is IP against every other seat, since BTN acts last of all. The player acting second gets to see the first player's action before deciding. Position is information.",
        visual: 'table',
        xp: 2,
      },
      {
        id: 'c1-s5a',
        type: 'action_sequence',
        concept_ids: ['ip_oop'],
        narrative: 'BTN vs BB.',
        action_sequence_prompt: 'Who is IP (in position)?',
        options: [
          { id: 'btn', label: 'BTN', quality: 'perfect', feedback: 'Correct — BTN acts last on every postflop street.' },
          { id: 'bb', label: 'BB', quality: 'mistake', feedback: 'BB acts first postflop here — BTN has position.' },
        ],
        xp: 3,
      },
      {
        id: 'c1-s5b',
        type: 'action_sequence',
        concept_ids: ['ip_oop'],
        narrative: 'CO vs BTN.',
        action_sequence_prompt: 'Who is IP?',
        options: [
          { id: 'btn', label: 'BTN', quality: 'perfect', feedback: 'Correct — BTN is in position against every other seat at the table.' },
          { id: 'co', label: 'CO', quality: 'mistake', feedback: 'CO acts before BTN postflop, so CO is out of position here.' },
        ],
        xp: 3,
      },
      {
        id: 'c1-s5c',
        type: 'action_sequence',
        concept_ids: ['ip_oop'],
        narrative: 'SB vs BB, blind-vs-blind pot.',
        action_sequence_prompt: 'Who acts first postflop?',
        options: [
          { id: 'sb', label: 'SB', quality: 'perfect', feedback: 'Correct — in blind-vs-blind pots, SB is out of position and acts first after the flop.' },
          { id: 'bb', label: 'BB', quality: 'mistake', feedback: 'BB actually acts last postflop in a blind-vs-blind pot — SB acts first.' },
        ],
        xp: 6,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 2 — Speak the Language
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c2-s6',
        type: 'concept_reveal',
        concept_ids: ['poker_terminology'],
        concept_title: 'Hero & Villain',
        concept_content:
          "Hero is the player whose decision we're studying — that's you in every lesson. Villain is an opponent; there can be multiple villains in a hand. Active players are everyone still involved. You'll see these terms constantly from here on.",
        xp: 2,
      },
      {
        id: 'c2-s7',
        type: 'concept_reveal',
        concept_ids: ['poker_terminology'],
        concept_title: 'Preflop and Postflop',
        concept_content:
          "A hand moves through streets: PREFLOP → FLOP → TURN → RIVER. Preflop covers all action before any community cards appear. Postflop is everything after the flop is dealt — flop, turn, and river together.",
        visual: 'table',
        xp: 2,
      },
      {
        id: 'c2-s8',
        type: 'action_sequence',
        concept_ids: ['poker_terminology'],
        narrative:
          'UTG folds. HJ folds. CO folds. Action reaches BTN — nobody before BTN has voluntarily entered the pot, so BTN is "first in."',
        action_sequence_display: ['UTG folds', 'HJ folds', 'CO folds', 'Action on BTN'],
        action_sequence_prompt: 'If CO had already called instead of folding, would BTN still be first in?',
        options: [
          { id: 'no', label: 'No', quality: 'perfect', feedback: 'Correct — once CO calls, BTN is no longer first in; BTN would be acting over an open pot.' },
          { id: 'yes', label: 'Yes', quality: 'mistake', feedback: 'Once any player voluntarily enters the pot, everyone after them is no longer first in.' },
        ],
        xp: 4,
      },
      {
        id: 'c2-s9',
        type: 'action_sequence',
        concept_ids: ['stack_depth'],
        narrative: 'Player has 4,000 chips. Big blind = 100.',
        action_sequence_prompt: 'How deep is this stack, expressed in big blinds?',
        options: [
          { id: '4bb', label: '4bb', quality: 'mistake', feedback: 'That would be 400 chips, not 4,000.' },
          { id: '20bb', label: '20bb', quality: 'mistake', feedback: '20bb would be 2,000 chips.' },
          { id: '40bb', label: '40bb', quality: 'perfect', feedback: 'Correct — 4,000 ÷ 100 = 40bb. Stack depth is normally expressed in big blinds, not raw chip counts.' },
          { id: '400bb', label: '400bb', quality: 'mistake', feedback: 'That would be 400,000 chips.' },
        ],
        xp: 4,
      },
      {
        id: 'c2-s10',
        type: 'action_sequence',
        concept_ids: ['effective_stack'],
        narrative: 'Hero: 100bb. Villain: 42bb.',
        action_sequence_prompt: 'How many big blinds can Hero actually lose to this Villain?',
        options: [
          { id: '100', label: '100bb', quality: 'mistake', feedback: "That's Hero's own stack, but Villain can't put in more than they have." },
          { id: '42', label: '42bb', quality: 'perfect', feedback: 'Correct — the effective stack is the smaller of the two stacks. It caps how much can actually go into the pot between them.' },
          { id: '58', label: '58bb', quality: 'mistake', feedback: "That's the difference between the stacks, not the effective stack." },
        ],
        xp: 4,
      },
      {
        id: 'c2-s11',
        type: 'concept_reveal',
        concept_ids: ['effective_stack'],
        concept_title: 'Another Example',
        concept_content: 'Hero: 30bb. Villain: 80bb. Effective stack = 30bb — always the smaller of the two.',
        xp: 2,
      },
      {
        id: 'c2-s12',
        type: 'concept_reveal',
        concept_ids: ['bet_size_notation'],
        concept_title: 'Bet-Size Notation',
        concept_content:
          'Bets are described two ways: in big blinds ("BTN raises to 2.5bb") or as a fraction of the pot ("Hero bets 50% pot"). On a 100-chip pot: 25 chips is 25% pot, 50 is half pot, 75 is 75% pot, 100 is pot-sized, and 150 is a 150% pot overbet.',
        xp: 2,
      },
      {
        id: 'c2-s13',
        type: 'concept_reveal',
        concept_ids: ['nuts'],
        board: ['9h', '8h', '7d'],
        hero_hand: ['Jc', 'Tc'],
        concept_title: 'The Nuts',
        concept_content:
          'On this board, JT makes the nut straight — the strongest hand currently possible. But if a later card changes what the best possible hand is, JT may no longer be the nuts.',
        xp: 2,
      },
      {
        id: 'c2-s13b',
        type: 'action_sequence',
        concept_ids: ['nuts'],
        board: ['9h', '8h', '7d', '9s'],
        hero_hand: ['Jc', 'Tc'],
        narrative: 'The turn brings the 9♠.',
        action_sequence_prompt: 'Is J-T still the nuts?',
        options: [
          { id: 'no', label: 'No', quality: 'perfect', feedback: 'Correct — 9♠ pairs the board, and a set of nines now beats the straight. The nuts changed.' },
          { id: 'yes', label: 'Yes', quality: 'mistake', feedback: 'The board pairing means a set of nines now beats the straight — JT is no longer the nuts.' },
        ],
        xp: 4,
      },
      {
        id: 'c2-s14',
        type: 'concept_reveal',
        concept_ids: ['nuts'],
        concept_title: 'Effective Nuts',
        concept_content:
          "Sometimes a hand isn't literally the strongest possible hand, but it's so strong relative to realistic ranges that it plays like the nuts. Absolute hand ranking and strategic hand strength aren't always the same thing.",
        xp: 2,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 3 — Actions & Hand Histories
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c3-s14',
        type: 'concept_reveal',
        concept_ids: ['poker_terminology'],
        concept_title: 'Basic Actions',
        concept_content:
          'CHECK: pass the action without adding chips, when no bet must be matched. CALL: match the current wager. BET/RAISE: increase the current wager. FOLD: give up the hand. LIMP: enter preflop by calling the big blind instead of raising.',
        xp: 2,
      },
      {
        id: 'c3-s15a',
        type: 'concept_reveal',
        concept_ids: ['rfi'],
        concept_title: 'VPIP & RFI',
        concept_content:
          'VPIP (Voluntarily Put money In Pot): calling or raising counts; posting forced blinds does not. RFI (Raise First In), also called an "open": raising when action reaches you with nobody voluntarily in the pot yet.',
        xp: 2,
      },
      {
        id: 'c3-s15b',
        type: 'action_sequence',
        concept_ids: ['rfi'],
        narrative: 'BTN raises after everyone folds.',
        action_sequence_prompt: 'What is this action called?',
        options: [
          { id: 'rfi', label: 'RFI (open raise)', quality: 'perfect', feedback: 'Correct — nobody had voluntarily entered before BTN raised.' },
          { id: 'vpip_only', label: 'VPIP, but not RFI', quality: 'mistake', feedback: "This IS an RFI — it's also VPIP, but the more specific term applies here." },
        ],
        xp: 4,
      },
      {
        id: 'c3-s15c',
        type: 'action_sequence',
        concept_ids: ['rfi'],
        narrative: "CO calls UTG's raise.",
        action_sequence_prompt: 'What is this action called?',
        options: [
          { id: 'vpip', label: 'VPIP, but not RFI', quality: 'perfect', feedback: 'Correct — CO voluntarily put money in, but UTG already opened, so this is not an RFI.' },
          { id: 'rfi', label: 'RFI', quality: 'mistake', feedback: 'UTG already raised first — CO is just calling, not opening.' },
        ],
        xp: 4,
      },
      {
        id: 'c3-s16',
        type: 'concept_reveal',
        concept_ids: ['poker_terminology', 'three_bet'],
        concept_title: 'The Betting Ladder',
        concept_content:
          'Big blind = the first forced bet. First raise = 2-bet. Re-raise = 3-bet. Next raise = 4-bet, then 5-bet. In conversation, players usually say "open," "3-bet," "4-bet" — rarely "2-bet."',
        xp: 2,
      },
      {
        id: 'c3-s17',
        type: 'concept_reveal',
        concept_ids: ['poker_terminology', 'three_bet', 'squeeze'],
        concept_title: 'Preflop Vocabulary',
        concept_content:
          'STEAL: an RFI from CO/BTN/SB to win the blinds. ISOLATE: raise after a limper, aiming to play heads-up. MIN-RAISE: the minimum legal raise. 3-BET: re-raise after a raise. RESTEAL: a 3-bet against a steal. ALL-IN/PUSH: bet all remaining chips. COLD CALL: call a raise without previously entering the pot. SQUEEZE: 3-bet after a raise and at least one call.',
        xp: 3,
      },
      {
        id: 'c3-s18',
        type: 'action_sequence',
        concept_ids: ['squeeze'],
        narrative: 'UTG raises to 2.5bb. CO calls. BTN raises to 11bb.',
        action_sequence_display: ['UTG raises to 2.5bb', 'CO calls', 'BTN raises to 11bb'],
        action_sequence_prompt: "What is BTN's action called?",
        options: [
          { id: 'steal', label: 'Steal', quality: 'mistake', feedback: 'A steal is an RFI into folded action — here two players already voluntarily entered.' },
          { id: 'squeeze', label: 'Squeeze', quality: 'perfect', feedback: 'Correct — BTN 3-bet after a raise and a call. That combination is a squeeze.' },
          { id: 'cold_call', label: 'Cold call', quality: 'mistake', feedback: 'BTN raised, not called.' },
          { id: 'open_shove', label: 'Open shove', quality: 'mistake', feedback: "This isn't an all-in, and action wasn't folded to BTN." },
        ],
        xp: 6,
      },
      {
        id: 'c3-s19',
        type: 'concept_reveal',
        concept_ids: ['poker_terminology'],
        concept_title: 'Postflop Language',
        concept_content:
          'C-BET: a postflop bet by whoever was the aggressor on the previous street. DONK BET (LEAD): an out-of-position player bets into the previous aggressor before they can c-bet. SLOW PLAY (TRAP): playing a very strong hand passively to induce future bets.',
        xp: 2,
      },
      {
        id: 'c3-s20',
        type: 'action_sequence',
        concept_ids: ['action_lines'],
        narrative:
          'x = check, b = bet, c = call, r = raise, f = fold. Sequences chain across streets: x/f = check-fold, x/c = check-call, x/r = check-raise, b/b = bet flop then bet turn.',
        action_sequence_prompt: 'Translate "x/r".',
        options: [
          { id: 'check_raise', label: 'Check-raise', quality: 'perfect', feedback: 'Correct — check, then raise when facing a bet.' },
          { id: 'bet_raise', label: 'Bet then raise', quality: 'mistake', feedback: '"x" always means check, not bet.' },
          { id: 'check_call', label: 'Check-call', quality: 'mistake', feedback: '"r" means raise, not call.' },
        ],
        xp: 4,
      },
      {
        id: 'c3-s20b',
        type: 'action_sequence',
        concept_ids: ['action_lines'],
        action_sequence_prompt: 'Translate "bet flop, bet turn, bet river" into notation.',
        options: [
          { id: 'bbb', label: 'b/b/b', quality: 'perfect', feedback: 'Correct — three streets, three bets.' },
          { id: 'bbc', label: 'b/b/c', quality: 'mistake', feedback: 'All three streets were bets, not a call.' },
          { id: 'xbb', label: 'x/b/b', quality: 'mistake', feedback: 'The flop was a bet, not a check.' },
        ],
        xp: 6,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 4 — Stop Thinking in One Hand
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c4-s21',
        type: 'concept_reveal',
        concept_ids: ['range_thinking'],
        concept_title: 'The Beginner Trap',
        concept_content:
          'When a beginner sees a raise, they think: "He probably has AK." A strong player asks instead: "What hands can take this action?" Strong players rarely guess one exact holding — they assign a RANGE of plausible hands, and every action changes that range.',
        xp: 2,
      },
      {
        id: 'c4-s22',
        type: 'concept_reveal',
        concept_ids: ['range_thinking'],
        board: ['As', 'Jh', '4d'],
        concept_title: 'Every Action Gives Information',
        concept_content:
          'Opponent raises from early position — their range narrows to strong hands. Flop A♠J♥4♦, opponent bets — the range shifts again, not just shrinking but changing composition. Every action reshapes what they can have, not just narrows it.',
        xp: 2,
      },
      {
        id: 'c4-s23',
        type: 'concept_reveal',
        concept_ids: ['range_thinking'],
        concept_title: 'Your Range Matters Too',
        concept_content:
          'Range thinking has two sides: "What can Villain have?" AND "What can I have?" Later strategy depends on how your range and their range interact. Poker strategy is range versus range.',
        xp: 4,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 5 — The 13×13 Range Map
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c5-s24',
        type: 'concept_reveal',
        concept_ids: ['range_thinking'],
        concept_title: 'The 13×13 Range Map',
        concept_content:
          'There are 169 strategically distinct starting-hand classes, arranged in a grid. The diagonal is pocket pairs (AA, 77, 22). Above the diagonal is suited hands (AKs, T9s). Below the diagonal is offsuit hands (AKo, QJo).',
        visual: 'range_grid',
        xp: 2,
      },
      {
        id: 'c5-s25',
        type: 'range_heatmap',
        concept_ids: ['range_thinking'],
        narrative: 'Tap these three hands on the grid: AKs, 88, and QJo.',
        range_heatmap_target: ['AKs', '88', 'QJo'],
        range_hint: 'Suited hands sit above the diagonal; offsuit hands sit below it; pairs run down the diagonal.',
        xp: 6,
      },
      {
        id: 'c5-s26',
        type: 'concept_reveal',
        concept_ids: ['combinatorics'],
        concept_title: "Why 169 Isn't the Whole Story",
        concept_content:
          '169 hand classes, but 1,326 exact two-card combinations. AKs is one strategic class, but it can appear in four exact suited combinations. AKo has twelve. AA has six. This is the idea of COMBOS.',
        xp: 4,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 6 — Combinations & Card Removal
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c6-s27',
        type: 'combo_visualizer',
        concept_ids: ['combinatorics'],
        narrative: 'Four aces. How many ways can you choose two of them?',
        combo_visualizer_mode: 'reveal',
        combo_visualizer_kind: 'pair',
        combo_visualizer_subject: 'A',
        xp: 2,
      },
      {
        id: 'c6-s27b',
        type: 'combo_visualizer',
        concept_ids: ['combinatorics'],
        narrative: 'How many combinations of KK exist preflop?',
        combo_visualizer_mode: 'quiz',
        combo_visualizer_kind: 'pair',
        combo_visualizer_subject: 'K',
        combo_visualizer_correct: 6,
        combo_visualizer_correct_feedback: 'Correct — any pocket pair has 6 combinations before any cards are removed.',
        combo_visualizer_wrong_feedback: 'Any pocket pair has 6 combinations before removal: choose 2 of 4 suits.',
        xp: 5,
      },
      {
        id: 'c6-s28',
        type: 'combo_visualizer',
        concept_ids: ['combinatorics'],
        narrative: '4 Aces × 4 Kings = 16 AK combinations, split into 4 suited and 12 offsuit.',
        combo_visualizer_mode: 'reveal',
        combo_visualizer_kind: 'unpaired',
        combo_visualizer_subject: 'AK',
        xp: 4,
      },
      {
        id: 'c6-s29',
        type: 'concept_reveal',
        concept_ids: ['combinatorics'],
        concept_title: 'The Full Deck Count',
        concept_content:
          "Pocket pairs: 13 × 6 = 78. Suited hands: 78 × 4 = 312. Offsuit hands: 78 × 12 = 936. Total: 1,326 combinations. You don't need to memorize all three totals — just remember: pair = 6, suited = 4, offsuit = 12, unpaired both = 16.",
        xp: 2,
      },
      {
        id: 'c6-s30',
        type: 'combo_visualizer',
        concept_ids: ['card_removal', 'blockers_intro'],
        hero_hand: ['Ad', 'Kc'],
        narrative:
          "Hero holds A♦K♣. Can Villain have A♦K♦? No — Villain can't, because Hero already holds the A♦. Known cards remove combinations from what opponents can hold. This is card removal, and a card that blocks combos this way is called a BLOCKER.",
        combo_visualizer_mode: 'reveal',
        combo_visualizer_kind: 'removal',
        combo_visualizer_subject: 'A',
        combo_visualizer_known_cards: ['Ad'],
        xp: 4,
      },
      {
        id: 'c6-s31',
        type: 'combo_visualizer',
        concept_ids: ['card_removal'],
        board: ['Ac', '7d', '2s'],
        narrative: 'Board: A♣7♦2♠. How many combinations of AA can Villain still hold?',
        combo_visualizer_mode: 'quiz',
        combo_visualizer_kind: 'removal',
        combo_visualizer_subject: 'A',
        combo_visualizer_known_cards: ['Ac'],
        combo_visualizer_correct: 3,
        xp: 6,
      },
      {
        id: 'c6-s31b',
        type: 'combo_visualizer',
        concept_ids: ['card_removal'],
        board: ['Ac', '7d', '2s'],
        hero_hand: ['Ad', 'Kh'],
        narrative: 'Hero also holds A♦. How many AA combinations remain for Villain now?',
        combo_visualizer_mode: 'quiz',
        combo_visualizer_kind: 'removal',
        combo_visualizer_subject: 'A',
        combo_visualizer_known_cards: ['Ac', 'Ad'],
        combo_visualizer_correct: 1,
        xp: 8,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 7 — Draws, Outs & Equity
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c7-s32',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'draws'],
        hero_hand: ['8s', '7s'],
        board: ['6d', '5c', 'Kh'],
        concept_title: 'What Is an Out?',
        concept_content:
          "An out is a remaining card that improves your hand to the hand you're drawing toward. Here, any 9 or 4 completes the straight — 4 nines + 4 fours = 8 potential outs. But potential outs aren't always live outs.",
        xp: 2,
      },
      {
        id: 'c7-s33',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'backdoor_draws'],
        concept_title: 'Backdoor Draws',
        concept_content:
          "A backdoor draw needs BOTH the turn and river to cooperate — a backdoor flush needs running cards of one suit; a backdoor straight needs two specific future cards. It's weak on its own, but a live backdoor draw adds real value — roughly comparable to one extra clean out spread across two streets.",
        xp: 2,
      },
      {
        id: 'c7-s34',
        type: 'action_sequence',
        concept_ids: ['draws_equity', 'dead_outs'],
        narrative:
          "Hero has an open-ended straight draw — normally 8 outs. But some of those straight cards also complete Villain's flush, improving Hero's hand while still leaving Hero behind. Those are DEAD OUTS.",
        action_sequence_prompt: 'Should every card that completes your straight automatically count as a clean out?',
        options: [
          { id: 'no', label: 'No', quality: 'perfect', feedback: 'Correct — a card that improves your hand but still leaves you behind is a dead out, not a clean one.' },
          { id: 'yes', label: 'Yes', quality: 'mistake', feedback: 'Cards that complete a bigger hand for Villain at the same time are dead outs, not clean ones.' },
        ],
        xp: 5,
      },
      {
        id: 'c7-s35',
        type: 'action_sequence',
        concept_ids: ['draws_equity', 'dead_outs'],
        narrative: 'DRAWING DEAD means no remaining card can produce a winning hand — even if your hand improves.',
        action_sequence_prompt: 'Can Hero still improve their hand and remain drawing dead?',
        options: [
          { id: 'yes', label: 'Yes', quality: 'perfect', feedback: 'Correct — improving is not the same as becoming the best hand. You can hit your card and still lose.' },
          { id: 'no', label: 'No', quality: 'mistake', feedback: 'Improving your hand does not guarantee it becomes the best hand — you can still be drawing dead after improving.' },
        ],
        xp: 5,
      },
      {
        id: 'c7-s36',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'implied_odds_intro'],
        concept_title: 'Implied Odds',
        concept_content:
          'Sometimes calling a draw is more attractive because you may win additional chips on later streets when you complete it — current pot plus possible future chips, not just the pot in front of you right now.',
        xp: 2,
      },
      {
        id: 'c7-s37',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'reverse_implied_odds_intro'],
        concept_title: 'Reverse Implied Odds',
        concept_content:
          'Sometimes making your apparent draw costs you more — you make a small flush, but Villain makes or already holds a bigger one. Not every improvement is equally valuable.',
        xp: 2,
      },
      {
        id: 'c7-s38',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'pot_commitment'],
        concept_title: 'Pot Committed',
        concept_content:
          "A player becomes pot committed when so much of the effective stack is already invested that the price to continue is favorable relative to what's left and their chance of winning — folding stops being reasonable. Money already invested is not, by itself, a reason to continue. It's about the current price and remaining stack, not attachment to past chips.",
        xp: 2,
      },
      {
        id: 'c7-s39',
        type: 'equity_predict',
        concept_ids: ['draws_equity', 'equity'],
        narrative:
          'Equity is your share of the pot — how often a hand or range would win or tie if the remaining cards were simply dealt out with no more betting. It is a probability-based share, not a guaranteed outcome.',
        pot_bb: 100,
        equity_actual: 70,
        equity_tolerance: 5,
        correct_feedback: 'Right around there — equity is a probability-based share of the pot, not guaranteed winnings.',
        wrong_feedback: 'Equity is a probability-based share of the pot, not guaranteed winnings.',
        xp: 6,
      },
      {
        id: 'c7-s40',
        type: 'action_sequence',
        concept_ids: ['draws_equity', 'equity'],
        narrative: 'AKo vs JTs. Then 22 vs AKo. Then JTs vs 22.',
        action_sequence_prompt: "Can poker hands always be ranked independently of the opponent's hand?",
        options: [
          { id: 'no', label: 'No', quality: 'perfect', feedback: 'Correct — hand strength is relational. A hand can perform well against one holding and worse against another, like rock-paper-scissors.' },
          { id: 'yes', label: 'Yes', quality: 'mistake', feedback: 'Hand strength is relational — context determines strength, not a fixed independent ranking.' },
        ],
        xp: 5,
      },
      {
        id: 'c7-s41',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'hand_vs_range'],
        hero_hand: ['Qc', 'Ts'],
        concept_title: 'Hand vs Range',
        concept_content:
          'Hand-vs-range equity asks: "How does this exact hand perform against every hand Villain can realistically hold?" Each possible Villain hand contributes according to how likely it is — no heavy calculation required yet, just the idea.',
        xp: 2,
      },
      {
        id: 'c7-s42',
        type: 'concept_reveal',
        concept_ids: ['draws_equity', 'range_vs_range'],
        board: ['8h', '7h', '6s'],
        concept_title: 'Range vs Range',
        concept_content:
          "Range-vs-range equity compares two entire ranges against each other — CO's opening range against BB's calling range, for example. Community cards don't affect every range equally: a flop can favor one player's collection of hands far more than the other's. This idea becomes fundamental later.",
        xp: 4,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 8 — Stacks Change Hand Value
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c8-s43',
        type: 'spr_visualizer',
        concept_ids: ['spr'],
        narrative: 'SPR = Stack-to-Pot Ratio = effective stack ÷ pot.',
        spr_visualizer_mode: 'scenario',
        spr_visualizer_pot_bb: 10,
        spr_visualizer_stack_bb: 80,
        spr_visualizer_correct: 8,
        spr_visualizer_tolerance: 0.5,
        xp: 4,
      },
      {
        id: 'c8-s44',
        type: 'spr_visualizer',
        concept_ids: ['spr'],
        narrative: 'Effective stack 30bb, pot 10bb.',
        spr_visualizer_mode: 'scenario',
        spr_visualizer_pot_bb: 10,
        spr_visualizer_stack_bb: 30,
        spr_visualizer_correct: 3,
        spr_visualizer_tolerance: 0.5,
        xp: 5,
      },
      {
        id: 'c8-s45',
        type: 'spr_visualizer',
        concept_ids: ['spr'],
        narrative: 'The same hand behaves differently depending on SPR. Browse the three broad zones below.',
        spr_visualizer_mode: 'worlds',
        xp: 3,
      },
      {
        id: 'c8-s46',
        type: 'action_sequence',
        concept_ids: ['spr'],
        narrative: 'AA, 76s, 22, AKo.',
        action_sequence_prompt: 'Which hand type gains RELATIVE value as stacks become very deep?',
        options: [
          { id: 'speculative', label: '76s / 22 — hands that can make disguised, nutted holdings', quality: 'perfect', feedback: 'Correct. Premium pairs stay powerful, but deeper stacks increase the value of hands capable of making very strong hidden hands.' },
          { id: 'aa', label: 'AA — it never loses value', quality: 'mistake', feedback: "AA remains strong, but it doesn't gain RELATIVE value the way speculative hands do as stacks get deeper." },
          { id: 'ako', label: 'AKo — top pair plays best deep', quality: 'mistake', feedback: 'One-pair hands actually become harder to play for very large pots as stacks get deeper.' },
        ],
        xp: 8,
      },

      // ══════════════════════════════════════════════════════════════════════
      // CHAPTER 9 — The Shape of a Range
      // ══════════════════════════════════════════════════════════════════════
      {
        id: 'c9-s47',
        type: 'concept_reveal',
        concept_ids: ['range_morphology'],
        concept_title: 'The Shape of a Range',
        concept_content:
          'Ranges have shapes — how the equity inside them is distributed. Three major shapes: LINEAR, POLARIZED, CONDENSED. Think of hand strength as a vertical spectrum from strongest to weakest.',
        xp: 2,
      },
      {
        id: 'c9-s48',
        type: 'concept_reveal',
        concept_ids: ['range_morphology', 'linear_range'],
        concept_title: 'Linear Range',
        concept_content: '"Best hands first." A linear range starts with the strongest hands and continues downward without deliberately skipping the medium-strength region.',
        xp: 2,
      },
      {
        id: 'c9-s49',
        type: 'concept_reveal',
        concept_ids: ['range_morphology', 'polarized_range'],
        concept_title: 'Polarized Range',
        concept_content: 'A polarized range contains very strong hands PLUS weak hands/bluffs, while many medium-strength hands are absent. Extreme version: nuts + bluffs.',
        xp: 2,
      },
      {
        id: 'c9-s50',
        type: 'concept_reveal',
        concept_ids: ['range_morphology', 'condensed_range'],
        concept_title: 'Condensed Range',
        concept_content: '"Lots of playable middle, fewer extremes." A condensed (depolarized) range is concentrated around medium-strength hands — its strongest and weakest holdings are reduced or absent.',
        xp: 2,
      },
      {
        id: 'c9-s51',
        type: 'range_morphology',
        concept_ids: ['range_morphology', 'polarized_range'],
        narrative: 'Which diagram represents a polarized range?',
        options: [
          { id: 'linear', label: 'Linear', quality: 'mistake', feedback: 'Linear ranges start strongest and continue down without a gap — not this one.' },
          { id: 'polarized', label: 'Polarized', quality: 'perfect', feedback: 'Correct — nuts plus bluffs, with the middle missing.' },
          { id: 'condensed', label: 'Condensed', quality: 'mistake', feedback: 'Condensed ranges cluster around the middle — not this one.' },
        ],
        xp: 6,
      },
      {
        id: 'c9-s52',
        type: 'concept_reveal',
        concept_ids: ['range_morphology', 'capped_range'],
        concept_title: 'Capped vs Uncapped',
        concept_content:
          "CAPPED: the action taken has removed or heavily reduced the strongest possible holdings from a player's range. UNCAPPED: the player can still credibly hold the strongest hands. A condensed range is often capped — but capped and condensed aren't identical. A range can hold many middle hands yet still keep some very strong ones on certain boards.",
        xp: 2,
      },
      {
        id: 'c9-s53',
        type: 'range_morphology',
        concept_ids: ['range_morphology', 'capped_range'],
        narrative: '"Player can still have all sets and straights on this board."',
        options: [
          { id: 'uncapped', label: 'Uncapped', quality: 'perfect', feedback: 'Correct — the range can still reach the very top of possible hands.' },
          { id: 'capped', label: 'Capped', quality: 'mistake', feedback: "A capped range has lost access to the strongest holdings — here it clearly hasn't." },
        ],
        xp: 6,
      },
      {
        id: 'c9-s54',
        type: 'concept_reveal',
        concept_ids: ['range_morphology'],
        concept_title: 'Models, Not Absolutes',
        concept_content:
          'Real ranges often combine characteristics — mostly linear with a polarized edge, or condensed with a few nutted combos still live. These labels are models that help us understand structure, not rigid boxes every range fits perfectly.',
        xp: 2,
      },
      {
        id: 'c9-s55',
        type: 'concept_reveal',
        concept_ids: ['table_position', 'range_thinking', 'spr', 'range_morphology'],
        board: ['As', '8d', '3c'],
        concept_title: 'Putting It All Together',
        concept_content:
          "CO raises, BB calls. Flop: A♠8♦3♣. Before any action, a strong player is already asking: Who has POSITION? What's the EFFECTIVE STACK? How deep is the POT/SPR? What RANGES can each player have? How does the BOARD interact with those ranges? What EQUITY does each side own? Is either RANGE SHAPE linear, polarized, condensed, capped, or uncapped? We aren't solving this hand yet — the goal is knowing what a strong player starts thinking about.",
        xp: 6,
      },

      // ── Final Challenge — 10 mixed-review questions ─────────────────────
      {
        id: 'c9-fc1',
        type: 'position_table',
        concept_ids: ['table_position'],
        position_table_mode: 'quiz',
        position_table_highlight: ['CO', 'BTN', 'SB'],
        position_table_prompt: 'Which seat sits immediately before the Button?',
        options: [
          { id: 'CO', label: 'CO', quality: 'perfect', feedback: 'Correct — CO is the seat directly before BTN.' },
          { id: 'BTN', label: 'BTN', quality: 'mistake', feedback: 'BTN is the button itself, not the seat before it.' },
          { id: 'SB', label: 'SB', quality: 'mistake', feedback: 'SB is after the button, not before it.' },
        ],
        xp: 10,
      },
      {
        id: 'c9-fc2',
        type: 'action_sequence',
        concept_ids: ['ip_oop'],
        narrative: 'HJ vs CO, postflop.',
        action_sequence_prompt: 'Who is in position?',
        options: [
          { id: 'co', label: 'CO', quality: 'perfect', feedback: 'Correct — CO acts after HJ on every postflop street.' },
          { id: 'hj', label: 'HJ', quality: 'mistake', feedback: 'HJ acts before CO postflop — HJ is out of position here.' },
        ],
        xp: 10,
      },
      {
        id: 'c9-fc3',
        type: 'action_sequence',
        concept_ids: ['effective_stack'],
        narrative: 'Hero: 60bb. Villain: 95bb.',
        action_sequence_prompt: 'What is the effective stack?',
        options: [
          { id: '60', label: '60bb', quality: 'perfect', feedback: 'Correct — the effective stack is always the smaller of the two.' },
          { id: '95', label: '95bb', quality: 'mistake', feedback: "That's Villain's stack, but Villain can't extract more than Hero has." },
          { id: '35', label: '35bb', quality: 'mistake', feedback: "That's the difference between the stacks, not the effective stack." },
        ],
        xp: 10,
      },
      {
        id: 'c9-fc4',
        type: 'action_sequence',
        concept_ids: ['rfi'],
        narrative: 'Folded to CO, who raises.',
        action_sequence_prompt: 'What is this action called?',
        options: [
          { id: 'rfi', label: 'RFI / open raise', quality: 'perfect', feedback: 'Correct.' },
          { id: 'squeeze', label: 'Squeeze', quality: 'mistake', feedback: 'A squeeze requires a prior raise AND a call — nothing has happened yet here.' },
        ],
        xp: 10,
      },
      {
        id: 'c9-fc5',
        type: 'action_sequence',
        concept_ids: ['squeeze'],
        narrative: 'HJ raises. BTN calls. SB 3-bets.',
        action_sequence_display: ['HJ raises', 'BTN calls', 'SB 3-bets'],
        action_sequence_prompt: "What is SB's action called?",
        options: [
          { id: 'squeeze', label: 'Squeeze', quality: 'perfect', feedback: 'Correct — a 3-bet after a raise and a call.' },
          { id: 'resteal', label: 'Resteal', quality: 'mistake', feedback: 'A resteal is a 3-bet specifically against a steal attempt, not this pattern.' },
        ],
        xp: 10,
      },
      {
        id: 'c9-fc6',
        type: 'action_sequence',
        concept_ids: ['action_lines'],
        action_sequence_prompt: 'Translate "b/b" across two streets.',
        options: [
          { id: 'bet_bet', label: 'Bet flop, bet turn', quality: 'perfect', feedback: 'Correct.' },
          { id: 'bet_call', label: 'Bet flop, call turn', quality: 'mistake', feedback: 'Both letters are "b" — bet on both streets.' },
        ],
        xp: 10,
      },
      {
        id: 'c9-fc7',
        type: 'range_heatmap',
        concept_ids: ['range_thinking', 'combinatorics'],
        narrative: 'Tap AA, KQs, and 76o on the grid.',
        range_heatmap_target: ['AA', 'KQs', '76o'],
        xp: 10,
      },
      {
        id: 'c9-fc8',
        type: 'combo_visualizer',
        concept_ids: ['combinatorics'],
        narrative: 'How many combinations of QQ exist, before any removal?',
        combo_visualizer_mode: 'quiz',
        combo_visualizer_kind: 'pair',
        combo_visualizer_subject: 'Q',
        combo_visualizer_correct: 6,
        xp: 10,
      },
      {
        id: 'c9-fc9',
        type: 'spr_visualizer',
        concept_ids: ['spr'],
        narrative: 'Pot 20bb, effective stack 60bb.',
        spr_visualizer_mode: 'scenario',
        spr_visualizer_pot_bb: 20,
        spr_visualizer_stack_bb: 60,
        spr_visualizer_correct: 3,
        spr_visualizer_tolerance: 0.5,
        xp: 10,
      },
      {
        id: 'c9-fc10',
        type: 'range_morphology',
        concept_ids: ['range_morphology', 'capped_range'],
        narrative: '"This range has folded out its strongest value hands after check-calling twice."',
        options: [
          { id: 'capped', label: 'Capped', quality: 'perfect', feedback: 'Correct — the strongest holdings are gone from this line, so the range is capped.' },
          { id: 'uncapped', label: 'Uncapped', quality: 'mistake', feedback: 'This range has lost its strongest hands through the action — that makes it capped, not uncapped.' },
          { id: 'polarized', label: 'Polarized (unrelated axis)', quality: 'acceptable', feedback: 'Capped/uncapped is a separate axis from polarized/linear/condensed — this scenario is specifically about capping.' },
        ],
        xp: 12,
      },
    ],
  },
]

// ── Derived lookup maps ───────────────────────────────────────────────────────

export const LESSONS_BY_SLUG: Record<string, Lesson> =
  Object.fromEntries(LESSONS.map((l) => [l.slug, l]))

export const MODULES_BY_SLUG: Record<string, LearningModule> =
  Object.fromEntries(LEARNING_MODULES.map((m) => [m.slug, m]))

/** module_id → lessons in that module */
export const LESSONS_BY_MODULE: Record<string, Lesson[]> =
  LESSONS.reduce<Record<string, Lesson[]>>((acc, l) => {
    if (!acc[l.module_id]) acc[l.module_id] = []
    acc[l.module_id].push(l)
    return acc
  }, {})

/** path_id → modules in that path */
export const MODULES_BY_PATH: Record<string, LearningModule[]> =
  LEARNING_MODULES.reduce<Record<string, LearningModule[]>>((acc, m) => {
    if (!acc[m.path_id]) acc[m.path_id] = []
    acc[m.path_id].push(m)
    return acc
  }, {})
