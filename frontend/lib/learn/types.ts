// ── Step types ────────────────────────────────────────────────────────────────

export type StepType =
  | 'concept_reveal'
  | 'decision_spot'
  | 'range_build'
  | 'range_identify'
  | 'equity_predict'
  | 'bet_size_choose'
  | 'blocker_id'
  | 'board_classify'
  | 'nut_advantage'
  | 'bluff_pick'
  | 'reflection_prompt'
  // ── Interactive theory ──
  | 'mdf_slider'       // adjustable bet-size slider; live MDF/alpha feedback
  | 'scenario_tree'    // multi-branch postflop decision tree simulation
  | 'range_heatmap'    // 13×13 grid with equity-density overlay for identification
  // ── Foundations (Lesson 1) ──
  | 'position_table'    // interactive 9-handed seat map — explore or quiz
  | 'combo_visualizer'  // card-combinatorics / card-removal visualization
  | 'action_sequence'   // animated action-line notation trainer
  | 'spr_visualizer'    // stack-to-pot proportional visualization
  | 'range_morphology'  // linear / polarized / condensed range-shape selector
  // ── Foundations Module 2 (Math Behind Every Decision) ──
  | 'pot_odds_explorer' // risk/reward chip visualization + bet-size slider for pot odds
  | 'equity_balance'    // required-equity vs actual-equity balance scale + call/fold decision
  | 'outs_deck'         // 47-card deck visualization for outs counting / drawing probability
  | 'ev_tree'           // EV decision tree: branches with probability × payoff → total EV
  | 'bluff_breakeven'   // fold-equity break-even visualizer for a bluff/semi-bluff bet
  | 'equity_realization' // equity-realization meters / position / spectrum / card-compare / calculator
  | 'range_compare'     // two 13×13 range grids rendered side-by-side for comparison
  // ── Preflop Foundation (Module 3) ──
  | 'players_behind'     // slider showing opponents still left to act + resistance-risk model
  | 'hand_dna'           // qualitative hand-property breakdown (high-card/suited/connected/nut/blocker/playability)
  | 'stack_depth_morph'  // shallow/medium/deep stack slider morphing a range grid
  | 'dead_money_visualizer' // ante on/off toggle + pot/incentive visualization
  | 'open_size_explorer' // opening bet-size slider with break-even-fold-% feedback
  | 'strategy_complexity' // simple-vs-complex strategy trade-off comparison
  | 'range_diff'         // canned-example three-color diff overlay (correct / missed / too-wide) vs a baseline
  // ── Preflop Aggression (Module 4) ──
  | 'range_bucket'       // assign a pool of hands into named buckets (value/bluff/call/fold, etc.)
  | 'morphology_builder' // construct a linear/polarized range from a pool, or classify a shown range's shape
  | 'blocker_lab'        // card-removal comparison: swap Hero's holding and see villain combos blocked
  | 'sizing_slider'      // reraise (3-bet/squeeze) sizing slider with live risk/pot/call-cost/SPR feedback
  // ── Defending the Open (Module 5) ──
  | 'defense_lens'       // six tappable factors (opener/price/position/players behind/stack/hand) — the module's reusable framework, unscored
  // ── Understanding the Flop (Module 6) ──
  | 'flop_scanner'          // multi-dimension "BoardDNA" panel — config-driven, always unscored explore/reveal
  | 'flop_classify_drill'   // rapid-fire tap classification over a list of boards, graded live against classifyFlop
  | 'suit_isomorphism'      // 'explain' = 22,100→1,755 collapse animation (unscored); 'sort' = same-pattern-or-not judgment (options-based)
  | 'flop_builder'          // assign suits / swap a card to hit a described target classification, validated against classifyFlop/estimateVolatility
  | 'straight_detective'    // tap the hole-card rank pairs that complete a possible flopped straight
  | 'board_volatility'      // Runout Storm / static-dynamic compare / continuum sort
  | 'range_board_collision' // two named ranges + a flop, card-removal-aware made/draw/miss visualization (uses `options` for its question)
  | 'equity_bucket'         // Strong/Good/Weak/Trash threshold, scenario, and distribution sub-modes
  | 'board_autopsy'         // a board plus an intentionally-flawed classification; learner flags the wrong fields, graded against classifyFlop
  // ── Poker Fundamentals (Module 1) ──
  | 'hand_ranking_order'    // drag/tap-reorder all 10 standard hand categories from strongest to weakest
  // ── Poker Fundamentals — Lesson 1 opening interactive beats ──
  | 'pot_win_intro'   // tap the pot on a live-looking table; chips animate to Hero. Unscored onboarding.
  | 'cards_identify'  // tap which dealt cards are Hero's private hole cards vs the shared community cards
  | 'build_first_hand' // tap the 5 cards (from Hero's hole cards + the board) that make Hero's best hand
  // ── C-Betting Fundamentals (Module 7) ──
  | 'range_distribution'    // two-range (Hero vs Villain) Strong/Good/Weak/Trash stacked-bar comparison
  | 'cbet_frequency_size'   // two-stage: aggregate betting-frequency bucket, then primary sizing bucket
  | 'board_rank_sort'       // order 3-5 boards from bets-most to bets-least by tap-to-reorder

export type ActionQuality = 'perfect' | 'good' | 'acceptable' | 'mistake' | 'punt'
export type LessonType = 'micro' | 'range_trainer' | 'puzzle_drill' | 'concept_reveal' | 'simulation'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite'
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5

// ── Step option (for decision_spot, bet_size_choose, bluff_pick) ──────────────

export interface StepOption {
  id: string
  label: string
  quality: ActionQuality
  ev_loss_bb?: number
  feedback: string
  concept_triggered?: string
  /** Optional structured breakdown shown alongside `feedback` (e.g. an enumerated list of
   *  rules) — rendered as highlighted term/description rows instead of folding everything
   *  into the feedback paragraph. Same convention as `concept_structured_items`. */
  feedback_structured_items?: { term: string; description: string }[]
}

// ── Scenario tree node (for scenario_tree step type) ────────────────────────

export interface ScenarioOutcome {
  ev_bb: number
  label: string
  quality: ActionQuality
  explanation: string
}

export interface ScenarioNode {
  id: string
  label: string
  description?: string
  /** Child branches the user can choose */
  children?: { option_label: string; node_id: string; is_optimal?: boolean }[]
  /** Terminal node result */
  outcome?: ScenarioOutcome
}

// ── A single interactive step within a lesson ─────────────────────────────────

