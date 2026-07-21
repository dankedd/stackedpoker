/**
 * Poker Learning Platform — Static Curriculum Data
 *
 * This file is the source of truth for all learning paths, modules, and lessons.
 * Types are imported from ./types; do not redefine them here.
 */

import type { LearningPath, LearningModule, Lesson } from './types'
import { ROADMAP_MODULES } from './curriculumRoadmap'

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

// The two live Poker Journey modules (Stage 1 — Foundations). Modules 3–28
// are roadmap-only and live in ./curriculumRoadmap — see JOURNEY_STAGES there
// for how all 28 are grouped into the 13 Poker Journey stages.
export const LEARNING_MODULES: LearningModule[] = [
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
    subtitle: 'The language, structure, and building blocks behind every poker decision.',
    learningObjectives: [
      'Speak the language of position, streets, and action lines',
      'Think in ranges instead of guessing a single hand',
      'Use combinatorics, card removal, and SPR to reason about a hand',
    ],
    difficulty: 'beginner',
    estimatedLessons: 1,
    stageId: 'foundations',
    order: 1,
    contentStatus: 'complete',
    access: 'free',
  },
  {
    id: 'math-foundations-module',
    path_id: 'beginner',
    slug: 'math-foundations-module',
    title: 'The Math Behind Every Decision',
    description: 'Learn how risk, reward, probability and long-term value determine the right poker decision.',
    concept_ids: [
      'pot_odds', 'outs_probability', 'equity', 'expected_value', 'fold_equity', 'equity_realization',
    ],
    unlock_after: ['poker-fundamentals-module'],
    sort_order: 1,
    xp_reward: 600,
    subtitle: 'Learn how risk, reward, probability and long-term value determine the right poker decision.',
    learningObjectives: [
      'Price a call using pot odds and required equity',
      'Count outs and estimate drawing probability under time pressure',
      'Reason in expected value, fold equity, and equity realization',
    ],
    difficulty: 'beginner',
    estimatedLessons: 6,
    stageId: 'foundations',
    order: 2,
    prerequisiteModuleId: 'poker-fundamentals-module',
    contentStatus: 'complete',
    access: 'free',
  },
  ...ROADMAP_MODULES,
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
        board: ['9d', '8h', '7d'],
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
        board: ['9d', '8h', '7d', '9h'],
        hero_hand: ['Jc', 'Tc'],
        narrative: 'The turn brings the 9♥.',
        action_sequence_prompt: 'Is J-T still the nuts?',
        options: [
          { id: 'no', label: 'No', quality: 'perfect', feedback: 'Correct — the paired board makes full houses possible. A hand such as 88 can now make a full house, which beats your straight. The nuts have changed.' },
          { id: 'yes', label: 'Yes', quality: 'mistake', feedback: 'The paired board makes full houses possible — a hand such as 88 now makes a full house, which beats your straight. JT is no longer the nuts.' },
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
        concept_ids: ['draws_equity', 'equity', 'hand_vs_range'],
        narrative:
          'Equity is your share of the pot based on how often your hand would win or tie if the remaining cards were dealt with no more betting.',
        hero_hand: ['As', 'Ks'],
        board: ['Kd', '8c', '4h'],
        // Villain's continuing range on this K84 flop: two sets (strong made hands),
        // three worse-kicker top pairs, three pocket pairs that missed, and two
        // fully-missed suited broadways — a deliberate mix for a hand-vs-range read.
        equity_villain_range: [
          '88', '44',
          'KQs', 'KQo', 'KJs', 'KJo', 'KTs', 'KTo',
          'JJ', 'TT', '99',
          'QJs', 'JTs',
        ],
        equity_actual: 80,
        equity_tolerance: 5,
        correct_feedback: 'Right in the zone — Hero dominates most of this range.',
        wrong_feedback: 'Not quite — see the breakdown below.',
        equity_explanation:
          "A♠K♠ is top pair with the best possible kicker, so it's ahead of every other top pair in Villain's range — KQ, KJ, and KT all have a worse kicker than Hero's ace. It's also ahead of every pocket pair that missed the board (JJ, TT, 99) and the fully whiffed suited broadways (QJ, JT). The only hands that beat Hero are the two sets, 88 and 44 — a small slice of combos, which is why Hero's equity is high but well short of 100%.",
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
          { id: 'polarized', label: 'Polarized', quality: 'perfect', feedback: 'A polarized range concentrates around the extremes: very strong hands and weak hands/bluffs, while much of the medium-strength region is missing.' },
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

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE 2 — The Math Behind Every Decision
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'the-price-of-a-call',
    module_id: 'math-foundations-module',
    slug: 'the-price-of-a-call',
    title: 'The Price of a Call',
    subtitle: 'Every call is a risk-versus-reward decision — learn to price it before you look at your cards.',
    lesson_type: 'micro',
    concept_ids: ['pot_odds', 'risk_reward', 'required_equity', 'break_even'],
    estimated_min: 12,
    xp_reward: 150,
    sort_order: 1,
    next_lesson_teaser: 'Count Your Ways to Win',
    steps: [
      {
        id: 'poc-s1',
        type: 'pot_odds_explorer',
        concept_ids: ['risk_reward'],
        pot_odds_explorer_mode: 'fixed',
        narrative: "Before looking at your cards, what does calling cost — and what can you win?",
        pot_odds_pot: 100,
        pot_odds_bet: 100,
        xp: 5,
      },
      {
        id: 'poc-s2',
        type: 'concept_reveal',
        concept_ids: ['pot_odds'],
        concept_title: 'Pot Odds',
        concept_content:
          "Pot odds compare what you must risk with what you can win. Risking 100 to win 200 is a 1:2 ratio. As a percentage, that's call ÷ final pot — 100 ÷ 300 — so Hero needs about 33.3% equity for the call to break even.",
        visual: 'equity_bar',
        xp: 5,
      },
      {
        id: 'poc-s3',
        type: 'pot_odds_explorer',
        concept_ids: ['required_equity'],
        pot_odds_explorer_mode: 'build',
        narrative: 'Watch the pot build as Villain bets and Hero calls.',
        pot_odds_pot: 100,
        pot_odds_bet: 50,
        pot_odds_prompt: 'What percentage of the final pot is Hero risking?',
        pot_odds_correct: 25,
        pot_odds_tolerance: 2,
        correct_feedback: 'Hero risks 50 of the 200-chip final pot — 25%. That is exactly the equity Hero needs.',
        xp: 8,
      },
      {
        id: 'poc-s4',
        type: 'pot_odds_explorer',
        concept_ids: ['pot_odds'],
        pot_odds_explorer_mode: 'slider',
        narrative: "Drag Villain's bet size and watch the required equity move with it.",
        pot_odds_pot: 100,
        pot_odds_slider_sizes: [25, 33, 50, 75, 100, 150, 200],
        xp: 6,
      },
      {
        id: 'poc-s5',
        type: 'decision_spot',
        concept_ids: ['required_equity'],
        narrative:
          'Pot = 100. BET A = 25. BET B = 100. Which bet requires Hero to have MORE equity to call?',
        options: [
          { id: 'bet_a', label: 'Bet A — 25', quality: 'mistake', feedback: 'Bet A is the smaller bet — it requires LESS equity to call, not more.' },
          { id: 'bet_b', label: 'Bet B — 100', quality: 'perfect', feedback: 'Correct — the larger the bet, the more Hero risks relative to the reward, so Bet B needs more equity.' },
        ],
        xp: 6,
      },
      {
        id: 'poc-s6a',
        type: 'pot_odds_explorer',
        concept_ids: ['pot_odds', 'required_equity'],
        pot_odds_explorer_mode: 'challenge',
        pot_odds_pot: 60,
        pot_odds_bet: 30,
        pot_odds_prompt: 'What equity does Hero need to call here?',
        pot_odds_correct: 25,
        pot_odds_tolerance: 2,
        xp: 8,
      },
      {
        id: 'poc-s6b',
        type: 'pot_odds_explorer',
        concept_ids: ['pot_odds', 'required_equity'],
        pot_odds_explorer_mode: 'challenge',
        pot_odds_pot: 100,
        pot_odds_bet: 100,
        pot_odds_prompt: 'What equity does Hero need to call here?',
        pot_odds_correct: 33.3,
        pot_odds_tolerance: 1.5,
        xp: 8,
      },
      {
        id: 'poc-s6c',
        type: 'pot_odds_explorer',
        concept_ids: ['pot_odds', 'required_equity'],
        pot_odds_explorer_mode: 'challenge',
        pot_odds_pot: 100,
        pot_odds_bet: 50,
        pot_odds_prompt: 'What equity does Hero need to call here?',
        pot_odds_correct: 25,
        pot_odds_tolerance: 2,
        xp: 8,
      },
      {
        id: 'poc-s7',
        type: 'concept_reveal',
        concept_ids: ['break_even'],
        concept_title: 'Break-Even',
        concept_content:
          "If Hero's equity exactly equals the required equity from pot odds, calling neither wins nor loses value long-run. More equity than required makes the call profitable. Less makes it a loser — no matter how this particular hand turns out.",
        visual: 'equity_bar',
        xp: 5,
      },
      {
        id: 'poc-s8',
        type: 'equity_balance',
        concept_ids: ['break_even', 'required_equity'],
        narrative: 'Pot 100. Villain bets 50. Hero finally looks down at their hand.',
        equity_balance_required: 25,
        equity_balance_actual: 32,
        equity_balance_prompt: 'Call or fold?',
        options: [
          { id: 'call', label: 'CALL', quality: 'perfect', feedback: "Correct — Hero needs 25% equity and has 32%. The call clears the break-even threshold." },
          { id: 'fold', label: 'FOLD', quality: 'mistake', feedback: "Hero's 32% equity clears the 25% required threshold — folding here gives up a profitable call." },
        ],
        xp: 10,
      },
    ],
  },

  {
    id: 'count-your-ways-to-win',
    module_id: 'math-foundations-module',
    slug: 'count-your-ways-to-win',
    title: 'Count Your Ways to Win',
    subtitle: 'Turn your outs into a real probability — and learn why the quick shortcuts are only estimates.',
    lesson_type: 'micro',
    concept_ids: ['outs_probability', 'clean_outs', 'dead_outs', 'drawing_probability'],
    estimated_min: 14,
    xp_reward: 170,
    sort_order: 2,
    next_lesson_teaser: 'Your Share of the Pot',
    steps: [
      {
        id: 'cyw-s1',
        type: 'outs_deck',
        concept_ids: ['outs_probability'],
        outs_deck_mode: 'count_outs',
        narrative: 'Hero holds a flush draw. Count every remaining heart in the deck.',
        hero_hand: ['Qh', 'Jh'],
        board: ['Ac', '8h', '7h'],
        outs_deck_out_cards: ['Ah', 'Kh', 'Th', '9h', '6h', '5h', '4h', '3h', '2h'],
        xp: 8,
      },
      {
        id: 'cyw-s2',
        type: 'concept_reveal',
        concept_ids: ['outs_probability'],
        concept_title: '47 Unseen Cards',
        concept_content:
          "After Hero's 2 hole cards and the 3 flop cards, 47 cards remain unseen. With 9 clean outs among them, roughly 9 of every 47 unseen cards complete the draw on the very next card.",
        visual: 'heatmap',
        xp: 5,
      },
      {
        id: 'cyw-s3',
        type: 'outs_deck',
        concept_ids: ['drawing_probability'],
        outs_deck_mode: 'next_card',
        narrative: 'Same flush draw — now put a number on it.',
        hero_hand: ['Qh', 'Jh'],
        board: ['Ac', '8h', '7h'],
        outs_deck_out_cards: ['Ah', 'Kh', 'Th', '9h', '6h', '5h', '4h', '3h', '2h'],
        outs_deck_question: 'Approximately how often does one of these outs arrive on the very next card?',
        outs_deck_correct: 19.1,
        outs_deck_tolerance: 2,
        correct_feedback: "9 outs ÷ 47 unseen cards ≈ 19.1% — just under a 1-in-5 chance on the next card alone.",
        xp: 8,
      },
      {
        id: 'cyw-s4',
        type: 'outs_deck',
        concept_ids: ['drawing_probability'],
        outs_deck_mode: 'turn_river',
        narrative:
          'One card is a 19% shot. But Hero actually gets TWO chances — the turn and the river. Missing both is the only way the draw dies.',
        hero_hand: ['Qh', 'Jh'],
        board: ['Ac', '8h', '7h'],
        outs_deck_out_cards: ['Ah', 'Kh', 'Th', '9h', '6h', '5h', '4h', '3h', '2h'],
        xp: 6,
      },
      {
        id: 'cyw-s5',
        type: 'concept_reveal',
        concept_ids: ['drawing_probability'],
        concept_title: 'Quick Table Estimate',
        concept_content:
          "A fast shortcut: with one card to come, outs × 2 approximates your percentage. With two cards to come, outs × 4. It's a mental-math shortcut, not the exact number — and it drifts further from reality as your out count grows.",
        xp: 5,
      },
      {
        id: 'cyw-s6',
        type: 'outs_deck',
        concept_ids: ['drawing_probability'],
        outs_deck_mode: 'quick_estimate',
        narrative: 'Compare the shortcut to the exact math for this same 9-out flush draw.',
        hero_hand: ['Qh', 'Jh'],
        board: ['Ac', '8h', '7h'],
        outs_deck_out_cards: ['Ah', 'Kh', 'Th', '9h', '6h', '5h', '4h', '3h', '2h'],
        xp: 6,
      },
      {
        id: 'cyw-s7a',
        type: 'outs_deck',
        concept_ids: ['outs_probability', 'drawing_probability'],
        outs_deck_mode: 'speed_round',
        narrative: 'Speed round — flush draw, one card to come.',
        outs_deck_outs_count: 9,
        outs_deck_question: "What's the chance of hitting on the very next card?",
        outs_deck_correct: 19.1,
        outs_deck_tolerance: 2,
        xp: 6,
      },
      {
        id: 'cyw-s7b',
        type: 'outs_deck',
        concept_ids: ['outs_probability', 'drawing_probability'],
        outs_deck_mode: 'speed_round',
        narrative: 'Speed round — open-ended straight draw, one card to come.',
        outs_deck_outs_count: 8,
        outs_deck_question: "What's the chance of hitting on the very next card?",
        outs_deck_correct: 17.0,
        outs_deck_tolerance: 2,
        xp: 6,
      },
      {
        id: 'cyw-s7c',
        type: 'outs_deck',
        concept_ids: ['outs_probability', 'drawing_probability'],
        outs_deck_mode: 'speed_round',
        narrative: 'Speed round — gutshot straight draw, one card to come.',
        outs_deck_outs_count: 4,
        outs_deck_question: "What's the chance of hitting on the very next card?",
        outs_deck_correct: 8.5,
        outs_deck_tolerance: 2,
        xp: 6,
      },
      {
        id: 'cyw-s8',
        type: 'outs_deck',
        concept_ids: ['clean_outs', 'dead_outs'],
        outs_deck_mode: 'clean_dirty',
        narrative:
          "Hero has an open-ended straight draw. But the board already shows three hearts — so any out that's ALSO a heart hands Villain a possible flush instead. Tap through: how many of these 8 outs are actually clean?",
        hero_hand: ['9s', '8s'],
        board: ['Th', '7h', '2h'],
        outs_deck_out_cards: ['6c', '6d', '6h', '6s', 'Jc', 'Jd', 'Jh', 'Js'],
        outs_deck_dead_out_cards: ['6h', 'Jh'],
        outs_deck_question: 'How many of these 8 outs are clean?',
        outs_deck_correct: 6,
        outs_deck_tolerance: 0.5,
        correct_feedback: '8 nominal outs, but 6h and Jh complete a heart flush for Villain too — only 6 are clean.',
        xp: 10,
      },
      {
        id: 'cyw-s9',
        type: 'outs_deck',
        concept_ids: ['outs_probability'],
        outs_deck_mode: 'backdoor',
        narrative:
          'Hero holds one spade. The board shows one more. A backdoor flush needs BOTH the turn and river to bring spades — weak alone, but not worthless.',
        hero_hand: ['Ks', 'Qc'],
        board: ['9s', '5h', '2c'],
        xp: 6,
      },
      {
        id: 'cyw-s10',
        type: 'decision_spot',
        concept_ids: ['drawing_probability', 'required_equity'],
        narrative:
          "Hero has a flush draw. Pot odds require 25% equity to call. The one-card drawing probability is about 19%. Based only on that number, is calling priced in?",
        options: [
          {
            id: 'not_alone',
            label: "No, 19% falls short — but that single number isn't the whole story",
            quality: 'perfect',
            feedback: 'Right. 19% one-card odds are below the 25% required — but Hero still has two cards to come, possible backdoor outs, and implied odds that a single number never captures.',
          },
          {
            id: 'yes_enough',
            label: 'Yes — 19% is close enough to call',
            quality: 'mistake',
            feedback: "19% is below the 25% pot odds require. On this number alone, the price isn't met.",
          },
          {
            id: 'always_equal',
            label: "Doesn't matter — drawing % always equals total equity",
            quality: 'punt',
            feedback: 'Careful — drawing probability is only one input into equity. Dead outs, implied odds, and future streets all matter too.',
          },
        ],
        xp: 8,
      },
      {
        id: 'cyw-f1',
        type: 'outs_deck',
        concept_ids: ['clean_outs', 'dead_outs'],
        outs_deck_mode: 'clean_dirty',
        narrative:
          'Mixed challenge. Same idea, different suit: Hero has an open-ended straight draw, and the board already shows three diamonds.',
        hero_hand: ['9d', '8d'],
        board: ['Td', '7d', '2d'],
        outs_deck_out_cards: ['6c', '6d', '6h', '6s', 'Jc', 'Jd', 'Jh', 'Js'],
        outs_deck_dead_out_cards: ['6d', 'Jd'],
        outs_deck_question: 'How many of these 8 outs are clean?',
        outs_deck_correct: 6,
        outs_deck_tolerance: 0.5,
        xp: 8,
      },
      {
        id: 'cyw-f2',
        type: 'decision_spot',
        concept_ids: ['drawing_probability', 'required_equity'],
        narrative:
          'Mixed challenge. Hero has 7 clean outs with one card to come. Pot odds here require 15% equity. Is the call priced in on the one-card number alone?',
        options: [
          {
            id: 'just_short',
            label: 'No — 7/47 (≈14.9%) is just under the 15% needed',
            quality: 'perfect',
            feedback: '7 ÷ 47 ≈ 14.9% — a hair below the 15% required. Extremely close, but technically short on this number alone.',
          },
          {
            id: 'close_enough',
            label: 'Yes — it is close enough, call',
            quality: 'acceptable',
            feedback: "14.9% is razor-close to 15% — in practice other factors (implied odds, extra outs) could easily tip this into a call, but the raw number is just short.",
          },
          {
            id: 'irrelevant',
            label: "Outs aren't relevant to this decision",
            quality: 'punt',
            feedback: 'Outs and their drawing probability are exactly what this decision hinges on.',
          },
        ],
        xp: 8,
      },
      {
        id: 'cyw-f3',
        type: 'outs_deck',
        concept_ids: ['drawing_probability'],
        outs_deck_mode: 'speed_round',
        narrative: 'Final question: this time Hero sees BOTH the turn and river with no bet in between.',
        outs_deck_outs_count: 9,
        outs_deck_question: "What's the chance of hitting by the river (two cards to come)?",
        outs_deck_correct: 35.0,
        outs_deck_tolerance: 3,
        correct_feedback: 'Two cards to come raises a 9-out draw from ~19% to ~35% — nearly double, not because of a shortcut, but because there are two chances to hit.',
        xp: 10,
      },
    ],
  },

  {
    id: 'your-share-of-the-pot',
    module_id: 'math-foundations-module',
    slug: 'your-share-of-the-pot',
    title: 'Your Share of the Pot',
    subtitle: "Equity only exists relative to an opponent — hand, range, or another range.",
    lesson_type: 'micro',
    concept_ids: ['equity', 'hand_vs_hand_equity', 'hand_vs_range_equity', 'range_vs_range_equity', 'range_weighting'],
    estimated_min: 13,
    xp_reward: 160,
    sort_order: 3,
    next_lesson_teaser: 'Think in Expected Value',
    steps: [
      {
        id: 'ysp-s1',
        type: 'concept_reveal',
        concept_ids: ['equity'],
        concept_title: 'Equity, Recapped',
        concept_content:
          "Equity is the share of the pot a hand or range expects to own, based on how often it wins or ties at showdown. A 100-chip pot with 60% equity is worth 60 chips on average, over time.",
        visual: 'equity_bar',
        xp: 5,
      },
      {
        id: 'ysp-s2',
        type: 'decision_spot',
        concept_ids: ['equity'],
        narrative:
          "Rock beats scissors. Scissors beats paper. Paper beats rock. Is any one of the three simply 'the best' on its own?",
        options: [
          {
            id: 'none',
            label: 'No — strength only exists relative to what it faces',
            quality: 'perfect',
            feedback: "Exactly. Just like these three, a poker hand's equity only means something once you specify what it's up against — there's no equity number in isolation.",
          },
          {
            id: 'rock',
            label: 'Yes — rock is always the strongest',
            quality: 'mistake',
            feedback: "None of the three wins in every matchup — and neither does any single poker hand. Equity is always relative to an opponent.",
          },
        ],
        xp: 6,
      },
      {
        id: 'ysp-s3',
        type: 'equity_predict',
        concept_ids: ['hand_vs_hand_equity'],
        narrative: "Hero's A-K faces Villain's pocket Queens, all-in before the flop.",
        hero_hand: ['As', 'Kd'],
        equity_villain_range: ['QQ'],
        equity_actual: 43,
        equity_tolerance: 6,
        equity_explanation: 'A-K vs Q-Q is a classic race: two cards higher than a pair beats it just often enough to sit in the low-40s — close to a coin flip, but not quite.',
        xp: 8,
      },
      {
        id: 'ysp-s4',
        type: 'equity_predict',
        concept_ids: ['hand_vs_range_equity'],
        narrative: "Now Hero's A-K faces Villain's entire continuing range on this board — not one specific hand.",
        hero_hand: ['As', 'Kd'],
        board: ['Kc', '8h', '4d'],
        equity_villain_range: ['AA', '88', '44', 'AKs', 'AKo', 'AQs', 'AQo', 'KQs', 'KQo', 'QQ', 'JJ', 'TT', '99', '77', '66', '55'],
        equity_actual: 76,
        equity_tolerance: 6,
        equity_explanation: "Counting combos: Hero's top pair/top kicker beats KQ, QQ, JJ, TT, 99, 77, 66, 55 (58 combos) and loses only to AA and the two flopped sets, 88 and 44 (18 combos) — about 58 of 76, or 76%.",
        xp: 10,
      },
      {
        id: 'ysp-s5',
        type: 'range_compare',
        concept_ids: ['range_weighting'],
        narrative: "Same Hero hand and board. Two different Villain ranges.",
        hero_hand: ['As', 'Kd'],
        board: ['Kc', '8h', '4d'],
        range_compare_a: {
          label: 'Range A — wide, lots of weaker hands',
          range: ['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AKo','AQs','AQo','AJs','AJo','ATs','KQs','KQo','A9s','A8s','A5s','A4s','A3s','A2s','76s','65s','54s'],
        },
        range_compare_b: {
          label: 'Range B — narrow, mostly premium hands',
          range: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs'],
        },
        range_compare_prompt: "Against which range does Hero's A-K have MORE equity?",
        options: [
          { id: 'range_a', label: 'Range A (wide)', quality: 'perfect', feedback: 'Correct — Range A is stuffed with hands A-K dominates or flips with, so it pulls Hero\'s overall equity up despite containing the same premium combos.' },
          { id: 'range_b', label: 'Range B (narrow)', quality: 'mistake', feedback: 'Range B is smaller but denser with hands that beat or flip with A-K — Hero\'s equity is actually LOWER against it, not higher.' },
        ],
        xp: 10,
      },
      {
        id: 'ysp-s6',
        type: 'decision_spot',
        concept_ids: ['range_weighting'],
        narrative:
          "Villain's range is exactly {AA, AKs, AKo}. AA = 6 combos. AKs = 4 combos. AKo = 12 combos. How many total combinations is that?",
        options: [
          { id: '22', label: '22 combos', quality: 'perfect', feedback: '6 + 4 + 12 = 22. Villain plays AKo almost twice as often as AKs, even though they look like "the same hand" in shorthand.' },
          { id: '3', label: '3 combos', quality: 'mistake', feedback: '3 just counts the hand-types listed — the actual combinatorics behind them add up to 22, weighted very unevenly.' },
          { id: '12', label: '12 combos', quality: 'acceptable', feedback: "12 is AKo's combo count alone — AA and AKs still add 6 and 4 more on top of that." },
        ],
        xp: 8,
      },
      {
        id: 'ysp-s7',
        type: 'range_compare',
        concept_ids: ['range_vs_range_equity'],
        narrative: 'CO opens, BB defends. The flop comes Qc Jc 2d — two clubs, both broadway cards.',
        board: ['Qc', 'Jc', '2d'],
        range_compare_a: {
          label: 'CO range (opens)',
          range: ['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AKo','AQs','AQo','AJs','AJo','ATs','ATo','KQs','KQo','KJs','KJo','KTs','QJs','QJo','QTs','JTs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','K9s','Q9s','J9s','T9s','98s','87s','76s','65s','54s'],
        },
        range_compare_b: {
          label: 'BB range (defends)',
          range: ['22','33','44','55','66','77','88','99','TT','JJ','QQ','AJo','ATo','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KTo','K9s','K8s','QTo','Q9s','J9s','J8s','T9s','T8s','98s','97s','87s','76s','65s','54s','43s','KQo','KJo','QJo','JTo'],
        },
        range_compare_prompt: 'Whose range gains more equity on this broadway-heavy flop?',
        options: [
          { id: 'co', label: "CO's range", quality: 'perfect', feedback: "Correct — CO's opening range is loaded with broadway combos (AQ, AJ, KQ, KJ, QJ...) that connect hard with Q-J-2, while BB's flatting range leans more on smaller cards here." },
          { id: 'bb', label: "BB's range", quality: 'mistake', feedback: "BB's calling range leans on smaller and suited hands — a broadway-heavy flop like this actually favors CO's range, not BB's." },
        ],
        xp: 10,
      },
      {
        id: 'ysp-s8',
        type: 'decision_spot',
        concept_ids: ['equity'],
        narrative: 'Hero has 40% raw equity in a hand that is still being played.',
        options: [
          {
            id: 'no',
            label: 'No — that does not guarantee 40% of the pot',
            quality: 'perfect',
            feedback: "Correct. Equity is a showdown-only number. Future betting can force Hero to fold before ever reaching showdown — the next lessons cover exactly how much of that equity gets captured.",
          },
          {
            id: 'yes',
            label: 'Yes — Hero will capture exactly 40% of the pot',
            quality: 'mistake',
            feedback: 'Not quite — betting, folding, and position all change how much of that raw equity Hero actually converts into chips.',
          },
        ],
        xp: 8,
      },
    ],
  },

  {
    id: 'think-in-expected-value',
    module_id: 'math-foundations-module',
    slug: 'think-in-expected-value',
    title: 'Think in Expected Value',
    subtitle: 'Judge decisions by what they earn over time, not by what happened this one time.',
    lesson_type: 'micro',
    concept_ids: ['expected_value', 'positive_ev', 'negative_ev', 'zero_ev', 'decision_quality'],
    estimated_min: 16,
    xp_reward: 220,
    sort_order: 4,
    next_lesson_teaser: 'Winning Without Showdown',
    steps: [
      {
        id: 'ev-s1',
        type: 'decision_spot',
        concept_ids: ['decision_quality'],
        narrative:
          'DECISION A: a mathematically correct call. The river misses. Hero loses. DECISION B: a terrible call by the numbers. The river hits. Hero wins. Which player made the better DECISION?',
        options: [
          { id: 'a', label: 'Player A', quality: 'perfect', feedback: 'Correct — A made the better decision. Winning or losing one hand doesn\'t change whether a call was mathematically right. Good decision ≠ guaranteed win; bad decision ≠ guaranteed loss.' },
          { id: 'b', label: 'Player B', quality: 'mistake', feedback: 'B won this one hand, but the decision itself was -EV — repeated many times, that same call loses money.' },
        ],
        xp: 8,
      },
      {
        id: 'ev-s2',
        type: 'concept_reveal',
        concept_ids: ['expected_value'],
        concept_title: 'Expected Value',
        concept_content:
          "EV is the average result an action produces if the exact same situation repeated many times. Any single result can swing either way — but the more times a decision repeats, the closer the average outcome converges to its true EV.",
        visual: 'pressure_chart',
        xp: 5,
      },
      {
        id: 'ev-s3a',
        type: 'decision_spot',
        concept_ids: ['positive_ev'],
        narrative: 'This action nets +30 chips on average, every time it repeats. How would you classify it?',
        options: [
          { id: 'positive', label: '+EV', quality: 'perfect', feedback: 'Correct — a positive average result over repetition is exactly what +EV means.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: 'A 0 EV action nets nothing on average — this one nets +30.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: 'A -EV action loses on average — this one gains +30.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-s3b',
        type: 'decision_spot',
        concept_ids: ['zero_ev'],
        narrative: 'This action nets exactly 0 chips on average, every time it repeats. How would you classify it?',
        options: [
          { id: 'zero', label: '0 EV', quality: 'perfect', feedback: 'Correct — break-even on average is the definition of 0 EV: no gain, no loss, long-run.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: 'A +EV action gains on average — this one nets exactly 0.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: 'A -EV action loses on average — this one nets exactly 0.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-s3c',
        type: 'decision_spot',
        concept_ids: ['negative_ev'],
        narrative: 'This action nets -15 chips on average, every time it repeats. How would you classify it?',
        options: [
          { id: 'negative', label: '-EV', quality: 'perfect', feedback: 'Correct — a negative average result over repetition is exactly what -EV means.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: 'A +EV action gains on average — this one loses -15.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: 'A 0 EV action breaks even on average — this one loses -15.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-s4',
        type: 'decision_spot',
        concept_ids: ['expected_value'],
        narrative:
          "Hero has already put 30bb into this pot on earlier streets. Facing a new 20bb bet now, does that earlier investment make calling correct?",
        options: [
          { id: 'no', label: 'No — only the new risk and reward matter', quality: 'perfect', feedback: "Correct. Chips already in the pot aren't Hero's anymore. From this decision point, folding is always 0 EV — only the NEW call and its payoff matter." },
          { id: 'yes', label: 'Yes — Hero is already committed', quality: 'mistake', feedback: "That's sunk-cost thinking. Previous investment doesn't make a bad future investment good." },
        ],
        xp: 8,
      },
      {
        id: 'ev-s5',
        type: 'ev_tree',
        concept_ids: ['expected_value'],
        narrative: 'A simple call. Combine each branch — probability × payoff — to find the total EV.',
        ev_tree_root_label: 'CALL',
        ev_tree_branches: [
          { label: 'WIN', probability: 0.4, payoff: 150 },
          { label: 'LOSE', probability: 0.6, payoff: -50 },
        ],
        xp: 6,
      },
      {
        id: 'ev-s6',
        type: 'decision_spot',
        concept_ids: ['expected_value', 'decision_quality'],
        narrative: 'FOLD: 0 EV. CALL: +3 EV. RAISE: +8 EV. Which action is best?',
        options: [
          { id: 'raise', label: 'RAISE', quality: 'perfect', feedback: 'Correct — RAISE has the highest EV. Strategy means picking the highest-EV action available, not just any action that happens to be profitable.' },
          { id: 'call', label: 'CALL', quality: 'mistake', feedback: 'CALL is profitable (+3 EV), but RAISE beats it by a wide margin — it is not the best action here.' },
          { id: 'fold', label: 'FOLD', quality: 'punt', feedback: 'Folding forfeits two profitable actions that were both better than 0.' },
        ],
        xp: 8,
      },
      {
        id: 'ev-s7',
        type: 'decision_spot',
        concept_ids: ['decision_quality'],
        narrative: 'CALL: +5 EV. RAISE: +11 EV.',
        options: [
          { id: 'profitable_not_best', label: 'Calling is profitable, but not the best action', quality: 'perfect', feedback: 'Right on both counts — CALL is +EV, but +EV does not automatically mean optimal. RAISE is the better decision here.' },
          { id: 'profitable_and_best', label: 'Calling is profitable AND the best action', quality: 'mistake', feedback: 'CALL is indeed profitable, but RAISE has more than double the EV — profitable does not mean best.' },
          { id: 'not_profitable', label: 'Calling is not profitable', quality: 'punt', feedback: '+5 EV is still profitable by definition — it just is not the highest-EV option available.' },
        ],
        xp: 8,
      },
      {
        id: 'ev-s8a',
        type: 'equity_balance',
        concept_ids: ['break_even', 'zero_ev'],
        narrative: "Hero's equity lands exactly on the required-equity line.",
        equity_balance_required: 25,
        equity_balance_actual: 25,
        equity_balance_prompt: 'What is the EV of calling here?',
        options: [
          { id: 'zero', label: '0 EV', quality: 'perfect', feedback: 'Correct — exactly at the break-even line, calling is worth 0 EV: no gain, no loss, long-run.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: 'At exactly the required equity, the call is break-even, not profitable.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: 'At exactly the required equity, the call is break-even, not a loser.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-s8b',
        type: 'equity_balance',
        concept_ids: ['break_even', 'positive_ev'],
        narrative: "Hero's equity sits above the required-equity line.",
        equity_balance_required: 25,
        equity_balance_actual: 32,
        equity_balance_prompt: 'What is the EV of calling here?',
        options: [
          { id: 'positive', label: '+EV', quality: 'perfect', feedback: 'Correct — above the line means the call profits on average, long-run.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: 'Equity above the required line means the call is profitable, not a loser.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: 'Equity above the required line clears break-even — this is +EV, not 0 EV.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-s8c',
        type: 'equity_balance',
        concept_ids: ['break_even', 'negative_ev'],
        narrative: "Hero's equity sits below the required-equity line.",
        equity_balance_required: 25,
        equity_balance_actual: 18,
        equity_balance_prompt: 'What is the EV of calling here?',
        options: [
          { id: 'negative', label: '-EV', quality: 'perfect', feedback: 'Correct — below the line, the call loses value on average, even though it might still win this one time.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: 'Equity below the required line means the call loses on average — that is -EV, not +EV.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: 'Equity below the required line misses break-even — this is -EV, not 0 EV.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-s9',
        type: 'concept_reveal',
        concept_ids: ['expected_value'],
        concept_title: 'Variance vs. EV',
        concept_content:
          "Run a +EV decision 20 times and some will still lose — that's variance, ordinary short-run luck. Run it 1,000 times and the average result converges toward its true EV. Variance explains short-term swings; EV judges whether the decision itself was good.",
        visual: 'pressure_chart',
        xp: 5,
      },
      {
        id: 'ev-lab1',
        type: 'ev_tree',
        concept_ids: ['expected_value'],
        ev_tree_prompt: 'Classify this decision.',
        ev_tree_root_label: 'CALL',
        ev_tree_branches: [
          { label: 'WIN', probability: 0.5, payoff: 100 },
          { label: 'LOSE', probability: 0.5, payoff: -100 },
        ],
        options: [
          { id: 'zero', label: '0 EV', quality: 'perfect', feedback: '0.5×100 + 0.5×(−100) = 0 — perfectly break-even.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: 'The two branches cancel out exactly — this nets 0, not a profit.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: 'The two branches cancel out exactly — this nets 0, not a loss.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-lab2',
        type: 'ev_tree',
        concept_ids: ['expected_value', 'fold_ev'],
        ev_tree_prompt: 'Classify this decision.',
        ev_tree_root_label: 'BLUFF',
        ev_tree_branches: [
          { label: 'Villain folds', probability: 0.6, payoff: 80 },
          { label: 'Villain calls', probability: 0.4, payoff: -80 },
        ],
        options: [
          { id: 'positive', label: '+EV', quality: 'perfect', feedback: '0.6×80 + 0.4×(−80) = 48 − 32 = +16 — a profitable bluff.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: 'The fold branch outweighs the call branch here: 48 − 32 = +16, not negative.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: '48 − 32 = +16 — that is positive, not break-even.' },
        ],
        xp: 6,
      },
      {
        id: 'ev-lab3',
        type: 'ev_tree',
        concept_ids: ['expected_value'],
        ev_tree_prompt: 'Classify this decision.',
        ev_tree_root_label: 'CALL',
        ev_tree_branches: [
          { label: 'WIN', probability: 0.3, payoff: 200 },
          { label: 'LOSE', probability: 0.7, payoff: -90 },
        ],
        options: [
          { id: 'negative', label: '-EV', quality: 'perfect', feedback: '0.3×200 + 0.7×(−90) = 60 − 63 = −3. Close to break-even, but slightly negative.' },
          { id: 'zero', label: '0 EV (very close)', quality: 'acceptable', feedback: 'The math lands at −3, not exactly 0 — a small but real -EV, even though it is very close to break-even.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: '60 − 63 = −3 — that is negative, not positive.' },
        ],
        xp: 8,
      },
      {
        id: 'ev-lab4',
        type: 'ev_tree',
        concept_ids: ['expected_value', 'fold_ev'],
        ev_tree_prompt: 'Classify this decision.',
        ev_tree_root_label: 'RAISE (semi-bluff)',
        ev_tree_branches: [
          { label: 'Villain folds', probability: 0.45, payoff: 60 },
          { label: 'Called, Hero wins', probability: 0.2, payoff: 140 },
          { label: 'Called, Hero loses', probability: 0.35, payoff: -60 },
        ],
        options: [
          { id: 'positive', label: '+EV', quality: 'perfect', feedback: '0.45×60 + 0.2×140 + 0.35×(−60) = 27 + 28 − 21 = +34 — a clearly profitable semi-bluff.' },
          { id: 'negative', label: '-EV', quality: 'mistake', feedback: '27 + 28 − 21 = +34 — that is positive, not negative.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: '27 + 28 − 21 = +34 — that is clearly positive, not break-even.' },
        ],
        xp: 8,
      },
      {
        id: 'ev-lab5',
        type: 'ev_tree',
        concept_ids: ['expected_value'],
        ev_tree_prompt: 'Classify this decision.',
        ev_tree_root_label: 'CALL (bad price)',
        ev_tree_branches: [
          { label: 'WIN', probability: 0.2, payoff: 300 },
          { label: 'LOSE', probability: 0.8, payoff: -100 },
        ],
        options: [
          { id: 'negative', label: '-EV', quality: 'perfect', feedback: '0.2×300 + 0.8×(−100) = 60 − 80 = −20 — a losing call despite the big payout when it works.' },
          { id: 'positive', label: '+EV', quality: 'mistake', feedback: '60 − 80 = −20 — that is negative, not positive, even with a big win amount.' },
          { id: 'zero', label: '0 EV', quality: 'mistake', feedback: '60 − 80 = −20 — that is negative, not break-even.' },
        ],
        xp: 6,
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
