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
]

// ── Learning Modules ──────────────────────────────────────────────────────────

export const LEARNING_MODULES: LearningModule[] = [
  // ── Beginner path ────────────────────────────────────────────────────
  {
    id: 'positions-module',
    path_id: 'beginner',
    slug: 'positions-module',
    title: 'Positions & Seats',
    description: 'Learn how your seat at the table dictates your strategy on every street.',
    concept_ids: ['position_value'],
    unlock_after: [],
    sort_order: 1,
    xp_reward: 100,
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
]

// ── Lessons ───────────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [

  // ── 1. Positions Fundamentals ─────────────────────────────────────────────
  {
    id: 'positions-fundamentals',
    module_id: 'positions-module',
    slug: 'positions-fundamentals',
    title: 'Positions & Seat Power',
    lesson_type: 'micro',
    concept_ids: ['position_value'],
    estimated_min: 5,
    xp_reward: 40,
    sort_order: 1,
    steps: [
      {
        id: 'pos-s1',
        type: 'concept_reveal',
        concept_ids: ['position_value'],
        concept_title: 'What Is Position?',
        concept_content:
          'Position = acting order on each street. The dealer button (BTN) acts last postflop — that is maximum information. UTG acts first — minimum information. The order from weakest to strongest: UTG → UTG+1 → MP → HJ → CO → BTN. The blinds (SB/BB) are forced-money positions that act last preflop but first postflop — making them the most costly seats over time.',
        visual: 'table',
        xp: 5,
      },
      {
        id: 'pos-s2',
        type: 'decision_spot',
        street: 'preflop',
        hero_position: 'UTG',
        hero_hand: ['8s', '7s'],
        pot_bb: 1.5,
        effective_stack_bb: 100,
        narrative: 'Six-max, 100bb cash. Folds around — action is on you in UTG with 87s.',
        options: [
          {
            id: 'open',
            label: 'Open raise to 2.5bb',
            quality: 'mistake',
            ev_loss_bb: 1.5,
            feedback:
              '87s is a fine hand, but UTG in 6-max still means five players act behind you. Your hand plays poorly out of position against 3-bets and multi-way pots. Open only your strongest suited connectors (JTs, T9s) from UTG.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'good',
            ev_loss_bb: 0,
            feedback:
              'Correct. 87s is just outside the profitable UTG opening range in most 6-max solutions. Save it for HJ, CO, or BTN where you have positional leverage.',
          },
          {
            id: 'limp',
            label: 'Limp',
            quality: 'punt',
            ev_loss_bb: 2.5,
            feedback:
              'Limping in 6-max cash is almost always a major leak. You announce weakness, invite everyone behind to raise, and enter the pot without initiative.',
          },
        ],
        xp: 10,
      },
      {
        id: 'pos-s3',
        type: 'decision_spot',
        street: 'preflop',
        hero_position: 'BTN',
        hero_hand: ['Kh', '9o'],
        pot_bb: 1.5,
        effective_stack_bb: 100,
        narrative: 'Folds to the BTN (you) with K9o. SB and BB remain.',
        options: [
          {
            id: 'open',
            label: 'Open raise to 2.5bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'K9o is a clear BTN open. You have the best position postflop and only two opponents left. Open wide here — BTN opening ranges run 40–50% in 6-max solutions.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'mistake',
            ev_loss_bb: 1.2,
            feedback:
              'Folding K9o on the BTN is too tight. You have a positional advantage over both blinds and K9o has enough equity and playability to show profit.',
          },
          {
            id: 'limp',
            label: 'Limp',
            quality: 'acceptable',
            ev_loss_bb: 0.6,
            feedback:
              'Some solvers do mix in BTN limps, but raising is higher EV for most player pools. Limping gives up initiative and fold equity.',
          },
        ],
        xp: 10,
      },
      {
        id: 'pos-s4',
        type: 'board_classify',
        street: 'flop',
        narrative: 'A hand reaches the flop. One player is Out Of Position (OOP), one is In Position (IP). Who acts first on every postflop street?',
        correct_answer: 'oop',
        correct_feedback:
          'Correct — the OOP player always acts first on every postflop street. This is the fundamental positional disadvantage: they must declare their action before seeing what the IP player does.',
        wrong_feedback:
          'No — postflop, OOP acts first on flop, turn, and river. The IP player gets to react with full information every street.',
        options: [
          { id: 'oop', label: 'OOP player (e.g. BB) acts first', quality: 'perfect', feedback: 'Correct — OOP declares before IP on every postflop street.' },
          { id: 'ip', label: 'IP player (e.g. BTN) acts first', quality: 'mistake', feedback: 'No — BTN acts last postflop, which is the positional advantage.' },
        ],
        xp: 8,
      },
      {
        id: 'pos-s5',
        type: 'concept_reveal',
        concept_ids: ['position_value'],
        concept_title: 'Position Summary',
        concept_content:
          "Position is the single biggest structural edge in poker. Playing IP you see villain's action before deciding: their check signals weakness, their bet gives you price info, and your hand's realized equity is roughly 8–12% higher than OOP. Tight from early position, wide from late position — this one rule underlies most preflop strategy.",
        xp: 5,
      },
    ],
  },

  // ── 2. Pot Odds Intuition ─────────────────────────────────────────────────
  {
    id: 'pot-odds-intuition',
    module_id: 'pot-odds-module',
    slug: 'pot-odds-intuition',
    title: 'Pot Odds Intuition',
    lesson_type: 'micro',
    concept_ids: ['pot_odds'],
    estimated_min: 5,
    xp_reward: 40,
    sort_order: 1,
    steps: [
      {
        id: 'po-s1',
        type: 'concept_reveal',
        concept_ids: ['pot_odds'],
        concept_title: 'Pot Odds: Risk vs Reward',
        concept_content:
          "Pot odds = the price you're getting to call. Formula: equity_needed = call / (pot + call). If villain bets half pot (e.g. 10bb into 20bb), you need call/(pot+call) = 10/(20+10) = 33% equity to break even. If your hand has more equity than the required amount, the call is profitable.",
        visual: 'equity_bar',
        xp: 5,
      },
      {
        id: 'po-s2',
        type: 'equity_predict',
        street: 'flop',
        pot_bb: 20,
        narrative: 'Pot is 20bb. Villain bets 10bb (50% pot). What minimum equity % do you need to call profitably?',
        equity_actual: 33,
        equity_tolerance: 5,
        correct_feedback: 'Exactly right. Call / (Pot + Call) = 10 / 30 = 33%. Any draw or hand with more than 33% equity is a profitable call.',
        wrong_feedback: 'Use the formula: call ÷ (pot + call) = 10 ÷ 30 = 33%. You need at least 33% equity.',
        xp: 10,
      },
      {
        id: 'po-s3',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['Qh', '8h', '3d'],
        hero_hand: ['Jh', '9h'],
        pot_bb: 30,
        effective_stack_bb: 85,
        narrative: 'Pot 30bb. Villain bets pot (30bb). You hold J♥9♥ — a flush draw with two overcards (~36% raw equity).',
        options: [
          {
            id: 'call',
            label: 'Call 30bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'Correct. Facing a pot bet you need 50% raw equity to break even on the call alone, but implied odds (winning more when the flush hits) push this well into profitable territory. JT of hearts with 36% equity + position = clear call.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'mistake',
            ev_loss_bb: 3.5,
            feedback:
              'Folding a flush draw with two overcards is too tight. Even facing a pot-sized bet, implied odds on future streets make this a profitable continue.',
          },
          {
            id: 'raise',
            label: 'Raise to 75bb',
            quality: 'acceptable',
            ev_loss_bb: 1.5,
            feedback:
              'Semi-raising with a flush draw is valid — you can win by fold equity or by hitting. However, it leaves you pot-committed on bad runouts, and calling preserves more flexibility.',
          },
        ],
        xp: 10,
      },
      {
        id: 'po-s4',
        type: 'equity_predict',
        street: 'turn',
        pot_bb: 50,
        narrative: 'Pot is 50bb. Villain bets 25bb (50% pot) on the turn. What minimum equity % do you need?',
        equity_actual: 33,
        equity_tolerance: 5,
        correct_feedback: '25 / (50+25) = 25/75 = 33%. Same answer as before — a half-pot bet always requires 33% equity.',
        wrong_feedback: 'Use call ÷ (pot + call) = 25 ÷ 75 = 33%. A half-pot bet always requires 33% equity regardless of absolute amounts.',
        xp: 10,
      },
    ],
  },

  // ── 3. Value Betting Basics ───────────────────────────────────────────────
  {
    id: 'value-betting-basics',
    module_id: 'value-betting-module',
    slug: 'value-betting-basics',
    title: 'Value Betting Basics',
    lesson_type: 'micro',
    concept_ids: ['value_betting'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 1,
    steps: [
      {
        id: 'vb-s1',
        type: 'concept_reveal',
        concept_ids: ['value_betting'],
        concept_title: 'Value Betting: Getting Paid by Worse',
        concept_content:
          'A value bet is a bet made when you expect to be called by worse hands more often than better hands. Betting is only profitable if: (% called by worse) × (amount won) > (% called by better) × (amount lost). On the river, thin value becomes the highest-skill decision — novices check hands that should bet for value.',
        xp: 5,
      },
      {
        id: 'vb-s2',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['As', 'Kh', '7d', '2c', 'Js'],
        hero_hand: ['Ad', 'Qc'],
        pot_bb: 40,
        effective_stack_bb: 60,
        narrative: 'River A♠K♥7♦2♣J♠. Pot 40bb. Villain checks to you. You hold A♦Q♣ (top pair top kicker + nut kicker).',
        options: [
          {
            id: 'bet75',
            label: 'Bet 30bb (75% pot)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Perfect value bet. Villain's range includes Ax, KQ, KJ, and bluff catchers that call 75%. You extract maximum value from a wide portion of their range.",
          },
          {
            id: 'check',
            label: 'Check back',
            quality: 'mistake',
            ev_loss_bb: 6,
            feedback:
              'Checking TPTK on the river as the last aggressor misses significant value. The board is relatively static; villain is not jamming over a check with worse. You must bet.',
          },
          {
            id: 'bet200',
            label: 'Bet 80bb (200% pot overbet)',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback:
              'Overbetting is theoretically correct on certain runouts with the right hand. AQ here is value but not strong enough to overbet on a board that contains J (straights possible). A 75% sizing extracts more from medium-strength calls.',
          },
        ],
        xp: 10,
      },
      {
        id: 'vb-s3',
        type: 'bet_size_choose',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['7h', '7c', '2s'],
        hero_hand: ['7d', '6d'],
        pot_bb: 20,
        effective_stack_bb: 90,
        narrative: "Flop 7♥7♣2♠. You flopped top set. Villain's range is capped — no pocket 7s. Pot 20bb.",
        options: [
          {
            id: 'size33',
            label: '33% pot (6.5bb)',
            quality: 'mistake',
            ev_loss_bb: 3,
            feedback:
              "Too small. With top set on a paired board, villain has no set above yours. Build the pot aggressively — small bets let them see cheap cards without compensating for runout risk.",
          },
          {
            id: 'size67',
            label: '67% pot (13bb)',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              "A solid choice. 67% builds the pot while keeping villain's bluff-catchers and weak pairs in. Slightly below ideal but very reasonable.",
          },
          {
            id: 'size100',
            label: '100% pot (20bb)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Pot-size bet with top set on a capped board is correct. You want to build the pot maximally — villain's range has Ax, Kx, and pairs that may hero-call. Charge them for the turn.",
          },
          {
            id: 'size150',
            label: '150% pot (30bb) overbet',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback:
              'An overbet can work on this board but risks folding out exactly the hands you want to stack. Pot-size is more reliable for value.',
          },
        ],
        xp: 10,
      },
      {
        id: 'vb-s4',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['Ks', '9d', '4h', '2c', 'Jh'],
        hero_hand: ['Qh', 'Th'],
        pot_bb: 50,
        effective_stack_bb: 50,
        narrative: 'River K♠9♦4♥2♣J♥. Pot 50bb. Villain bets 37bb (75% pot). You hold Q♥T♥ — Queen-high, a bluff catcher that beats only pure bluffs but loses to all made hands.',
        options: [
          {
            id: 'call',
            label: 'Call 37bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Correct. You hold a bluff-catcher — it beats all of villain's missed draws. Villain's range has enough bluffs that calling is correct per MDF: facing a 75% pot bet you must call ~43% of your range, and QT is in that zone.",
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'mistake',
            ev_loss_bb: 5,
            feedback:
              'Folding too frequently vs river bets is one of the most common leaks. If villain bluffs at even 30% frequency, folding QT (which beats all bluffs) is a large mistake.',
          },
          {
            id: 'raise',
            label: 'Raise all-in to 100bb',
            quality: 'punt',
            ev_loss_bb: 15,
            feedback:
              'Raising a bluff-catcher on the river turns it into a pure bluff. Villain simply folds worse and calls with value. This is a major punt.',
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 4. Bluff Fundamentals ─────────────────────────────────────────────────
  {
    id: 'bluff-fundamentals',
    module_id: 'bluff-basics-module',
    slug: 'bluff-fundamentals',
    title: 'Bluff Fundamentals',
    lesson_type: 'micro',
    concept_ids: ['alpha', 'bluff_basics'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 1,
    steps: [
      {
        id: 'bl-s1',
        type: 'concept_reveal',
        concept_ids: ['bluff_basics'],
        concept_title: 'Bluffing: Fold Equity, Not Gambling',
        concept_content:
          "A bluff is not a random gamble — it is a bet designed to make villain fold a better hand. Bluffs are profitable when villain folds more than alpha% of the time. Alpha = bet / (pot + bet). Choose bluffs with: (1) fold equity (villain's range is capped or scared), (2) good card removal (your hand blocks villain's strong calls), (3) semi-equity (draws that also win at showdown).",
        xp: 5,
      },
      {
        id: 'bl-s2',
        type: 'equity_predict',
        street: 'river',
        pot_bb: 30,
        narrative: 'You bet 15bb (50% pot) as a bluff on the river. How often must villain fold for the bluff to break even? (Enter as a whole number %.)',
        equity_actual: 33,
        equity_tolerance: 5,
        correct_feedback: 'Correct. Alpha = bet / (pot + bet) = 15 / (30+15) = 15/45 = 33%. Villain must fold more than 33% of the time.',
        wrong_feedback: 'Alpha = bet ÷ (pot + bet) = 15 ÷ 45 = 33%. If villain folds more than 33%, the bluff profits.',
        xp: 10,
      },
      {
        id: 'bl-s3',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['Jd', '8c', '4s', '2h', 'Kh'],
        hero_hand: ['Ac', 'Qd'],
        pot_bb: 40,
        effective_stack_bb: 60,
        narrative: 'River J♦8♣4♠2♥K♥. Pot 40bb. You have 60bb behind. Villain checked. You missed your gutshot but hold Ace-high.',
        options: [
          {
            id: 'bluff30',
            label: 'Bluff 30bb (75% pot)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Well-sized river bluff. 75% pot requires villain to fold 43% of the time — reasonable here where many of villain's floats (55, 66, 77, 99) have no showdown value. The Ace in your hand blocks AK (villain's top pair top kicker calls).",
          },
          {
            id: 'check',
            label: 'Check back',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              "Checking is fine — Ace-high will occasionally win at showdown, and protecting your checking range with some showdown equity hands is good balance. Bluffing is slightly better in spots where villain is folding a lot.",
          },
          {
            id: 'jam',
            label: 'Shove 60bb (150% pot)',
            quality: 'acceptable',
            ev_loss_bb: 3,
            feedback:
              'Overbetting as a bluff is a move for strong players with very strong blockers. Here you block AK (villain\'s strongest call) with your Ace — so the overbet has merit, but 75% is a cleaner size that villain folds more often to.',
          },
        ],
        xp: 10,
      },
      {
        id: 'bl-s4',
        type: 'decision_spot',
        street: 'turn',
        hero_position: 'BB',
        villain_position: 'CO',
        board: ['Ac', 'Kd', '7h', '3s'],
        hero_hand: ['5d', '4d'],
        pot_bb: 25,
        effective_stack_bb: 75,
        narrative: 'Turn A♣K♦7♥3♠. CO opened, you called from BB. CO c-bet small on flop and checked the turn. You hold 54o — no equity, no draw.',
        options: [
          {
            id: 'bluff',
            label: 'Bet 18bb (bluff)',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback:
              "CO's check on a double-broadway board shows weakness — many players give up here. A bet has fold equity, but 54o has near-zero equity if called and the board is not great for your perceived range. Workable, not ideal.",
          },
          {
            id: 'call',
            label: 'Call (no — villain checked)',
            quality: 'punt',
            ev_loss_bb: 0,
            feedback:
              'This option does not apply — villain checked. The choice is bet or check.',
          },
          {
            id: 'check',
            label: 'Check (give up)',
            quality: 'good',
            ev_loss_bb: 0,
            feedback:
              'With no equity and no draw, checking is the correct default. Pick better bluffing spots — hands with some equity (backdoor draws, blockers to nuts) make much better bluffs than 54o on AK73.',
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 5. Preflop Opening Ranges ─────────────────────────────────────────────
  {
    id: 'preflop-opening-ranges',
    module_id: 'preflop-module',
    slug: 'preflop-opening-ranges',
    title: 'Preflop Opening Ranges',
    lesson_type: 'range_trainer',
    concept_ids: ['hand_ranges'],
    estimated_min: 8,
    xp_reward: 60,
    sort_order: 1,
    steps: [
      {
        id: 'pf-s1',
        type: 'concept_reveal',
        concept_ids: ['hand_ranges'],
        concept_title: 'Opening Ranges by Position',
        concept_content:
          'Preflop ranges are not fixed lists — they are calculated based on fold equity, equity vs calling ranges, and postflop playability. Key principles: EP opens ~13–15% (only premium hands + strong suited connectors), BTN opens ~40–45% (very wide, any playable hand), CO opens ~25–30%, HJ ~18–20%. Suited hands play 2–4% better than offsuit equivalents.',
        visual: 'range_grid',
        xp: 5,
      },
      {
        id: 'pf-s2',
        type: 'range_build',
        street: 'preflop',
        hero_position: 'BTN',
        narrative: 'Build the BTN opening range (6-max, 100bb cash, unopened pot).',
        range_target: 'BTN_open_100bb',
        range_hint: 'BTN opens ~40–45% of hands. Include all pocket pairs, broadways, most suited hands, and strong offsuit combinations.',
        range_tolerance: 5,
        visual: 'range_grid',
        xp: 15,
      },
      {
        id: 'pf-s3',
        type: 'range_build',
        street: 'preflop',
        hero_position: 'UTG',
        narrative: 'Build the UTG opening range (6-max, 100bb cash, unopened pot). Tighten up — five players act behind you.',
        range_target: 'UTG_open_100bb',
        range_hint: 'UTG opens ~13–15%: premium pairs (TT+), top broadways (AK, AQs, AJs, KQs), best suited connectors (JTs).',
        range_tolerance: 4,
        visual: 'range_grid',
        xp: 15,
      },
      {
        id: 'pf-s4',
        type: 'decision_spot',
        street: 'preflop',
        hero_position: 'BTN',
        villain_position: 'UTG',
        hero_hand: ['Ah', 'Jo'],
        pot_bb: 8.5,
        effective_stack_bb: 100,
        narrative: 'UTG opens to 2.5bb, CO calls. Action on BTN with AJo. Three players in pot if you call.',
        options: [
          {
            id: '3bet',
            label: '3-bet to 10bb',
            quality: 'good',
            ev_loss_bb: 0.5,
            feedback:
              "AJo is a standard 3-bet from BTN vs UTG+CO. You isolate and leverage position. However, facing UTG open + CO cold-caller, AJo is slightly ahead of equilibrium — UTG's range is strong and you may be dominated by AQ, AK.",
          },
          {
            id: 'call',
            label: 'Call 2.5bb (3-way)',
            quality: 'acceptable',
            ev_loss_bb: 1,
            feedback:
              'Calling is acceptable in position, but AJo is tricky multi-way — you dominate fewer hands and face reverse implied odds (losing a big pot to AQ). 3-betting is preferred.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'acceptable',
            ev_loss_bb: 1,
            feedback:
              "Folding AJo on BTN vs UTG + caller is slightly tight but defensible. UTG's range contains AK, AQ that dominate AJ frequently. A reasonable choice if you prefer to avoid marginal spots.",
          },
        ],
        xp: 12,
      },
    ],
  },

  // ── 6. Board Texture Classification ──────────────────────────────────────
  {
    id: 'board-texture-classification',
    module_id: 'board-texture-module',
    slug: 'board-texture-classification',
    title: 'Board Texture Classification',
    lesson_type: 'micro',
    concept_ids: ['board_texture'],
    estimated_min: 5,
    xp_reward: 40,
    sort_order: 1,
    steps: [
      {
        id: 'bt-s1',
        type: 'concept_reveal',
        concept_ids: ['board_texture'],
        concept_title: 'Dry vs Wet Boards',
        concept_content:
          'Board texture determines how much both ranges connect to the flop and how volatile equity distributions are. Dry boards: high cards, rainbow, no straight draws (A♠7♦2♣). Wet boards: connected ranks (3-gap or less), two or more of same suit (J♥T♥9♦). Wet boards favour larger bets with value hands and more checking with marginal hands; dry boards allow small, frequent bets.',
        visual: 'table',
        xp: 5,
      },
      {
        id: 'bt-s2',
        type: 'board_classify',
        board: ['As', '7d', '2c'],
        narrative: 'Classify this flop: A♠7♦2♣. Is it dry or wet?',
        correct_answer: 'dry',
        correct_feedback:
          'Correct — rainbow, no connected ranks, high card anchors the board. Dry boards slow down equity run-outs and favour the preflop aggressor betting small.',
        wrong_feedback:
          'A♠7♦2♣ is dry: three different suits (rainbow), no straight draws possible (A-7 is 5 apart; 7-2 is 5 apart), and a dominant top card. This is the canonical dry flop.',
        options: [
          { id: 'dry', label: 'Dry', quality: 'perfect', feedback: 'Correct — A72 rainbow is the textbook dry board.' },
          { id: 'wet', label: 'Wet', quality: 'mistake', feedback: 'No — A72 rainbow has no flush draws and no straight draws. It is dry.' },
        ],
        xp: 8,
      },
      {
        id: 'bt-s3',
        type: 'board_classify',
        board: ['Jh', 'Th', '9d'],
        narrative: 'Classify this flop: J♥T♥9♦. Dry or wet?',
        correct_answer: 'wet',
        correct_feedback:
          'Correct — JT9 has a flush draw (two hearts) and is extremely connected (every card completes straights). This is a very wet board; equity runs off fast.',
        wrong_feedback:
          'J♥T♥9♦ is highly wet: two hearts create a flush draw, and JT9 is the most connected sequence possible (8, Q, K all make straights). Both players\' ranges intersect heavily here.',
        options: [
          { id: 'dry', label: 'Dry', quality: 'mistake', feedback: 'No — JT9 with two hearts is extremely wet. Flush and straight possibilities everywhere.' },
          { id: 'wet', label: 'Wet', quality: 'perfect', feedback: 'Correct — JT9 two-tone is the textbook wet board.' },
        ],
        xp: 8,
      },
      {
        id: 'bt-s4',
        type: 'board_classify',
        board: ['Ks', 'Qh', 'Jd'],
        narrative: 'Classify this flop: K♠Q♥J♦. Dry or wet?',
        correct_answer: 'wet',
        correct_feedback:
          'Correct — KQJ is a highly connected broadway board. Anyone with AT makes a straight. Even rainbow, this board is wet in terms of straight draws saturating both ranges.',
        wrong_feedback:
          'K♠Q♥J♦ is wet (structurally connected) despite being rainbow — it creates immediate open-ended and gutshot straight draws for a huge portion of both ranges.',
        options: [
          { id: 'dry', label: 'Dry', quality: 'mistake', feedback: 'No — KQJ is a broadway wet board. AT completes the nuts immediately; T, A, 9 give multiple draw outs.' },
          { id: 'wet', label: 'Wet', quality: 'perfect', feedback: 'Correct — KQJ is structurally connected and creates heavy draw texture.' },
        ],
        xp: 8,
      },
      {
        id: 'bt-s5',
        type: 'concept_reveal',
        concept_ids: ['board_texture'],
        concept_title: 'Texture Changes Strategy',
        concept_content:
          'On dry boards (A72r): bet small (25–33%) in position with your entire range — low risk of draws getting there, polarize later. On wet boards (JT9hh): bet larger with value (66–100%) to deny equity to draws; check more of your medium-strength hands to control pot size. OOP on wet boards, prefer a check-raise trap strategy over donk-betting.',
        xp: 5,
      },
    ],
  },

  // ── 7. C-Bet Fundamentals ─────────────────────────────────────────────────
  {
    id: 'cbet-fundamentals',
    module_id: 'cbet-module',
    slug: 'cbet-fundamentals',
    title: 'C-Bet Fundamentals',
    lesson_type: 'micro',
    concept_ids: ['cbet_theory'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 1,
    steps: [
      {
        id: 'cb-s1',
        type: 'concept_reveal',
        concept_ids: ['cbet_theory'],
        concept_title: 'Continuation Betting: Initiative + Range Advantage',
        concept_content:
          "A c-bet (continuation bet) is a flop bet made by the preflop aggressor. C-betting works because: (1) you have initiative — villain expects you to have a strong range, (2) you often have a range advantage on boards that hit your opening range better than villain's defending range. C-bet size and frequency depend on board texture and who benefits more from the flop.",
        xp: 5,
      },
      {
        id: 'cb-s2',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['As', '7d', '2c'],
        pot_bb: 11,
        effective_stack_bb: 90,
        narrative: "BTN opens, BB calls. Flop A♠7♦2♣. BB checks. Your range has far more Ax hands than BB's defending range.",
        options: [
          {
            id: 'cbet33',
            label: 'C-bet 33% (3.5bb)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'Perfect. A72 rainbow is the ideal small c-bet board. Your range has a massive advantage (lots of Ax, AA, 77, 22). A small bet forces BB to continue only strong hands while extracting value and denying cheap cards.',
          },
          {
            id: 'cbet75',
            label: 'C-bet 75% (8bb)',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              'A larger c-bet works but is suboptimal on this static board. You fold out hands you could extract from across multiple streets. Smaller sizes are more efficient here.',
          },
          {
            id: 'check',
            label: 'Check (give free card)',
            quality: 'mistake',
            ev_loss_bb: 2.5,
            feedback:
              'Checking A72r as BTN surrenders your entire range advantage. No significant draws exist on this board. Betting here is near-automatic profit.',
          },
        ],
        xp: 10,
      },
      {
        id: 'cb-s3',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['8h', '7h', '6d'],
        pot_bb: 11,
        effective_stack_bb: 90,
        narrative: "BTN opens, BB calls. Flop 8♥7♥6♦. BB checks. BB's defending range has far more 87, 76, 65, 98 type hands than BTN's opening range.",
        options: [
          {
            id: 'cbet50',
            label: 'C-bet 50% (5.5bb)',
            quality: 'acceptable',
            ev_loss_bb: 1.5,
            feedback:
              "C-betting here is not terrible, but you're betting into a board where BB has range advantage. You face more check-raises, and your bluffs succeed less. Use a small size if you do bet.",
          },
          {
            id: 'check',
            label: 'Check back',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'Correct. On 876 two-tone, BB has the range advantage — they defend more low suited connectors. Checking controls pot size, keeps your bluff-catchers in a good spot, and avoids c-betting into a check-raise trap.',
          },
          {
            id: 'cbet-pot',
            label: 'C-bet pot (11bb)',
            quality: 'mistake',
            ev_loss_bb: 4,
            feedback:
              "Pot-betting into BB's range advantage on a wet connected board is a significant mistake. You're likely to face a check-raise, and many of your range hands cannot continue profitably.",
          },
        ],
        xp: 10,
      },
      {
        id: 'cb-s4',
        type: 'bet_size_choose',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['Ad', '7c', '2s'],
        pot_bb: 11,
        effective_stack_bb: 90,
        narrative: 'Dry board A♦7♣2♠. BTN has range advantage. Best c-bet sizing?',
        options: [
          {
            id: 's1',
            label: '25–33% pot (2.5–3.5bb)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback: 'Correct. Small c-bets on dry boards extract value from the whole range efficiently. No draws to deny, so small bets generate high fold equity at low risk.',
          },
          {
            id: 's2',
            label: '50–66% pot (5.5–7bb)',
            quality: 'good',
            ev_loss_bb: 1,
            feedback: "Medium sizing works but is less efficient. On a board this static, you're paying too much for fold equity you get cheaply with 33%.",
          },
          {
            id: 's3',
            label: '100% pot (11bb)',
            quality: 'mistake',
            ev_loss_bb: 3,
            feedback: 'Pot-sizing on a dry board folds out the weaker hands you want to keep in for future streets. Reserve pot-bets for wet boards where equity denial matters.',
          },
        ],
        xp: 10,
      },
      {
        id: 'cb-s5',
        type: 'concept_reveal',
        concept_ids: ['cbet_theory'],
        concept_title: 'C-Bet Sizing Summary',
        concept_content:
          'Rule of thumb: Dry boards (A72r, K83r) → bet small (25–33%) with high frequency. Wet boards (JT9hh, 876ss) when you have value → bet large (67–100%) to deny equity. When out of position on a wet board or facing a range disadvantage → prefer check. The size of your c-bet sends a signal — use it deliberately.',
        xp: 5,
      },
    ],
  },

  // ── 8. MDF Defense Drill ──────────────────────────────────────────────────
  {
    id: 'mdf-defense-drill',
    module_id: 'mdf-module',
    slug: 'mdf-defense-drill',
    title: 'MDF & Defense Frequencies',
    lesson_type: 'micro',
    concept_ids: ['mdf', 'alpha'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 1,
    steps: [
      {
        id: 'mdf-s1',
        type: 'concept_reveal',
        concept_ids: ['mdf'],
        concept_title: 'Minimum Defense Frequency',
        concept_content:
          "MDF = the minimum % of your range you must continue (call or raise) to prevent villain from profitably bluffing any two cards. Formula: MDF = pot / (pot + bet). If villain bets 50% pot: MDF = 20/(20+10) for a 10bb bet into 20bb pot = 67%. Fold more than 33% → villain can bluff any two cards for free profit. MDF is a floor, not an exact call frequency.",
        visual: 'pressure_chart',
        xp: 5,
      },
      {
        id: 'mdf-s2',
        type: 'equity_predict',
        street: 'flop',
        pot_bb: 20,
        narrative: 'Villain bets 10bb (50% pot) into a 20bb pot. What is the MDF — the minimum % of your range you must continue?',
        equity_actual: 67,
        equity_tolerance: 5,
        correct_feedback: 'Correct! MDF = pot/(pot+bet) = 20/30 = 67%. You can fold at most 33% of your range.',
        wrong_feedback: 'MDF = pot ÷ (pot + bet) = 20 ÷ 30 = 67%. Fold no more than 33% of your range.',
        xp: 10,
      },
      {
        id: 'mdf-s3',
        type: 'equity_predict',
        street: 'river',
        pot_bb: 50,
        narrative: 'Villain bets pot (50bb) on the river. What is the MDF?',
        equity_actual: 50,
        equity_tolerance: 5,
        correct_feedback: "Correct! MDF = pot/(pot+bet) = 50/100 = 50%. Villain's pot-bet forces you to call at least 50% of your range.",
        wrong_feedback: 'MDF = pot ÷ (pot + bet) = 50 ÷ 100 = 50%. A pot-sized bet always gives MDF = 50%.',
        xp: 10,
      },
      {
        id: 'mdf-s4',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['Ks', '9h', '4d', '2c', '7s'],
        pot_bb: 50,
        effective_stack_bb: 50,
        narrative: 'River K♠9♥4♦2♣7♠. Villain bets pot (50bb). You have a range of bluff catchers and value hands. MDF = 50% means you can fold at most half your range.',
        options: [
          {
            id: 'fold50pct',
            label: 'Fold only 50% (call strong half of range)',
            quality: 'good',
            ev_loss_bb: 0,
            feedback:
              'Correct application of MDF. Facing a pot-bet, you fold your worst 50% and call your best 50%. This prevents profitable any-two-cards bluffs.',
          },
          {
            id: 'fold70pct',
            label: 'Yes — fold 70% to protect your value hands (over-fold)',
            quality: 'punt',
            ev_loss_bb: 8,
            feedback:
              'Folding 70% vs a pot-bet is a major leak. MDF = 50%, so folding 70% gives villain 70% fold equity — any bluff is immediately profitable. You are being exploited.',
          },
          {
            id: 'fold-bluffcatchers',
            label: 'Fold all bluff catchers, call only top pair+',
            quality: 'mistake',
            ev_loss_bb: 6,
            feedback:
              'This is over-folding. If you only call top pair+, villain can bluff profitably with any two cards. Bluff catchers exist specifically to defend against bluffs — call them at the right frequency.',
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 9. Range Advantage Intro ──────────────────────────────────────────────
  {
    id: 'range-advantage-intro',
    module_id: 'range-construction-module',
    slug: 'range-advantage-intro',
    title: 'Range Advantage Introduction',
    lesson_type: 'micro',
    concept_ids: ['range_advantage'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 1,
    steps: [
      {
        id: 'ra-s1',
        type: 'concept_reveal',
        concept_ids: ['range_advantage'],
        concept_title: "Range Advantage: Who Owns This Board?",
        concept_content:
          "Range advantage means one player's overall range connects better to the board than the other's. This affects: who should bet frequently, who can use large bet sizes, and who is forced to check. Nut advantage specifically means who holds more of the strongest possible hands (sets, two pair, straights, flushes).",
        xp: 5,
      },
      {
        id: 'ra-s2',
        type: 'nut_advantage',
        street: 'flop',
        board: ['As', 'Kd', '7c'],
        hero_position: 'BTN',
        villain_position: 'BB',
        narrative: 'Board A♠K♦7♣. BTN opened, BB called. Who has range advantage?',
        correct_answer: 'BTN',
        correct_feedback:
          "BTN has the range advantage on AK7. BTN's opening range includes AA, KK, AK, A7s, K7s at much higher frequency than BB's wide defending range. BTN can use large bets and high c-bet frequency.",
        wrong_feedback:
          "BTN has range advantage here. BTN opens with AK, AA, KK frequently; BB defends with a wide range that hits AK7 less often. The raiser almost always has range advantage on A-high boards.",
        options: [
          { id: 'BTN', label: 'BTN (opener)', quality: 'perfect', feedback: 'Correct. BTN\'s opening range dominates AK7 — more AA, KK, AK combos.' },
          { id: 'BB', label: 'BB (defender)', quality: 'mistake', feedback: "No — BB's wide defend range does not connect as well to AK7 as BTN's tight opening range." },
        ],
        xp: 10,
      },
      {
        id: 'ra-s3',
        type: 'nut_advantage',
        street: 'flop',
        board: ['7h', '6h', '5d'],
        hero_position: 'CO',
        villain_position: 'BTN',
        narrative: 'Board 7♥6♥5♦. CO opened, BTN called. Who has the nut advantage?',
        correct_answer: 'BTN',
        correct_feedback:
          "BTN (caller) has nut advantage on 765. BTN's calling range includes 98, 87, 54, 44, 55, 66, 77 in higher proportion than CO's opening range. BTN makes more sets and straights here.",
        wrong_feedback:
          "BTN has nut advantage. The caller's range typically contains more suited connectors and small pairs (98s, 87s, 55, 66, 77) that smash low connected boards. CO opened tighter and connects less well.",
        options: [
          { id: 'CO', label: 'CO (opener)', quality: 'mistake', feedback: "No — CO opens tighter and has fewer small connectors/pairs than BTN's calling range." },
          { id: 'BTN', label: 'BTN (caller)', quality: 'perfect', feedback: 'Correct. BTN defends with more 98, 87, 55, 66, 77 — hands that dominate 765.' },
        ],
        xp: 10,
      },
      {
        id: 'ra-s4',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['9s', '8d', '3c'],
        hero_hand: ['8h', '7h'],
        pot_bb: 11,
        effective_stack_bb: 90,
        narrative: 'BTN opens, BB calls. Flop 9♠8♦3♣. BTN c-bets 33% (3.5bb). You hold 8♥7♥ — second pair + a gutshot straight draw.',
        options: [
          {
            id: 'raise',
            label: 'Check-raise to 12bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Excellent. 87s has middle pair + a gutshot, and decent fold equity vs BTN's wide c-bet range. Check-raising denies equity to hands like 77, 66 and builds a pot in a spot where you have strong equity.",
          },
          {
            id: 'call',
            label: 'Call 3.5bb',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              'Calling is reasonable — you have middle pair + gutshot. The downside is OOP you give up initiative and must face two more bets without knowing your equity advantage. Check-raise is slightly superior.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'punt',
            ev_loss_bb: 8,
            feedback:
              'Folding second pair + gutshot vs a small c-bet is a massive punt. You have substantial equity and are getting 3:1 to call. Never fold this hand to a 33% bet.',
          },
        ],
        xp: 10,
      },
      {
        id: 'ra-s5',
        type: 'concept_reveal',
        concept_ids: ['range_advantage'],
        concept_title: 'Using Range Advantage',
        concept_content:
          'When you have range advantage: bet wider, bet larger, apply pressure. When villain has range advantage: check more, pot control, trap with strong hands. The player with nut advantage can profitably overbet (2x pot+) because villain\'s range cannot contain enough strong hands to make calling correct. Identifying range advantage is the first decision to make on every flop.',
        xp: 5,
      },
    ],
  },

  // ── 10. SPR & Commitment Thresholds ──────────────────────────────────────
  {
    id: 'spr-commitment-thresholds',
    module_id: 'equity-real-module',
    slug: 'spr-commitment-thresholds',
    title: 'SPR & Commitment Thresholds',
    lesson_type: 'micro',
    concept_ids: ['spr_theory'],
    estimated_min: 5,
    xp_reward: 45,
    sort_order: 1,
    steps: [
      {
        id: 'spr-s1',
        type: 'concept_reveal',
        concept_ids: ['spr_theory'],
        concept_title: 'Stack-to-Pot Ratio',
        concept_content:
          'SPR = effective stack / pot on the flop. SPR tells you how committed you are. Low SPR (≤ 3): you are committed with top pair or better — stacks go in. Medium SPR (4–12): need two pair+ to stack off comfortably; draws and TPTK play as calls. High SPR (13+): need strong hands only for major confrontations; implied odds dominate decision making.',
        xp: 5,
      },
      {
        id: 'spr-s2',
        type: 'equity_predict',
        street: 'flop',
        pot_bb: 20,
        effective_stack_bb: 100,
        narrative: 'Pot is 20bb on the flop. Effective stack is 100bb. What is the SPR?',
        equity_actual: 5,
        equity_tolerance: 1,
        correct_feedback: 'Correct. SPR = stack / pot = 100 / 20 = 5. Medium SPR — top pair is usually a call, two pair+ is a stack-off candidate.',
        wrong_feedback: 'SPR = effective stack ÷ pot = 100 ÷ 20 = 5. This is a medium SPR situation.',
        xp: 10,
      },
      {
        id: 'spr-s3',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['Ah', 'Jd', '3c'],
        hero_hand: ['As', 'Ks'],
        pot_bb: 30,
        effective_stack_bb: 60,
        narrative: 'Flop A♥J♦3♣. SPR = 2 (60bb behind, 30bb pot). BB jams for 60bb. You hold A♠K♠ (TPTK).',
        options: [
          {
            id: 'call',
            label: 'Call 60bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "With SPR = 2, you are committed with TPTK. Villain's jamming range is wide at this SPR — AJ, AQ, sets, air. Your hand is too strong to fold when you're already 2/3 in at call.",
          },
          {
            id: 'fold',
            label: 'Fold (avoid a coinflip)',
            quality: 'mistake',
            ev_loss_bb: 12,
            feedback:
              'Folding TPTK with SPR = 2 is a clear mistake. At this depth you are committed — the pot is already too large relative to stack for folding to be correct. You are risking 60 to win 90.',
          },
          {
            id: 'jam',
            label: 'Re-raise (already all-in effectively)',
            quality: 'good',
            ev_loss_bb: 0,
            feedback: "You're already all-in if you call — calling and re-raising are equivalent here. Snap-call.",
          },
        ],
        xp: 10,
      },
      {
        id: 'spr-s4',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BB',
        villain_position: 'CO',
        board: ['Kd', '8h', '3s'],
        hero_hand: ['9c', '8d'],
        pot_bb: 15,
        effective_stack_bb: 220,
        narrative: 'Flop K♦8♥3♠. SPR ≈ 15 (220bb behind, 15bb pot). CO bets pot (15bb). You have middle pair.',
        options: [
          {
            id: 'call',
            label: 'Call 15bb',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback:
              "Calling with middle pair is marginal at high SPR. You'll face multiple large bets if CO has a strong hand. With implied odds you may hit two pair, but the K is dangerous. Calling one street is defensible.",
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'good',
            ev_loss_bb: 0,
            feedback:
              "At high SPR, middle pair is rarely strong enough to commit large sums. Folding to a pot-bet with SPR = 15 is the disciplined choice — you'll face two more streets of pressure. 98 doesn't improve on most turns.",
          },
          {
            id: 'raise',
            label: 'Raise to 45bb',
            quality: 'mistake',
            ev_loss_bb: 7,
            feedback:
              "Raising middle pair into a large SPR with a king on board is a mistake. You're turning a marginal hand into a bluff against a range that likely contains Kx. At high SPR, don't bloat the pot with weak hands.",
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 11. Equity Realization Basics ─────────────────────────────────────────
  {
    id: 'equity-realization-basics',
    module_id: 'equity-real-module',
    slug: 'equity-realization-basics',
    title: 'Equity Realization',
    lesson_type: 'micro',
    concept_ids: ['equity_real'],
    estimated_min: 5,
    xp_reward: 45,
    sort_order: 2,
    steps: [
      {
        id: 'er-s1',
        type: 'concept_reveal',
        concept_ids: ['equity_real'],
        concept_title: "Equity Realization: Capturing What You're Owed",
        concept_content:
          'Equity realization is the % of your raw equity you actually capture in practice. Position is the biggest factor: IP players realize ~105–115% of their equity; OOP players realize ~85–95%. Reasons: IP players see one more decision free (check behind or call), OOP players face bets on every street. Draws realize more equity in position too — OOP draws fold more often to pressure.',
        xp: 5,
      },
      {
        id: 'er-s2',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['As', 'Kh', '2d'],
        hero_hand: ['8s', '7s'],
        pot_bb: 11,
        effective_stack_bb: 90,
        narrative: "You called BTN's open from BB. Flop A♠K♥2♦. BTN c-bets 33% (3.5bb). You hold 8♠7♠ — gutshot + backdoor flush draw, roughly 22% equity.",
        options: [
          {
            id: 'call',
            label: 'Call 3.5bb',
            quality: 'good',
            ev_loss_bb: 0.5,
            feedback:
              'Calling is reasonable. You have ~22% equity (backdoor draws + gutshot), and your pot odds are excellent vs a 33% c-bet (call 3.5 into 14.5 → need 24% equity). OOP your equity realization is lower, but the price is too good to fold.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'acceptable',
            ev_loss_bb: 1,
            feedback:
              "Folding is not terrible — OOP with backdoor draws only on AK2, you'll rarely realize full equity. But the price (3.5bb call, pot odds 4:1) makes this slightly too tight.",
          },
          {
            id: 'xr',
            label: 'Check-raise to 12bb',
            quality: 'mistake',
            ev_loss_bb: 4,
            feedback:
              "Check-raising a gutshot + backdoor draws OOP on AK2 into a wide range is a mistake. You don't have enough equity to build the pot, and BTN will 3-bet jam with sets, AK, bluffs.",
          },
        ],
        xp: 10,
      },
      {
        id: 'er-s3',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'CO',
        board: ['Qs', '9d', '4c'],
        hero_hand: ['Jh', 'Th'],
        pot_bb: 20,
        effective_stack_bb: 80,
        narrative: "You called CO's 3-bet from BTN. Flop Q♠9♦4♣. CO checks. You hold J♥T♥ — open-ended straight draw, ~32% equity.",
        options: [
          {
            id: 'bet50',
            label: 'Bet 50% pot (10bb)',
            quality: 'good',
            ev_loss_bb: 0.5,
            feedback:
              "Good play. IP with an OESD you should realize equity aggressively. Betting charges draws (if any), builds pot for when you hit, and can take it down vs CO's checking range (lots of marginal hands).",
          },
          {
            id: 'check',
            label: 'Check back',
            quality: 'acceptable',
            ev_loss_bb: 1.5,
            feedback:
              'Checking is acceptable — you see a free card, preserve pot size, and see how CO reacts on the turn. But IP you should be realizing your equity, not giving it away. Betting is slightly superior.',
          },
          {
            id: 'bet-pot',
            label: 'Bet pot (20bb)',
            quality: 'mistake',
            ev_loss_bb: 3,
            feedback:
              'Pot-sizing with a draw (not a made hand) overcommits the pot prematurely. You still need to improve — a smaller bet achieves the same goals (fold equity + pot building) with less risk.',
          },
        ],
        xp: 10,
      },
      {
        id: 'er-s4',
        type: 'concept_reveal',
        concept_ids: ['equity_real'],
        concept_title: 'Position Adds ~10% Realized Equity',
        concept_content:
          'A rule of thumb: being IP is worth approximately 10% more in realized equity than the same hand OOP. Example: 87s with 40% raw equity realizes ~44% IP but only ~36% OOP. This is why position-adjusted EV calculations matter, and why playing OOP requires a tighter range — your hands need more raw equity to compensate for what position takes away.',
        xp: 5,
      },
    ],
  },

  // ── 12. Polarized vs Merged ───────────────────────────────────────────────
  {
    id: 'polarized-vs-merged',
    module_id: 'polarized-module',
    slug: 'polarized-vs-merged',
    title: 'Polarized vs Merged Ranges',
    lesson_type: 'micro',
    concept_ids: ['polarized'],
    estimated_min: 7,
    xp_reward: 55,
    sort_order: 1,
    steps: [
      {
        id: 'pm-s1',
        type: 'concept_reveal',
        concept_ids: ['polarized'],
        concept_title: 'Polarized vs Merged: Two Ways to Bet',
        concept_content:
          'Polarized = your betting range contains only the nuts and bluffs — no medium-strength hands. Used on the river when medium hands lose to value and beat bluffs. Merged = betting a wide range including thin value hands, where all your betting hands are ahead of villain\'s calling range. Used on earlier streets, smaller sizes. Misidentifying your range structure leads to wrong bet sizes.',
        xp: 5,
      },
      {
        id: 'pm-s2',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['As', 'Kd', '7c', '2h', 'Js'],
        hero_hand: ['Qd', 'Qh'],
        pot_bb: 80,
        effective_stack_bb: 120,
        narrative: 'River A♠K♦7♣2♥J♠. Pot 80bb. 120bb behind. You hold Q♥Q♦ — an overpair below the board, effectively third pair.',
        options: [
          {
            id: 'small-merged',
            label: 'Bet 30bb small merged (38% pot)',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              "A small merged bet could work if villain can call with worse. QQ beats random bluff catchers but loses to any Ax, Kx, JJ, 77. It's marginal — getting called by better frequently at this size.",
          },
          {
            id: 'big-polar',
            label: 'Bet 100bb polarized overbet',
            quality: 'mistake',
            ev_loss_bb: 8,
            feedback:
              'Overbetting a medium-strength hand (QQ = effectively 3rd pair) as if it\'s polarized is a mistake. Polarized bets should be the nuts or bluffs — not medium value. Villain calls with AK, KQ, JJ and you are crushed.',
          },
          {
            id: 'check-call',
            label: 'Check (bluff-catch if villain bets)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Correct. QQ on AKJ72 is a bluff-catcher — it beats all of villain's missed draws. Checking and calling villain's bluffs is the highest-EV play. You cannot extract value; you can only trap bluffs.",
          },
        ],
        xp: 12,
      },
      {
        id: 'pm-s3',
        type: 'bluff_pick',
        street: 'river',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['As', 'Kd', '7c', '2h', 'Js'],
        narrative: "You're betting river polarized (large) with the nuts. Which hand makes the best bluff?",
        options: [
          {
            id: 'bluff-a',
            label: '7♦6♦ (missed flush draw, blocks little of importance)',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback:
              "76s missed its flush but it's a reasonable bluff — it has a credible line. However, it doesn't block villain's main calling hands (Ax, Kx).",
          },
          {
            id: 'bluff-b',
            label: 'A♥2♥ (blocks villain\'s Ax calls and 22 full house)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "Best bluff. A♥2♥ holds two critical blockers: the Ace reduces Ax combinations villain uses to call, and the 2 removes 22 (full house, a call). Bluffing with blockers to villain's calling range is maximally effective.",
          },
          {
            id: 'bluff-c',
            label: 'K♥Q♥ (blocks some Kx top pair calls)',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              'Good choice. K♥Q♥ blocks KQ and KJ. A strong bluffing candidate, but A2 is superior because the Ace blocks more calls (Ax is villain\'s most common continue).',
          },
        ],
        xp: 12,
      },
      {
        id: 'pm-s4',
        type: 'concept_reveal',
        concept_ids: ['polarized'],
        concept_title: 'Blockers Amplify Polarized Bluffs',
        concept_content:
          "When betting polarized on the river, choose bluffs that block villain's calling range. If villain calls with Ax, your bluff with Ax removes those combos — fewer of their hands call. Never bluff with hands that unblock villain's folds (they already would fold) — bluff with hands that reduce their calls. This is why A♥2♥ beats 76s as a bluff on AK72J.",
        xp: 5,
      },
    ],
  },

  // ── 13. Blocker Effects Intro ─────────────────────────────────────────────
  {
    id: 'blocker-effects-intro',
    module_id: 'blockers-module',
    slug: 'blocker-effects-intro',
    title: 'Blocker Effects Introduction',
    lesson_type: 'micro',
    concept_ids: ['blockers'],
    estimated_min: 7,
    xp_reward: 60,
    sort_order: 1,
    steps: [
      {
        id: 'bk-s1',
        type: 'concept_reveal',
        concept_ids: ['blockers'],
        concept_title: "Blockers: Reducing Villain's Combos",
        concept_content:
          "A blocker is a card in your hand that reduces the number of combinations villain can hold. Example: holding A♣ means villain can only hold 3 remaining Aces instead of 4 — reducing all AA, AK, AQ, AJ combos by 25%. For bluffing: hold cards that block villain's calling range. For value: hold cards that block villain's folding range (so they call more).",
        xp: 5,
      },
      {
        id: 'bk-s2',
        type: 'blocker_id',
        street: 'river',
        board: ['As', 'Kd', '7c', '2h', 'Js'],
        narrative: 'River A♠K♦7♣2♥J♠. You want to run a big river bluff. Which hand has the best blockers?',
        options: [
          {
            id: 'qj',
            label: 'Q♣J♦ (blocks some JJ combinations)',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              "J♦ blocks JJ (trips) — a likely call. Reasonable blocker candidate, but QJ does not block the most common calls (Ax, KK, AK).",
          },
          {
            id: 'aq',
            label: 'A♣Q♣ (blocks Ax calls — villain\'s most common continue)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "A♣Q♣ is the best bluffing hand here. The Ace blocks all Ax combinations (the dominant calling range on this board). Villain has 25% fewer Ax combos, making the bluff more profitable.",
          },
          {
            id: '87',
            label: '8♦7♦ (blocks 77 sets — but 77 is rare on the river here)',
            quality: 'acceptable',
            ev_loss_bb: 2.5,
            feedback:
              "7♦ does block 77, but sets of 7s are only a small portion of villain's calling range on AKJ board. This blocker effect is minor compared to blocking Ax.",
          },
        ],
        xp: 12,
      },
      {
        id: 'bk-s3',
        type: 'blocker_id',
        street: 'river',
        board: ['Qh', 'Jh', 'Ts', '2h', '8d'],
        narrative: 'River Q♥J♥T♠2♥8♦. You missed your flush draw. Which bluffing hand has the best blockers against villain\'s nut-flush call?',
        options: [
          {
            id: 'akh',
            label: 'A♥K♥ (holds the two highest flush cards)',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'A♥K♥ is the best bluff. The nut flush (A♥ high) is completely in your hand — villain cannot have it. You block the #1 and #2 flush cards, dramatically reducing villain\'s nut-flush and king-high flush combos.',
          },
          {
            id: '98h',
            label: '9♥8♥ (missed straight-flush draw)',
            quality: 'good',
            ev_loss_bb: 1.5,
            feedback:
              "9♥8♥ blocks some flush combos (9-high flush) and straight draws. Solid candidate, but the lower flush cards are less likely to be in villain's calling range than A♥K♥.",
          },
          {
            id: 'kq',
            label: 'K♠Q♠ (blocks top pair QQ/KQ — reduces some calls)',
            quality: 'acceptable',
            ev_loss_bb: 3,
            feedback:
              "K♠Q♠ blocks some pair combos but not the flush — villain's primary strong hand on a 4-heart board. Blocking top pair is less impactful than blocking the made flush.",
          },
        ],
        xp: 12,
      },
    ],
  },

  // ── 14. Geometric Sizing Drill ────────────────────────────────────────────
  {
    id: 'geometric-sizing-drill',
    module_id: 'geometric-module',
    slug: 'geometric-sizing-drill',
    title: 'Geometric Sizing',
    lesson_type: 'micro',
    concept_ids: ['geometric_sizing'],
    estimated_min: 6,
    xp_reward: 55,
    sort_order: 1,
    steps: [
      {
        id: 'gs-s1',
        type: 'concept_reveal',
        concept_ids: ['geometric_sizing'],
        concept_title: 'Geometric Sizing: Perfectly Using Stacks',
        concept_content:
          'Geometric sizing = using the same fraction of pot each street so you go all-in on the exact last betting street. Formula for 2 streets: each bet = sqrt(stack/pot) × pot. For 3 streets: each bet = cbrt(stack/pot) × pot as a fraction. This maximizes pressure across the game tree — villain faces equal pressure every street with no escape on cheaper streets.',
        visual: 'pressure_chart',
        xp: 5,
      },
      {
        id: 'gs-s2',
        type: 'equity_predict',
        street: 'flop',
        pot_bb: 10,
        effective_stack_bb: 90,
        narrative: 'Pot 10bb, effective stack 90bb. You want to go all-in by the river across 3 streets. Approximately what % of pot should you bet each street (geometric)?',
        equity_actual: 30,
        equity_tolerance: 10,
        correct_feedback:
          'In the right range. With a 9x ratio (90/10), the geometric multiplier over 3 streets is cube_root(9) ≈ 2.08 per street. In practice this means betting ~75–100% pot each street, with each bet being ~30bb into a growing pot.',
        wrong_feedback:
          'With pot 10bb and 90bb stacks (9x ratio), geometric sizing over 3 streets means betting ~75–100% pot each street. The first bet is roughly 7.5–10bb. Aim for the 30% answer as a % of remaining stack.',
        xp: 12,
      },
      {
        id: 'gs-s3',
        type: 'bet_size_choose',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['Kh', '7d', '2c'],
        pot_bb: 20,
        effective_stack_bb: 100,
        narrative: 'Pot 20bb, 100bb stacks, 2 streets to go (turn + river). You want to jam by river geometrically.',
        options: [
          {
            id: 'gs-33',
            label: '33% pot (6.5bb) — too small',
            quality: 'mistake',
            ev_loss_bb: 4,
            feedback: "Too small — at 33% each street you won't be all-in by river. With 100bb and 2 streets, you need to bet ~70% of pot each street to be geometric.",
          },
          {
            id: 'gs-50',
            label: '50% pot (10bb) — under-geometric',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback: "Better but still slightly small. 50% each street over 2 streets: 10bb bet into 40bb pot → 20bb bet into 60bb pot → you're not all-in. Needed ~70%.",
          },
          {
            id: 'gs-70',
            label: '70% pot (14bb) — approximately geometric',
            quality: 'good',
            ev_loss_bb: 0.5,
            feedback: 'Close. 70% each of 2 streets gets you near all-in by river. Mathematical answer is sqrt(100/20) = sqrt(5) ≈ 2.24 → bet ~120% flop, but 70% is a practical approximation.',
          },
          {
            id: 'gs-pot',
            label: 'Pot (20bb) — slightly over-geometric but clean',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'Pot-betting on the flop (20bb) and a large turn bet will naturally put stacks in by river. A pot-bet first street is conservative geometric sizing — applies maximum pressure early. For a 2-street jam, pot-first is the cleaner practical choice.',
          },
        ],
        xp: 12,
      },
      {
        id: 'gs-s4',
        type: 'concept_reveal',
        concept_ids: ['geometric_sizing'],
        concept_title: 'Why Geometric Sizing Works',
        concept_content:
          "Geometric sizing makes villain indifferent across all streets because the price ratio stays constant. If villain must call 30% of pot each street, they cannot 'wait for a cheaper street' — all streets are equally expensive. It also maximizes fold equity: villain must fold or face the same pressure each street with no relief. Used most effectively with strong made hands and combo draws where you want all stacks in.",
        xp: 5,
      },
    ],
  },

  // ── 15. Nut Advantage Reads ───────────────────────────────────────────────
  {
    id: 'nut-advantage-reads',
    module_id: 'range-construction-module',
    slug: 'nut-advantage-reads',
    title: 'Nut Advantage Reads',
    lesson_type: 'micro',
    concept_ids: ['range_advantage'],
    estimated_min: 5,
    xp_reward: 45,
    sort_order: 2,
    steps: [
      {
        id: 'na-s1',
        type: 'concept_reveal',
        concept_ids: ['range_advantage'],
        concept_title: 'Nut Advantage: The Top of Each Range',
        concept_content:
          'Nut advantage = which player has more combinations of the strongest possible hands (nuts, near-nuts). Nut advantage enables large bet sizes and overbets because villain\'s calling range cannot contain enough strong hands to justify calling. Even if overall range advantage is split, nut advantage often goes to one player clearly.',
        xp: 5,
      },
      {
        id: 'na-s2',
        type: 'nut_advantage',
        street: 'flop',
        board: ['2s', '2d', '2c'],
        hero_position: 'BTN',
        villain_position: 'BB',
        narrative: 'Flop 2♠2♦2♣ (trip deuces on board). BTN opened, BB called. Who has more trips or full houses?',
        correct_answer: 'BTN',
        correct_feedback:
          "BTN has more nut hands here. BTN's opening range includes AA, KK, QQ (make top boats) at much higher frequency than BB's wide defense. BB also cannot have 22 — it's on the board. BTN's strong pairs dominate this board.",
        wrong_feedback:
          "BTN has nut advantage. On 222, the nuts are A2 (quads), AA (full house), KK, QQ etc. BTN's tight opening range has more premium pairs. BB's wide defense range has more marginal hands that miss 222.",
        options: [
          { id: 'BTN', label: 'BTN (opener)', quality: 'perfect', feedback: 'Correct. BTN\'s range has more premium pairs making top full houses on 222.' },
          { id: 'BB', label: 'BB (defender)', quality: 'mistake', feedback: "No — BTN's tighter opening range has more AA, KK, QQ (strong full houses) on 222." },
        ],
        xp: 10,
      },
      {
        id: 'na-s3',
        type: 'nut_advantage',
        street: 'flop',
        board: ['Jh', 'Td', '9s'],
        hero_position: 'SB',
        villain_position: 'BTN',
        narrative: 'Flop J♥T♦9♠. SB vs BTN. Who has more straights and sets on this board?',
        correct_answer: 'BB',
        correct_feedback:
          "The SB/BB defending range has more suited connectors (87s, 98s, 76s) and small pairs (JJ, TT, 99) than BTN's opening range. On JT9, defenders' wider range hits the connected middle cards more. Counterintuitively, the caller often has nut advantage on low-to-mid connected boards.",
        wrong_feedback:
          "On JT9, the defending player (BB/SB) actually has nut advantage. Their wider range contains more 87s, 98s, JTs making straights, and small pairs making sets. BTN opens a tighter range that misses JT9 connectivity.",
        options: [
          { id: 'BTN', label: 'BTN (opener)', quality: 'mistake', feedback: "No — BTN's opening range is tighter and hits JT9 connected boards less than the defender's wide range." },
          { id: 'BB', label: 'BB/SB (defender)', quality: 'perfect', feedback: "Correct. Defenders' wide ranges contain more suited connectors and small-pair sets on JT9." },
        ],
        xp: 10,
      },
      {
        id: 'na-s4',
        type: 'decision_spot',
        street: 'flop',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['Jh', 'Td', '9s'],
        hero_hand: ['Ah', '8h'],
        pot_bb: 11,
        effective_stack_bb: 90,
        narrative: "BTN opened, BB called. Flop J♥T♦9♠. BB check-raises your 33% c-bet. You hold A♥8♥ — a gutshot straight draw (8 gives 8-9-T-J) and backdoor flush draw.",
        options: [
          {
            id: 'call',
            label: 'Call the check-raise',
            quality: 'good',
            ev_loss_bb: 1,
            feedback:
              "Calling preserves your implied odds on the A8 gutshot and backdoor. BB has nut advantage but their check-raise range still has bluffs. You can navigate turn/river profitably with enough equity.",
          },
          {
            id: '3bet',
            label: '3-bet the check-raise',
            quality: 'mistake',
            ev_loss_bb: 6,
            feedback:
              "Re-raising into BB's check-raise range on JT9 is dangerous — BB has many straights and sets here. Your A8 is a gutshot, not a combo draw. 3-betting is a major mistake against BB's strong range advantage here.",
          },
          {
            id: 'fold',
            label: 'Fold (give up)',
            quality: 'acceptable',
            ev_loss_bb: 2,
            feedback:
              "Folding is not unreasonable. BB has nut advantage on JT9 and their check-raise is value-heavy. A8 on JT9 has limited equity. However, at these pot odds, calling one street is typically better than folding outright.",
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 16. Bluff Frequency Basics ────────────────────────────────────────────
  {
    id: 'bluff-frequency-basics',
    module_id: 'bluff-basics-module',
    slug: 'bluff-frequency-basics',
    title: 'Bluff Frequency & Alpha',
    lesson_type: 'micro',
    concept_ids: ['alpha'],
    estimated_min: 5,
    xp_reward: 40,
    sort_order: 2,
    steps: [
      {
        id: 'bf-s1',
        type: 'concept_reveal',
        concept_ids: ['alpha'],
        concept_title: 'Alpha: Break-Even Fold Frequency',
        concept_content:
          "Alpha = the % of the time your bluff needs to work to break even. Formula: alpha = bet / (pot + bet). If you bet 75% pot: alpha = 75/(100+75) = 75/175 = 43%. If villain folds >43% of the time, the bluff is immediately profitable (before considering the times you get lucky and win at showdown).",
        visual: 'equity_bar',
        xp: 5,
      },
      {
        id: 'bf-s2',
        type: 'equity_predict',
        street: 'river',
        pot_bb: 40,
        narrative: 'You bet 30bb (75% pot) as a river bluff. What % of the time must villain fold for the bluff to break even? (This is alpha.)',
        equity_actual: 43,
        equity_tolerance: 5,
        correct_feedback: 'Correct! Alpha = 30 / (40+30) = 30/70 = 43%. Villain must fold more than 43% for the bluff to profit.',
        wrong_feedback: "Alpha = bet ÷ (pot + bet) = 30 ÷ 70 = 43%. That's the break-even fold frequency for a 75% pot bluff.",
        xp: 10,
      },
      {
        id: 'bf-s3',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BTN',
        villain_position: 'BB',
        board: ['Kh', '9c', '4d', '2s', '8h'],
        hero_hand: ['Jc', 'Td'],
        pot_bb: 30,
        effective_stack_bb: 70,
        narrative: 'River K♥9♣4♦2♠8♥. You bet 15bb (50% pot) as a bluff. Villain appears to fold roughly 30% of the time to your river bets.',
        options: [
          {
            id: 'no-not-enough',
            label: 'No — you need at least 33% folds, 30% is not enough',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'Correct analysis. Alpha for a 50% pot bluff = 15/(30+15) = 33%. At 30% fold frequency, the bluff loses money: (30% × 30bb won) + (70% × -15bb lost) = 9 - 10.5 = -1.5bb EV. The bluff is slightly unprofitable.',
          },
          {
            id: 'yes-enough',
            label: 'Yes — 30% folds is enough to profit',
            quality: 'mistake',
            ev_loss_bb: 4,
            feedback:
              'Incorrect. Alpha = 15/(30+15) = 33%. 30% < 33% means the bluff loses money in expectation. You need villain to fold MORE than 33% for this bet size to be profitable.',
          },
          {
            id: 'depends',
            label: 'Depends on hand strength',
            quality: 'acceptable',
            ev_loss_bb: 1,
            feedback:
              "Partially correct — hand strength matters for total EV (equity when called). But the pure bluff break-even is determined by alpha alone. JT has minimal showdown value on K9428, so the bluff needs to work 33%+ to show profit.",
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 17. Reading Villain's Range ───────────────────────────────────────────
  {
    id: 'villain-range-identification',
    module_id: 'range-construction-module',
    slug: 'villain-range-identification',
    title: "Reading Villain's Range",
    lesson_type: 'micro',
    concept_ids: ['hand_ranges', 'range_advantage'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 3,
    steps: [
      {
        id: 'vr-s1',
        type: 'concept_reveal',
        concept_ids: ['hand_ranges'],
        concept_title: "Narrowing Villain's Range",
        concept_content:
          "Every action villain takes narrows their range. Preflop: raise from UTG → tight range (AA–TT, AK, AQ, AJs, KQs). Check on flop: removes most nut hands (sets, top two pair rarely check). Bet turn after check-raise on flop: strengthens to value + strong draws. Use Bayesian updating — multiply their starting range by the probability of each action given each holding.",
        xp: 5,
      },
      {
        id: 'vr-s2',
        type: 'range_identify',
        street: 'flop',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['Ac', 'Kh', '7d'],
        narrative: 'BTN opened UTG (tight range). Flop Ac Kh 7d. UTG c-bets small (33%). What is their most likely betting range structure?',
        correct_answer: 'value_and_air',
        correct_feedback:
          'Correct. A small c-bet on AK7 is a range betting strategy — UTG has AK, AA, KK, A7 for value, and hands like QJ, JT, 89s as bluffs. Medium hands (AQ, AJ, KQ) often check behind for pot control.',
        wrong_feedback:
          "On AK7, a 33% c-bet from UTG represents a wide range — both strong hands (AK, AA, KK) and air (bluffs). It's rarely just value because small sizing accommodates many bluffs.",
        options: [
          { id: 'value_only', label: 'Only value hands (AK, AA, KK)', quality: 'mistake', feedback: 'No — small c-bets include many bluffs. A 33% bet is used with the whole range, not just value.' },
          { id: 'value_and_air', label: 'Value hands + bluffs (polarized or range bet)', quality: 'perfect', feedback: 'Correct — a small c-bet can be a range bet (entire range) or polarized value + air on this texture.' },
          { id: 'medium_hands', label: 'Medium hands checking behind (AQ, AJ)', quality: 'acceptable', feedback: 'Partially right — medium hands DO often check AK7, but the c-bet range contains value AND bluffs, not just medium hands.' },
        ],
        xp: 10,
      },
      {
        id: 'vr-s3',
        type: 'range_identify',
        street: 'river',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['As', 'Kd', '7c', '2h', 'Js'],
        narrative: 'River AKJ72. BTN bet flop, bet turn (70% pot), and now bets 80% of pot on river. What is their range structure?',
        correct_answer: 'polarized',
        correct_feedback:
          'Correct — three-street aggression at increasing sizing = polarized range. BTN has the nuts (AK, AA, KK, AJ) or pure bluffs (missed draws, air). No medium hand triple-barrels 80% river — that would be spewing.',
        wrong_feedback:
          "Three-street increasing barrel = polarized river range. Medium-strength hands (AQ, QJ, etc.) do not bet three streets at large sizing. BTN is representing the nuts or bluffing.",
        options: [
          { id: 'polarized', label: 'Polarized — nuts or bluffs', quality: 'perfect', feedback: 'Correct. Three large barrels = polarized range on the river.' },
          { id: 'merged', label: 'Merged — thin value including medium hands', quality: 'mistake', feedback: "No — medium hands don't bet three streets large. The range is polarized." },
          { id: 'value_only', label: 'Pure value — no bluffs', quality: 'mistake', feedback: "No — never assume no bluffs. At 80% sizing, bluffs must exist for the bet to be balanced." },
        ],
        xp: 10,
      },
      {
        id: 'vr-s4',
        type: 'decision_spot',
        street: 'river',
        hero_position: 'BB',
        villain_position: 'BTN',
        board: ['As', 'Kd', '7c', '2h', 'Js'],
        hero_hand: ['Kh', 'Qd'],
        pot_bb: 80,
        effective_stack_bb: 65,
        narrative: 'River AKJ72. You hold K♥Q♦ (second pair). BTN fires 80% pot (65bb). Given their polarized range, do you call or fold?',
        options: [
          {
            id: 'call',
            label: 'Call 65bb',
            quality: 'good',
            ev_loss_bb: 2,
            feedback:
              "KQ is a borderline bluff-catcher — it beats bluffs (missed draws) but loses to all value (AK, AA, KK, AJ). Given BTN's polarized range, you need to call enough to prevent profitable bluffs. Call if villain bluffs frequently enough.",
          },
          {
            id: 'fold',
            label: 'Fold 65bb',
            quality: 'acceptable',
            ev_loss_bb: 3,
            feedback:
              'Folding is defensible — KQ loses to a huge portion of BTN\'s value range (AK dominates). However, if BTN has enough bluffs in their polarized range, folding KQ gives up too much. It depends on villain\'s actual bluffing frequency.',
          },
          {
            id: 'raise',
            label: 'Raise all-in',
            quality: 'punt',
            ev_loss_bb: 15,
            feedback:
              'Raising a bluff-catcher on the river vs a polarized range is a massive punt. BTN calls with the nuts (they never fold sets and two pair) and folds bluffs. Pure negative EV move.',
          },
        ],
        xp: 10,
      },
    ],
  },

  // ── 18. Preflop 3-Bet Spots ───────────────────────────────────────────────
  {
    id: 'preflop-3bet-spots',
    module_id: 'preflop-module',
    slug: 'preflop-3bet-spots',
    title: 'Preflop 3-Bet Spots',
    lesson_type: 'micro',
    concept_ids: ['hand_ranges'],
    estimated_min: 6,
    xp_reward: 50,
    sort_order: 2,
    steps: [
      {
        id: 'p3-s1',
        type: 'concept_reveal',
        concept_ids: ['hand_ranges'],
        concept_title: '3-Betting: Value and Bluff',
        concept_content:
          'A balanced 3-bet range contains: (1) Value hands that want to build a big pot (AA, KK, QQ, JJ, AK, AQs), (2) Bluff hands with good blockers + playability (A5s, A4s block AA combos; suited connectors have postflop equity if called). Never 3-bet too tight (only AA/KK) — predictable and exploitable. 3-bet sizing: IP → 3x open, OOP → 3.5–4x open.',
        xp: 5,
      },
      {
        id: 'p3-s2',
        type: 'decision_spot',
        street: 'preflop',
        hero_position: 'CO',
        villain_position: 'BTN',
        hero_hand: ['As', '5s'],
        pot_bb: 5,
        effective_stack_bb: 100,
        narrative: 'BTN opens to 2.5bb. Action on CO with A♠5♠.',
        options: [
          {
            id: '3bet',
            label: '3-bet to 8bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              "A5s is an excellent 3-bet bluff from CO. The Ace blocks AA, AK, AQ (reducing BTN's 4-bet value hands). Suited means postflop playability if called. This is the canonical 3-bet bluff hand.",
          },
          {
            id: 'call',
            label: 'Call 2.5bb',
            quality: 'acceptable',
            ev_loss_bb: 1.5,
            feedback:
              'Calling A5s in position is fine — you have good playability. But 3-betting is higher EV: you can win the pot preflop, you have blocker effects vs BTN\'s continuing range, and you play in position postflop as the 3-bettor.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'mistake',
            ev_loss_bb: 2,
            feedback:
              'Folding A5s OTB vs a BTN open is too tight. This hand has strong 3-bet bluff value and enough postflop playability to call. Never fold this hand facing one raiser in position.',
          },
        ],
        xp: 10,
      },
      {
        id: 'p3-s3',
        type: 'decision_spot',
        street: 'preflop',
        hero_position: 'BTN',
        villain_position: 'UTG',
        hero_hand: ['Qh', 'Jh'],
        pot_bb: 3.5,
        effective_stack_bb: 100,
        narrative: 'UTG opens to 2.5bb (tight range: TT+, AK, AQs, KQs). Action on BTN with Q♥J♥.',
        options: [
          {
            id: '3bet',
            label: '3-bet to 8bb',
            quality: 'mistake',
            ev_loss_bb: 3,
            feedback:
              "QJh 3-betting vs UTG is a mistake. UTG's range is very strong — QJ is dominated by AQ, AJ, KQ, KJ frequently. Your 3-bet gets dominated when called, and UTG folds only pure air.",
          },
          {
            id: 'call',
            label: 'Call 2.5bb',
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback:
              'Correct. QJh in position vs UTG is a clear call. You have excellent implied odds (straight/flush potential), you are IP, and the hand plays well in a single raised pot. Avoid 3-betting dominated hands vs tight UTG ranges.',
          },
          {
            id: 'fold',
            label: 'Fold',
            quality: 'acceptable',
            ev_loss_bb: 1.5,
            feedback:
              "Folding QJh vs UTG is reasonable at very tight tables — UTG's range has more KK, AA than you might think. However, in 6-max where UTG opens 13–15%, QJh has enough equity and playability to call profitably.",
          },
        ],
        xp: 10,
      },
      {
        id: 'p3-s4',
        type: 'range_build',
        street: 'preflop',
        hero_position: 'BTN',
        narrative: "Build BTN's 3-bet range vs CO open (6-max, 100bb). Include value hands and balanced bluffs.",
        range_target: 'BTN_3bet_vs_CO',
        range_hint: 'Value: QQ+, AK, AQs. Bluffs: A5s–A2s (blocker), suited connectors (JTs, T9s), select offsuit combos. Total ~6–8% of hands.',
        range_tolerance: 3,
        visual: 'range_grid',
        xp: 12,
      },
    ],
  },
]