export interface LessonStep {
  id: string
  type: StepType
  concept_ids?: string[]
  // Poker context
  board?: string[]
  hero_position?: string
  villain_position?: string
  hero_hand?: string[]
  pot_bb?: number
  effective_stack_bb?: number
  street?: 'preflop' | 'flop' | 'turn' | 'river'
  /** Table size (e.g. 6 for 6-max, 9 for full ring) — preflop context. */
  table_size?: number
  /** Ante size in bb, when the environment has one. Omit/0 for no-ante. */
  ante_bb?: number
  /** Rake as a fraction (e.g. 0.05 = 5%), when relevant to the exercise. */
  rake_pct?: number
  /** Number of players still left to act behind Hero (preflop RFI context). */
  players_behind?: number
  /** Action already taken before Hero, in order, e.g. ["UTG folds", "HJ folds"]. */
  action_before_hero?: string[]
  // Content
  narrative?: string
  /** decision_spot only: the exact question being tested, shown as the prominent
   *  heading below `narrative` (context). Use whenever the question is NOT already
   *  embedded as a trailing "...?" sentence inside `narrative`, and the options are
   *  not themselves poker actions (Fold/Call/Raise/etc — those get a generic action
   *  heading automatically). See LEARN_QUESTION_QA.md "QUESTION–INTERACTION ALIGNMENT". */
  decision_spot_question?: string
  options?: StepOption[]
  correct_answer?: string
  correct_feedback?: string
  wrong_feedback?: string
  // Range builder / range heatmap
  range_target?: string
  range_combos?: string[]
  range_tolerance?: number
  range_hint?: string
  /** range_build: after submitting, show an inline three-color diff (correct/missed/too-wide)
   *  against the target range before advancing to the generic score feedback. */
  range_build_show_diff?: boolean
  /** For range_heatmap: equity value per hand (0–100) keyed by hand notation */
  range_heatmap_data?: Record<string, number>
  /** For range_heatmap: which hands are in the "target" range to identify */
  range_heatmap_target?: string[]
  /** For range_heatmap: renders a 3-4 color action-map grid instead of the numeric equity gradient. */
  range_heatmap_action_map?: Record<string, 'raise' | 'limp' | 'shove' | 'fold'>
  // Equity predict (hand vs range)
  equity_actual?: number
  equity_tolerance?: number
  /** Villain's range shown as a 13x13 grid — hand notations e.g. ['88', 'KQs', 'JJ']. Required for a deterministic hand-vs-range target. */
  equity_villain_range?: string[]
  /** Explanation of WHY equity_actual has that value, tied to the exact hero hand / board / villain range. Shown after the learner answers. */
  equity_explanation?: string
  // Concept reveal content
  concept_content?: string
  concept_title?: string
  /** Optional structured breakdown of a genuinely categorical/sequential concept (e.g. the four
   *  streets, hand-ranking tiers, range shapes) — rendered as highlighted term/description rows
   *  instead of folding everything into `concept_content` prose. Shown after `concept_content`. */
  concept_structured_items?: { term: string; description: string }[]
  /** Short closing note shown after `concept_structured_items` (e.g. a caveat that applies to
   *  every row). Only meaningful alongside `concept_structured_items`. */
  concept_note?: string
  // MDF slider
  /** Question the user must answer via the slider */
  mdf_slider_question?: string
  /** Initial bet size displayed (% of pot, e.g. 50 = half-pot) */
  mdf_slider_initial_bet_pct?: number
  /** The numeric answer the user should land on (MDF% or alpha%) */
  mdf_slider_target?: number
  /** Tolerance for correct answer (default 3) */
  mdf_slider_tolerance?: number
  // Scenario tree
  scenario_root?: string
  scenario_nodes?: ScenarioNode[]
  // Position table (explore / quiz)
  /** 'explore' = tap-to-learn, unscored. 'quiz' = tap the correct seat(s), scored via `options`. */
  position_table_mode?: 'explore' | 'quiz'
  /** Seat id → short definition shown when tapped in explore mode. Falls back to a built-in map. */
  position_table_definitions?: Record<string, string>
  /** Quiz mode: which seats are tappable answer choices. */
  position_table_highlight?: string[]
  /** Quiz mode: the question shown above the table. */
  position_table_prompt?: string
  // Combo visualizer (combinatorics / card removal)
  /** 'reveal' = informational visualization, unscored. 'quiz' = numeric combo-count question. */
  combo_visualizer_mode?: 'reveal' | 'quiz'
  /** Which visual to render: a pocket-pair fan, an unpaired suited/offsuit split, or a removal/blocker board. */
  combo_visualizer_kind?: 'pair' | 'unpaired' | 'removal'
  /** Cards already known (hero hand + board) that remove combos from the deck. */
  combo_visualizer_known_cards?: string[]
  /** Rank or hand notation the visual/question is about, e.g. 'A' or 'AK'. */
  combo_visualizer_subject?: string
  combo_visualizer_correct?: number
  combo_visualizer_correct_feedback?: string
  combo_visualizer_wrong_feedback?: string
  // Action sequence (action-line notation trainer)
  /** Lines animated in sequence before the question, e.g. ["UTG raises to 2.5bb", "CO calls"]. */
  action_sequence_display?: string[]
  action_sequence_prompt?: string
  // SPR visualizer
  /** 'scenario' = numeric SPR question from stack/pot bars. 'worlds' = browse Low/Med/High SPR categories, unscored. */
  spr_visualizer_mode?: 'scenario' | 'worlds'
  spr_visualizer_pot_bb?: number
  spr_visualizer_stack_bb?: number
  spr_visualizer_correct?: number
  spr_visualizer_tolerance?: number
  // Range morphology (linear / polarized / condensed / capped-uncapped)
  range_morphology_prompt?: string
  // ── Foundations Module 2 (Math Behind Every Decision) ──────────────────────
  // Pot odds explorer — chip/pot visualization + optional bet-size slider
  /** 'fixed' = single scenario, tap RISK/REWARD to reveal. 'slider' = bet-size slider explorer (unscored).
   *  'build' = animated chip build-up then a question. 'challenge' = numeric required-equity question. */
  pot_odds_explorer_mode?: 'fixed' | 'slider' | 'build' | 'challenge'
  /** Starting pot before villain's bet. Falls back to `pot_bb`. */
  pot_odds_pot?: number
  /** Villain's bet size (same unit as pot). */
  pot_odds_bet?: number
  /** Preset bet sizes to step through in 'slider' mode. */
  pot_odds_slider_sizes?: number[]
  /** Question shown for 'challenge' mode. */
  pot_odds_prompt?: string
  /** Target required-equity % answer for 'challenge' mode. */
  pot_odds_correct?: number
  pot_odds_tolerance?: number
  // Equity balance — required-equity vs actual-equity scale, then CALL/FOLD (uses `options`)
  equity_balance_required?: number
  equity_balance_actual?: number
  equity_balance_prompt?: string
  // Outs deck — 47-card deck visualization for outs / drawing probability
  /** Which screen this deck renders; drives which fields below are read. */
  outs_deck_mode?: 'count_outs' | 'next_card' | 'turn_river' | 'quick_estimate' | 'clean_dirty' | 'backdoor' | 'speed_round'
  /** Known cards (hero hand + board) removed from the deck. Falls back to `hero_hand` + `board`. */
  outs_deck_known_cards?: string[]
  /** The specific cards that count as outs, e.g. the remaining hearts. */
  outs_deck_out_cards?: string[]
  /** Subset of `outs_deck_out_cards` that are actually "dirty" (counted nominally but excluded when clean). */
  outs_deck_dead_out_cards?: string[]
  /** Nominal out count when no explicit card list is given (e.g. speed-round text scenarios). */
  outs_deck_outs_count?: number
  /** Unseen-card count for the probability calc. Defaults to 47 (2 hole + 3 flop known). */
  outs_deck_unseen_count?: number
  outs_deck_question?: string
  /** Numeric target for quiz sub-modes (a percentage, or a clean-out count). */
  outs_deck_correct?: number
  outs_deck_tolerance?: number
  // EV decision tree — root action with weighted branches
  ev_tree_root_label?: string
  ev_tree_branches?: { label: string; probability: number; payoff: number }[]
  ev_tree_prompt?: string
  // Bluff break-even visualizer
  /** 'derive' = build-up to the 50% formula. 'slider' = bet-size slider explorer (unscored).
   *  'predict_compare' = which of two bets needs more folds. 'challenge' = numeric required-fold-% question. */
  bluff_breakeven_mode?: 'derive' | 'slider' | 'predict_compare' | 'challenge'
  bluff_breakeven_pot?: number
  bluff_breakeven_bet?: number
  bluff_breakeven_slider_sizes?: number[]
  /** 'predict_compare' mode: the two bets being compared. */
  bluff_breakeven_compare?: { label: string; pot: number; bet: number }[]
  bluff_breakeven_prompt?: string
  bluff_breakeven_correct?: number
  bluff_breakeven_tolerance?: number
  // Equity realization
  equity_realization_mode?: 'meters' | 'position' | 'spectrum' | 'card_compare' | 'spr_slider' | 'calculator'
  /** 'meters' / 'calculator': raw equity vs actual pot capture. */
  equity_realization_raw?: number
  equity_realization_captured?: number
  /** 'card_compare': two hands (each a 2-card array) shown side-by-side.
   *  `option_id`: when set on every hand AND it matches an id in `options`, the hand
   *  and its option are rendered as one bound, fully-clickable unit (see
   *  `interactionSafety.bindVisualOptions`) instead of a separate visual row plus an
   *  independently-shuffled option list — the pairing is what stops the anti-position-bias
   *  shuffle from separating an answer button from the visual it describes. */
  equity_realization_hands?: { label: string; cards: string[]; option_id?: string }[]
  equity_realization_prompt?: string
  /** 'calculator' numeric question target (e.g. resulting capture %). */
  equity_realization_correct?: number
  equity_realization_tolerance?: number
  // Range compare — two 13x13 grids side-by-side (uses `options` for the follow-up question)
  /** `option_id`: when BOTH sides set this to a matching id in `options`, the grid and its
   *  option are rendered as one bound, fully-clickable unit — see `equity_realization_hands`. */
  range_compare_a?: { label: string; range: string[]; option_id?: string }
  range_compare_b?: { label: string; range: string[]; option_id?: string }
  range_compare_prompt?: string
  // ── Preflop Foundation (Module 3) ──────────────────────────────────────────
  // Players behind — slider over opponents still left to act
  /** Preset player counts to step through (default 1..8). */
  players_behind_range?: number[]
  players_behind_prompt?: string
  /** Numeric challenge target (e.g. a resistance-risk % from the labelled model), if scored. */
  players_behind_correct?: number
  players_behind_tolerance?: number
  // Hand DNA — qualitative hand-property breakdown
  /** The hand to classify, e.g. 'A5s'. */
  hand_dna_subject?: string
  hand_dna_prompt?: string
  // Stack depth range morph
  /** Which position's baseline to morph (must exist in preflopBaselines.ts). */
  stack_depth_morph_position?: string
  /** Whether to color shallow-depth cells by action (raise/shove/fold) instead of plain membership. */
  stack_depth_morph_show_actions?: boolean
  stack_depth_morph_prompt?: string
  /** Which baseline dataset to morph. Defaults to 'rfi' (opening ranges, preflopBaselines.ts).
   *  'threebet_defense' reads threebetBaselines.ts; 'defend' reads defendBaselines.ts — both keyed by `stack_depth_morph_key`. */
  stack_depth_morph_dataset?: 'rfi' | 'threebet_defense' | 'defend'
  /** threebet_defense/defend dataset lookup key, e.g. 'BB_vs_BTN'. Ignored for the 'rfi' dataset. */
  stack_depth_morph_key?: string
  // Dead money visualizer — ante on/off
  dead_money_pot?: number
  dead_money_ante_bb?: number
  dead_money_prompt?: string
  // Open size explorer — sizing slider with break-even-fold feedback
  open_size_pot?: number
  /** Preset open sizes in bb to step through, e.g. [2, 2.25, 2.5, 3]. */
  open_size_slider_sizes?: number[]
  open_size_prompt?: string
  /** Numeric challenge target (required immediate-fold %), if scored. */
  open_size_correct?: number
  open_size_tolerance?: number
  // Strategy complexity meter — simple vs complex trade-off (uses `options` for its question)
  strategy_complexity_prompt?: string
  // Range diff — canned-example three-color overlay vs a baseline (uses `options` for the follow-up question)
  range_diff_baseline?: string[]
  /** The illustrative example range being compared against the baseline (not the learner's own answer). */
  range_diff_example?: string[]
  range_diff_prompt?: string
  // ── Preflop Aggression (Module 4) ──────────────────────────────────────────
  // Range bucket — assign a hand pool into named buckets
  /** Hands the learner must sort. */
  range_bucket_pool?: string[]
  /** The buckets available, in display order. */
  range_bucket_categories?: { id: string; label: string }[]
  /** Best-category id per hand — the primary scoring target. */
  range_bucket_correct?: Record<string, string>
  /** Optional secondary acceptable categories per hand (full credit, not just partial). */
  range_bucket_acceptable?: Record<string, string[]>
  range_bucket_prompt?: string
  // Morphology builder — construct linear/polarized ranges, or classify a shown range's shape
  /** 'build' = construct ranges from a pool. 'classify' = label a single shown range. */
  morphology_builder_mode?: 'build' | 'classify'
  /** 'build' mode: the shared hand pool to split into a linear and a polarized range. */
  morphology_builder_pool?: string[]
  /** 'classify' mode: the range being shown for labeling. */
  morphology_builder_range?: string[]
  morphology_builder_prompt?: string
  // Blocker lab — card-removal comparison across candidate holdings
  /** Villain's illustrative continuing range (hand notations) whose combos get reduced. */
  blocker_lab_villain_range?: string[]
  /** Candidate Hero holdings to compare, e.g. ['A5s', 'K5s', '76s', 'QJo']. */
  blocker_lab_candidates?: string[]
  blocker_lab_prompt?: string
  // Sizing slider — reraise (3-bet/squeeze) sizing with live risk/pot/SPR feedback
  /** Pot size before Hero's reraise (open size + any dead money/callers already in). */
  sizing_slider_pot?: number
  /** Preset reraise sizes (in bb) to step through. */
  sizing_slider_sizes?: number[]
  /** The original opener's bet already in the pot (their call cost if Hero's reraise is called). */
  sizing_slider_open_size?: number
  /** A caller already in the pot ahead of Hero's reraise (squeeze reuse), if any. */
  sizing_slider_caller_in?: number
  sizing_slider_prompt?: string
  // ── Defending the Open (Module 5) ──────────────────────────────────────────
  // Defense lens — six tappable factors, each revealing one sentence. Unscored, reusable framework.
  defense_lens_facts?: {
    opener?: string
    price?: string
    position?: string
    players_behind?: string
    stack?: string
    hand?: string
  }
  // ── Understanding the Flop (Module 6) ───────────────────────────────────────
  // Flop scanner — multi-dimension BoardDNA panel. Always unscored; `board` supplies the cards.
  /** Which classification panels are unlocked/shown, in display order. */
  flop_scanner_dimensions?: ('structure' | 'texture' | 'two_tone_subtype' | 'highest_rank' | 'rank_family' | 'possible_straights' | 'volatility')[]
  flop_scanner_prompt?: string
  // Flop classify drill — one board at a time, tap the correct classification.
  // Correctness is derived live from `classifyFlop`, never hand-authored.
  flop_classify_drill_dimension?: import('./flopClassifier').FlopDimensionKey
  flop_classify_drill_boards?: string[][]
  flop_classify_drill_prompt?: string
  // Suit isomorphism — 'explain' unscored animation; 'sort' is a same/different judgment (uses `options`)
  suit_isomorphism_mode?: 'explain' | 'sort'
  suit_isomorphism_board_a?: string[]
  suit_isomorphism_board_b?: string[]
  suit_isomorphism_prompt?: string
  // Flop builder — assign suits (fixed ranks) or swap one card (fixed base board) to hit a target.
  /** 'assign_suits': ranks are fixed, learner picks suits. 'swap_one_card': one card of `flop_builder_base_board` may change. */
  flop_builder_mode?: 'assign_suits' | 'swap_one_card'
  /** assign_suits mode: the three fixed ranks, e.g. ['A','K','6']. */
  flop_builder_fixed_ranks?: string[]
  /** swap_one_card mode: the starting board; exactly one card may differ in the submission. */
  flop_builder_base_board?: string[]
  flop_builder_prompt?: string
  /** The target the constructed board must satisfy — checked live against `classifyFlop`/`estimateVolatility`. */
  flop_builder_target?: {
    structure?: import('./flopClassifier').FlopStructure
    texture?: import('./flopClassifier').FlopTexture
    twoToneSubtype?: import('./flopClassifier').TwoToneSubtype
    minStraights?: number
    maxStraights?: number
    volatilityAtLeast?: import('./flopClassifier').VolatilityLevel
    volatilityAtMost?: import('./flopClassifier').VolatilityLevel
  }
  // Straight detective — tap the hole-card rank pairs that complete a possible straight.
  /** Falls back to `board`. */
  straight_detective_board?: string[]
  /** Extra non-answer rank pairs shown as tappable decoys (real misconceptions, not jokes). */
  straight_detective_decoys?: [string, string][]
  straight_detective_prompt?: string
  // Board volatility — Runout Storm / static-dynamic compare / continuum sort.
  board_volatility_mode?: 'runout_storm' | 'compare' | 'continuum_sort'
  /** runout_storm mode: falls back to `board`. */
  board_volatility_board?: string[]
  /** runout_storm mode: representative turn cards shown as tappable "changes the picture?" options. */
  board_volatility_storm_pool?: string[]
  /** compare mode: the two boards being judged (uses `options` for the actual question). */
  board_volatility_compare_a?: string[]
  board_volatility_compare_b?: string[]
  /** continuum_sort mode: boards to order from most static to most dynamic. */
  board_volatility_continuum_boards?: { id: string; board: string[] }[]
  board_volatility_prompt?: string
  // Range × board collision — two named ranges against one flop (uses `options` for the follow-up question)
  range_board_collision_a?: { label: string; range: string[] }
  range_board_collision_b?: { label: string; range: string[] }
  range_board_collision_prompt?: string
  // Equity bucket — Strong>=75 / Good 50-75 / Weak 33-50 / Trash<33 (exact source thresholds)
  equity_bucket_mode?: 'threshold' | 'scenario' | 'distribution'
  /** threshold mode: an abstract equity % value to place into a bucket. */
  equity_bucket_value?: number
  /** scenario mode: a hand-derived (combo-counted), auditable equity % — never fabricated. */
  equity_bucket_scenario_actual?: number
  equity_bucket_scenario_hero_hand?: string[]
  /** scenario mode: the combo-counting derivation, shown after the learner answers. */
  equity_bucket_scenario_explanation?: string
  /** distribution mode: a range and its precomputed per-hand equity vs a stated opponent range (uses `options` for the actual question). */
  equity_bucket_distribution_range?: string[]
  equity_bucket_distribution_data?: Record<string, number>
  equity_bucket_prompt?: string
  // Board autopsy — a board plus a flawed classification; learner flags which fields are wrong.
  // Ground truth is derived live from `classifyFlop`, never hand-authored, by design.
  board_autopsy_board?: string[]
  board_autopsy_claimed?: Partial<Record<import('./flopClassifier').FlopDimensionKey, string>>
  board_autopsy_prompt?: string
  // Hand ranking order — drag/tap-reorder all 10 standard categories from strongest to weakest.
  // Array order IS the correct order (index 0 = strongest); the component shuffles a
  // display copy deterministically via shuffleBySeed(items, step.id).
  hand_ranking_order_items?: { id: string; label: string; example: string[] }[]
  hand_ranking_order_prompt?: string
  // ── Lesson 1 opening interactive beats ──────────────────────────────────────
  // Pot win intro — Step 1: a live-looking table (built from `pot_win_intro_seats`),
  // Hero's cards stay face-down throughout. Tapping the pot animates chips to Hero.
  pot_win_intro_seats?: { id: string; label: string; isHero: boolean; stack: number }[]
  pot_win_intro_pot?: number
  pot_win_intro_prompt?: string
  // Cards identify — Step 2: Hero's `hero_hand` deal face-up alongside 5 face-down
  // community placeholders. Learner taps which cards are Hero's alone.
  cards_identify_prompt?: string
  // Build first hand — Step 3: all 7 cards (`hero_hand` + `board`) are shown face-up;
  // learner taps the 5 that form Hero's best hand. `build_first_hand_correct` is the
  // target 5-card answer (a subset of hero_hand ∪ board).
  build_first_hand_prompt?: string
  build_first_hand_correct?: string[]
  // ── C-Betting Fundamentals (Module 7) ───────────────────────────────────────
  // Range distribution — two-range (Hero vs Villain) Strong/Good/Weak/Trash stacked-bar comparison.
  /** Each entry sums to ~100 (strong+good+weak+trash). Labeled illustrative, not solver-exact, on-screen. */
  range_distribution_hero?: { label: string; strong: number; good: number; weak: number; trash: number }
  range_distribution_villain?: { label: string; strong: number; good: number; weak: number; trash: number }
  range_distribution_prompt?: string
  /** 'predict' shows draggable/tappable blocks first, learner guesses the shape before the reveal (Lesson 3's
   *  "Build the Distribution"). 'reveal' shows both bars immediately, for spots where prediction isn't the point. */
  range_distribution_mode?: 'predict' | 'reveal'
  // C-bet frequency + size lab — two-stage: frequency bucket, then sizing bucket.
  /** Which frequency buckets are selectable, in display order (scenario-scoped — not every scenario offers all 5). */
  cbet_frequency_size_frequency_options?: { id: string; label: string }[]
  /** Which sizing buckets are selectable, in display order (scenario-scoped, e.g. no BIG on a scenario that doesn't support it). */
  cbet_frequency_size_sizing_options?: { id: string; label: string }[]
  cbet_frequency_size_prompt?: string
  /** Scored via `options`: the id is `${frequencyId}|${sizingId}`, so authors grade the COMBINATION, not each stage alone. */
  // Board rank sort — order 3-5 boards from bets-most to bets-least.
  board_rank_sort_boards?: { id: string; label: string; board: string[] }[]
  /** Ground truth order, id list, most-bet first. Hand-authored — c-bet frequency ranking isn't a deterministic function of the board. */
  board_rank_sort_target?: string[]
  board_rank_sort_prompt?: string
  // Visual
  visual?: 'table' | 'range_grid' | 'equity_bar' | 'heatmap' | 'pressure_chart'
  // ── Adaptive system (confidence + remediation) ─────────────────────────────
  /** Show a LOW/MEDIUM/HIGH confidence prompt before this step is answered. Author opt-in — not every step. */
  ask_confidence?: boolean
  /** Ordered alternate representations of this step's concept, injected one at a time on repeated misses. */
  remediation_ladder?: LessonStep[]
  /** A single short follow-up shown after a correct-but-low-confidence answer. */
  reinforcement_step?: LessonStep
  // XP
  xp?: number
}

// ── Chapter grouping (optional; groups a lesson's flat step array) ───────────

export interface LessonChapter {
  title: string
  step_ids: string[]
}

// ── A complete lesson ─────────────────────────────────────────────────────────

export interface Lesson {
  id: string
  module_id: string
  slug: string
  title: string
  /** Short line shown under the title on the intro screen. */
  subtitle?: string
  lesson_type: LessonType
  concept_ids: string[]
  steps: LessonStep[]
  /** Optional grouping of `steps` into chapters, shown as "Chapter X of N" progress. */
  chapters?: LessonChapter[]
  estimated_min: number
  xp_reward: number
  sort_order: number
  /** Teaser title for the next lesson in the journey, shown on completion even before that lesson exists. */
  next_lesson_teaser?: string
}

// ── Poker Journey roadmap (13 stages, 28 modules — linear academy) ───────────

/** 'complete' = module is live/playable today. 'placeholder' / 'planned' = roadmap-only, not yet built. */
export type ModuleContentStatus = 'complete' | 'placeholder' | 'planned'
export type ModuleAccess = 'free' | 'premium'

/** A lightweight, non-interactive lesson descriptor for roadmap/"Coming Soon" display — never a playable Lesson. */
export interface PlannedLesson {
  title: string
  description?: string
}

/** One of the 13 stages that group the 28 modules into the linear Poker Journey. */
export interface JourneyStage {
  id: string
  order: number
  title: string
  subtitle?: string
  moduleIds: string[]
}

// ── A learning module (group of lessons) ─────────────────────────────────────

export interface LearningModule {
  id: string
  path_id: string
  slug: string
  title: string
  description: string
  concept_ids: string[]
  unlock_after: string[]
  sort_order: number
  xp_reward: number
  lessons?: Lesson[]
  // ── Poker Journey roadmap metadata (optional — populated as modules are designed) ──
  subtitle?: string
  learningObjectives?: string[]
  difficulty?: Difficulty
  estimatedLessons?: number
  /** Preferred over `unlock_after` for the linear journey — the single module that must be completed first. */
  prerequisiteModuleId?: string
  contentStatus?: ModuleContentStatus
  access?: ModuleAccess
  /** JourneyStage id this module belongs to. */
  stageId?: string
  /** Global 1–28 position in the Poker Journey. */
  order?: number
  /** Roadmap-only lesson titles shown on a "Coming Soon" module page — not playable Lesson objects. */
  plannedLessons?: PlannedLesson[]
}

// ── A learning path (Beginner / Intermediate / Advanced) ─────────────────────

export interface LearningPath {
  id: string
  title: string
  description: string
  tier_required: 'free' | 'pro' | 'premium'
  sort_order: number
  modules?: LearningModule[]
}

// ── User progress on a lesson ─────────────────────────────────────────────────

export interface UserLessonProgress {
  user_id: string
  lesson_id: string
  status: 'locked' | 'available' | 'started' | 'complete'
  attempts: number
  best_score: number
  last_score: number
  completed_at?: string
  time_spent_sec: number
}

// ── Per-concept mastery ───────────────────────────────────────────────────────

export interface UserConceptMastery {
  user_id: string
  concept_id: string
  mastery_level: MasteryLevel
  exposures: number
  correct_streak: number
  last_tested?: string
  ease_factor: number
  interval_days: number
  next_review?: string
}

// ── Overall user skill progress ───────────────────────────────────────────────

export interface UserSkillProgress {
  user_id: string
  total_xp: number
  level: number
  streak_days: number
  last_active?: string
  unlocked_paths: string[]
  achievements: string[]
}

// ── A detected leak ───────────────────────────────────────────────────────────

export interface UserLeak {
  id: string
  user_id: string
  concept_id: string
  node_type: string
  leak_type: string
  severity: 'mild' | 'moderate' | 'severe'
  evidence_count: number
  last_seen: string
  resolved: boolean
}

// ── Evaluation pipeline metadata ─────────────────────────────────────────────

export type EvaluationSource = 'solver' | 'theory_engine' | 'heuristic' | 'failed'
export type EvaluationConfidence = 'high' | 'medium' | 'low' | null

/**
 * Structured "what was the correct answer" reveal, computed by evaluator.ts
 * from the SAME data used to score the response — never a separately
 * hand-authored key. Populated only when the learner's answer wasn't fully
 * correct (so a perfect answer never gets an unnecessary comparison), and
 * omitted entirely for step types whose own component already renders a
 * richer item-by-item reveal (range_bucket, board_rank_sort, hand_ranking_order,
 * straight_detective, board_autopsy, range_build, range_heatmap).
 */
export interface AnswerReveal {
  /** Terminology appropriate to the interaction, e.g. "Correct play", "Correct classification", "Correct answer". */
  term: string
  /** The correct/preferred answer's display value. If more than one option is equally correct, joined with " or ". */
  correct: string
  /** The learner's own answer's display value, when worth contrasting directly against `correct`. */
  yours?: string
  /** Other answers the evaluator also accepts as correct, distinct from the primary `correct` value (used for partial-credit "preferred vs also acceptable" cases). */
  alsoAccepted?: string[]
}

// ── Step evaluation result from API ──────────────────────────────────────────

export interface StepResult {
  score: number
  quality: ActionQuality
  ev_loss_bb: number
  feedback: string
  concept_triggered?: string
  xp_earned: number
  level_before: number
  level_after: number
  leveled_up: boolean
  concept_explanation?: string
  /** Structured breakdown to render alongside `feedback`, carried through from the
   *  answered option's `feedback_structured_items`. See `StepOption`. */
  structured_points?: { term: string; description: string }[]
  /** "What was the correct answer" reveal — see `AnswerReveal`. Undefined when the
   *  answer was fully correct, or when the step's own component already shows a
   *  richer item-by-item reveal. */
  answer_reveal?: AnswerReveal
  // Evaluation pipeline metadata — always present from v2 onwards
  evaluation_source: EvaluationSource
  confidence: EvaluationConfidence
  evaluation_valid: boolean
  fallback_used: boolean
  error_type?: string
  /** Learner's self-reported confidence, captured before answering — only present on steps with `ask_confidence`.
   *  Distinct from `confidence` above, which is the evaluation pipeline's own confidence in the result. */
  learner_confidence?: 'low' | 'medium' | 'high'
  /** True for passive/informational steps (concept_reveal, exploration modes of the
   *  various visualizer steps) that had nothing to grade. When true, `score`/`quality`
   *  are meaningless placeholders and `xp_earned` is always 0 — the UI must never render
   *  a graded result screen ("Perfect Play"/"Score: X/100") for these, only advance. */
  unscored: boolean
}

// ── Sentinel: explicit failed result (no fake scores/XP) ─────────────────────

export function makeFailedResult(errorType = 'network_error'): StepResult {
  return {
    score: 0,
    quality: 'punt',          // never displayed in failed state
    ev_loss_bb: 0,
    feedback: '',
    xp_earned: 0,             // NO XP for failed evaluations
    level_before: 0,
    level_after: 0,
    leveled_up: false,
    evaluation_source: 'failed',
    confidence: null,
    evaluation_valid: false,
    fallback_used: false,
    error_type: errorType,
    unscored: false,
  }
}

// ── Personalized dashboard ────────────────────────────────────────────────────

export interface PersonalizedDashboard {
  skill_progress: UserSkillProgress
  recommended_lesson?: {
    slug: string
    title: string
    reason: string
    concept_id?: string
  }
  review_concepts: UserConceptMastery[]
  active_leaks: UserLeak[]
  insight?: string
  coach_prompt?: string
  streak_status: {
    days: number
    bonus_xp: number
  }
}

// ── Concept node ──────────────────────────────────────────────────────────────

export interface ConceptNode {
  id: string
  title: string
  domain: string
  difficulty: Difficulty
  summary: string
  full_content?: {
    beginner: string
    intermediate: string
    advanced: string
  }
  formula?: string
  visual_type?: string
  tags: string[]
}

// ── AI coach ──────────────────────────────────────────────────────────────────

export interface CoachMessage {
  role: 'user' | 'coach'
  content: string
  timestamp: string
  concept_ids?: string[]
}

// ── Training session ──────────────────────────────────────────────────────────

export interface TrainingSession {
  id: string
  user_id: string
  session_type: string
  context: Record<string, unknown>
  messages: CoachMessage[]
  started_at: string
  updated_at: string
}

// ── XP / level utilities ──────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000,
  5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000, 26000,
]

export function levelForXP(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

export function xpToNextLevel(xp: number): { current: number; needed: number; pct: number } {
  const level = levelForXP(xp)
  const currentFloor = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextCeil = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 10000
  const current = xp - currentFloor
  const needed = nextCeil - currentFloor
  return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) }
}

// ── Display constants ─────────────────────────────────────────────────────────

export const QUALITY_COLORS: Record<ActionQuality, string> = {
  perfect:    'text-emerald-400',
  good:       'text-blue-400',
  acceptable: 'text-amber-400',
  mistake:    'text-orange-400',
  punt:       'text-red-400',
}

export const QUALITY_LABELS: Record<ActionQuality, string> = {
  perfect:    'Perfect Play',
  good:       'Good Play',
  acceptable: 'Acceptable',
  mistake:    'Mistake',
  punt:       'Major Leak',
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  0: 'Unseen',
  1: 'Exposed',
  2: 'Learning',
  3: 'Familiar',
  4: 'Proficient',
  5: 'Mastered',
}

// ── Achievement system ────────────────────────────────────────────────────────

export type AchievementCategory =
  | 'learning'
  | 'consistency'
  | 'mastery'
  | 'exploration'
  | 'performance'

export interface Achievement {
  id: string
  title: string
  description: string
  /** Lucide icon name or emoji fallback */
  icon: string
  category: AchievementCategory
  /** Human-readable unlock condition */
  condition: string
  xp_bonus: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export const ACHIEVEMENTS: Achievement[] = [
  // Learning milestones
  {
    id: 'first_lesson',
    title: 'First Steps',
    description: 'Completed your first lesson',
    icon: '🎯',
    category: 'learning',
    condition: 'Complete 1 lesson',
    xp_bonus: 25,
    tier: 'bronze',
  },
  {
    id: 'ten_lessons',
    title: 'Knowledge Seeker',
    description: 'Completed 10 lessons',
    icon: '📚',
    category: 'learning',
    condition: 'Complete 10 lessons',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'fifty_lessons',
    title: 'Scholar',
    description: 'Completed 50 lessons',
    icon: '🎓',
    category: 'learning',
    condition: 'Complete 50 lessons',
    xp_bonus: 500,
    tier: 'gold',
  },
  {
    id: 'path_complete_beginner',
    title: 'Foundation Builder',
    description: 'Completed the Foundations path',
    icon: '🏗️',
    category: 'learning',
    condition: 'Complete all Foundations modules',
    xp_bonus: 300,
    tier: 'silver',
  },
  {
    id: 'path_complete_intermediate',
    title: 'Range Thinker',
    description: 'Completed the Range Thinking path',
    icon: '🎰',
    category: 'learning',
    condition: 'Complete all Range Thinking modules',
    xp_bonus: 600,
    tier: 'gold',
  },
  {
    id: 'path_complete_advanced',
    title: 'GTO Warrior',
    description: 'Completed the GTO Mastery path',
    icon: '⚔️',
    category: 'mastery',
    condition: 'Complete all GTO Mastery modules',
    xp_bonus: 1000,
    tier: 'gold',
  },
  {
    id: 'path_complete_pro',
    title: 'Solver Elite',
    description: 'Completed the Pro/Elite path',
    icon: '👑',
    category: 'mastery',
    condition: 'Complete all Pro/Elite modules',
    xp_bonus: 2000,
    tier: 'platinum',
  },
  // Consistency
  {
    id: 'streak_3',
    title: 'Consistent',
    description: '3-day learning streak',
    icon: '🔥',
    category: 'consistency',
    condition: 'Study 3 days in a row',
    xp_bonus: 30,
    tier: 'bronze',
  },
  {
    id: 'streak_7',
    title: 'On Fire',
    description: '7-day learning streak',
    icon: '🔥',
    category: 'consistency',
    condition: 'Study 7 days in a row',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'streak_30',
    title: 'Unstoppable',
    description: '30-day learning streak',
    icon: '⚡',
    category: 'consistency',
    condition: 'Study 30 days in a row',
    xp_bonus: 500,
    tier: 'gold',
  },
  // Performance
  {
    id: 'perfect_lesson',
    title: 'Flawless',
    description: 'Perfect score on a lesson',
    icon: '💎',
    category: 'performance',
    condition: 'Score 100% on any lesson',
    xp_bonus: 50,
    tier: 'silver',
  },
  {
    id: 'five_perfects',
    title: 'Sharp Mind',
    description: 'Five perfect lesson scores',
    icon: '🧠',
    category: 'performance',
    condition: 'Score 100% on 5 different lessons',
    xp_bonus: 200,
    tier: 'gold',
  },
  // Mastery
  {
    id: 'concept_mastered',
    title: 'Concept Locked In',
    description: 'Mastered a concept (level 5)',
    icon: '🔒',
    category: 'mastery',
    condition: 'Reach mastery level 5 on any concept',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'ten_concepts_mastered',
    title: 'Poker Scholar',
    description: 'Mastered 10 concepts',
    icon: '📖',
    category: 'mastery',
    condition: 'Reach mastery level 5 on 10 concepts',
    xp_bonus: 400,
    tier: 'gold',
  },
  // Exploration
  {
    id: 'leak_resolved',
    title: 'Leak Plugged',
    description: 'Resolved your first detected leak',
    icon: '🔧',
    category: 'exploration',
    condition: 'Fix a leak identified from hand analysis',
    xp_bonus: 100,
    tier: 'bronze',
  },
  {
    id: 'coach_conversation',
    title: 'Student of the Game',
    description: 'Had your first AI coaching session',
    icon: '🤝',
    category: 'exploration',
    condition: 'Complete an AI coaching conversation',
    xp_bonus: 50,
    tier: 'bronze',
  },
  {
    id: 'level_10',
    title: 'Rising Star',
    description: 'Reached Level 10',
    icon: '⭐',
    category: 'mastery',
    condition: 'Reach Level 10',
    xp_bonus: 250,
    tier: 'silver',
  },
  {
    id: 'level_20',
    title: 'Elite Player',
    description: 'Reached Level 20',
    icon: '🌟',
    category: 'mastery',
    condition: 'Reach Level 20',
    xp_bonus: 1000,
    tier: 'platinum',
  },
  // Math Behind Every Decision (Module 2)
  {
    id: 'price_is_right',
    title: 'Price Is Right',
    description: 'Completed the Pot Odds lesson with high accuracy',
    icon: '🎯',
    category: 'learning',
    condition: 'Score 90%+ on "The Price of a Call"',
    xp_bonus: 50,
    tier: 'bronze',
  },
  {
    id: 'clean_outs',
    title: 'Clean Outs',
    description: 'Perfect score on the clean vs. dead outs challenge',
    icon: '🃏',
    category: 'performance',
    condition: 'Perfect score on the clean/dead outs challenge in "Count Your Ways to Win"',
    xp_bonus: 50,
    tier: 'silver',
  },
  {
    id: 'long_term_thinker',
    title: 'Long-Term Thinker',
    description: 'Completed the Expected Value lesson',
    icon: '📈',
    category: 'learning',
    condition: 'Complete "Think in Expected Value"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'no_showdown_needed',
    title: 'No Showdown Needed',
    description: 'Mastered fold equity',
    icon: '🃏',
    category: 'mastery',
    condition: 'Complete "Winning Without Showdown" with high accuracy',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'realize_your_potential',
    title: 'Realize Your Potential',
    description: 'Completed the Equity Realization lesson',
    icon: '💡',
    category: 'learning',
    condition: 'Complete "Equity Isn\'t Everything"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'decision_scientist',
    title: 'Decision Scientist',
    description: 'Completed the Module 2 Decision Lab',
    icon: '🔬',
    category: 'mastery',
    condition: 'Complete the "Decision Lab" capstone',
    xp_bonus: 150,
    tier: 'gold',
  },
  // Building Your Preflop Foundation (Module 3)
  {
    id: 'first_in',
    title: 'First In',
    description: 'Completed the "First In" lesson',
    icon: '🚩',
    category: 'learning',
    condition: 'Complete "First In"',
    xp_bonus: 50,
    tier: 'bronze',
  },
  {
    id: 'range_architect',
    title: 'Range Architect',
    description: 'Built a strong opening range from scratch',
    icon: '🏛️',
    category: 'performance',
    condition: 'Score well on a range-building exercise in Module 3',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'position_pays',
    title: 'Position Pays',
    description: 'Mastered position-based RFI strategy',
    icon: '🪑',
    category: 'mastery',
    condition: 'Complete "The Players Behind You"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'stack_aware',
    title: 'Stack Aware',
    description: 'Completed stack-depth preflop training',
    icon: '📏',
    category: 'learning',
    condition: 'Complete "Stacks Change the Range"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'blind_specialist',
    title: 'Blind Specialist',
    description: 'Completed the Small Blind lesson',
    icon: '👁️',
    category: 'mastery',
    condition: 'Complete "The Small Blind Is Different"',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'preflop_foundation',
    title: 'Preflop Foundation',
    description: 'Completed Module 3: Building Your Preflop Foundation',
    icon: '🧱',
    category: 'mastery',
    condition: 'Complete the "Preflop Foundation Lab" capstone',
    xp_bonus: 150,
    tier: 'gold',
  },
  {
    id: 'first_three_bet',
    title: 'First Three-Bet',
    description: 'Completed "The 3-Bet"',
    icon: '⚡',
    category: 'learning',
    condition: 'Complete "The 3-Bet"',
    xp_bonus: 50,
    tier: 'bronze',
  },
  {
    id: 'range_architect_ii',
    title: 'Range Architect II',
    description: 'Built a well-shaped 3-betting range from scratch',
    icon: '🏛️',
    category: 'performance',
    condition: 'Score well on a 3-bet range-construction exercise in Module 4',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'polarity_reader',
    title: 'Polarity Reader',
    description: 'Correctly distinguished linear from polarized ranges',
    icon: '🧲',
    category: 'mastery',
    condition: 'Complete "Shape of Aggression"',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'blocker_master',
    title: 'Blocker Master',
    description: 'Used card removal to sharpen a bluff selection',
    icon: '🃏',
    category: 'mastery',
    condition: 'Complete "Block the Continue"',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'squeeze_specialist',
    title: 'Squeeze Specialist',
    description: 'Mastered squeeze construction and sizing',
    icon: '🤏',
    category: 'mastery',
    condition: 'Complete "The Squeeze"',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'resistance_tested',
    title: 'Resistance Tested',
    description: 'Learned to survive re-raises after opening',
    icon: '🛡️',
    category: 'mastery',
    condition: 'Complete "They Raised Back"',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'preflop_aggression_capstone',
    title: 'Preflop Aggressor',
    description: 'Completed Module 4: Preflop Aggression',
    icon: '🔺',
    category: 'mastery',
    condition: 'Complete the "Preflop Aggression Lab" capstone',
    xp_bonus: 200,
    tier: 'gold',
  },
  {
    id: 'hold_the_line',
    title: 'Hold the Line',
    description: 'Completed "Someone Opened"',
    icon: '🚪',
    category: 'learning',
    condition: 'Complete "Someone Opened"',
    xp_bonus: 50,
    tier: 'bronze',
  },
  {
    id: 'price_is_right',
    title: 'Price Is Right',
    description: 'Mastered calling-price exercises',
    icon: '🏷️',
    category: 'performance',
    condition: 'Score well on "The Price"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'blind_defender',
    title: 'Blind Defender',
    description: 'Completed the Big Blind and Small Blind defense lessons',
    icon: '🛡️',
    category: 'mastery',
    condition: 'Complete "The Big Blind Discount" and "The Small Blind Problem"',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'range_mechanic',
    title: 'Range Mechanic',
    description: 'Repaired a flawed defense range',
    icon: '🔧',
    category: 'performance',
    condition: 'Successfully repair a leaking defense range in Module 5',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'defense_architect',
    title: 'Defense Architect',
    description: 'Built a complete, sound defense range from scratch',
    icon: '🏗️',
    category: 'mastery',
    condition: 'Complete "Range Architect: Defense"',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'hold_your_ground',
    title: 'Hold Your Ground',
    description: 'Completed Module 5: Defending the Open',
    icon: '⛰️',
    category: 'mastery',
    condition: 'Complete the "Defense Room" capstone',
    xp_bonus: 200,
    tier: 'gold',
  },
  // Understanding the Flop (Module 6)
  {
    id: 'board_reader',
    title: 'Board Reader',
    description: 'Learned to classify a flop by structure, texture, and rank',
    icon: '🔍',
    category: 'learning',
    condition: 'Complete "The Flop Has a Language" and "Board Structure"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'straight_detective',
    title: 'Straight Detective',
    description: 'Correctly identified every possible flopped straight in a set of boards',
    icon: '🕵️',
    category: 'performance',
    condition: 'Perfect score on a Straight Detective challenge',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'storm_chaser',
    title: 'Storm Chaser',
    description: 'Mastered static vs. dynamic board reading',
    icon: '🌩️',
    category: 'mastery',
    condition: 'Complete "Will This Board Stay the Same?"',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'flop_analyst',
    title: 'Flop Analyst',
    description: 'Completed Module 6: Understanding the Flop',
    icon: '🧪',
    category: 'mastery',
    condition: 'Complete the "Flop Laboratory" capstone',
    xp_bonus: 200,
    tier: 'gold',
  },
  {
    id: 'range_reader',
    title: 'Range Reader',
    description: 'Correctly identified range distributions, not just raw equity',
    icon: '📊',
    category: 'performance',
    condition: 'Score well on "Range Advantage Is Not Enough"',
    xp_bonus: 75,
    tier: 'silver',
  },
  {
    id: 'pressure_point',
    title: 'Pressure Point',
    description: 'Mastered c-bet frequency decisions',
    icon: '🎯',
    category: 'mastery',
    condition: 'Complete "High-Frequency C-Bets" and "When the C-Bet Slows Down"',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'size_matters',
    title: 'Size Matters',
    description: 'Completed the bet-sizing lab',
    icon: '📏',
    category: 'performance',
    condition: 'Complete "Small Bet or Big Bet?"',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'cbet_architect',
    title: 'C-Bet Architect',
    description: 'Completed Module 7: C-Betting Fundamentals',
    icon: '🏛️',
    category: 'mastery',
    condition: 'Complete "The C-Bet Decision Lab" capstone',
    xp_bonus: 200,
    tier: 'gold',
  },
]
