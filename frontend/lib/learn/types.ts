// ── Step types ────────────────────────────────────────────────────────────────

export type StepType =
  | 'concept_reveal'
  | 'decision_spot'
  | 'range_build'
  | 'range_build_multi'  // per-hand action assignment (raise/limp/jam/fold) graded against a real MttRfiChart
  | 'table_decision'     // visual poker-table decision drill for one (chart, hand) pair, with inline post-answer range reveal
  | 'mtt_stack_depth_compare' // 4-stop (15/25/40/60bb) slider comparison of one position's MTT_RFI_CHARTS, with an action-diff toggle
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
  | 'board_rank_sort'       // order 3-5 boards from bets-most to bets-least by tap-to-reorder (or drag-to-spectrum, see board_rank_sort_layout)
  // ── Range vs Range (Module 8) ──
  | 'range_collision'       // Range Collision Viewer: two full 13x13 ranges + a board, in 'reveal'/'predict'/'morph'/'archaeology' modes
  | 'range_equity_predict'  // slider estimate of a range-vs-range equity split, then reveal vs a book-cited number
  | 'range_xray'            // Strong/Good/Weak/Trash equity-bucket bar(s); numeric where book-supported, else qualitative
  // ── Blockers & Card Removal (Module 9) ──
  | 'combo_removal'         // tap individual concrete 2-card combo tiles to mark them impossible given known cards; scored against actual card-removal math
  | 'flush_pyramid'         // a monotone-heavy board's flush combos split into tiers by high card (derived via flushTiers, never authored); tap the tiers a known card affects
  // ── Cross-step tendency summary (reusable capstone pattern) ──
  | 'tendency_summary'      // reads this playthrough's actual results from `summary_source_step_ids`, grouped by `tendency_tag` — a genuinely personalized "here's the pattern in what you just did" closer, unscored
  // ── Game Theory Foundations (Module 10) ─────────────────────────────────────
  | 'strategy_response_lab'    // A→B→A strategy feedback loop: intro/best_response/counter_exploit/iterate modes, powered by gameTheoryEngine.ts
  | 'clairvoyance_lab'         // the AA/QQ-vs-KK polarized toy game — a three-frequency tug of war, exact_derived from gameTheoryEngine.ts's clairvoyanceEV
  | 'ev_indifference_balance'  // two-action EV bars + opponent-frequency slider; the learner searches for EV(A) = EV(B)
  | 'unilateral_deviation_test' // "can this player improve by changing strategy alone?" — the Nash-equilibrium test, one player at a time

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

// ── Scenario comparison (paired poker states for a comparative question) ──────

/**
 * One side of a two-scenario comparison — see `LessonStep.scenario_a`/`scenario_b`.
 * A strict subset of `LessonStep`'s own poker-context fields so it feeds the SAME
 * `buildPreflopTableRenderState`/`PreflopTable` pipeline every other preflop step
 * uses (see ScenarioComparison.tsx) — never a second table-state engine. Nothing
 * here is derived at runtime; every field must be authored explicitly, matching
 * this codebase's "never fabricate poker state" rule for `action_before_hero`.
 */
export interface ComparisonScenario {
  /** Concise poker description for the switcher button, e.g. "CO opens". Prefer
   *  short_description-style specificity over a generic "Scenario 1"/"Scenario 2". */
  label: string
  /** Optional secondary line under `label`, e.g. "BTN vs CO Open" — the Hero
   *  relationship, when it adds clarity beyond `label` alone. */
  short_description?: string
  hero_position?: string
  villain_position?: string
  hero_hand?: string[]
  board?: string[]
  pot_bb?: number
  effective_stack_bb?: number
  table_size?: number
  ante_bb?: number
  action_before_hero?: string[]
  /** Per-seat effective-stack override in bb, keyed by position (e.g. `{ BB: 10 }`) — see
   *  `LessonStep.stack_overrides_bb` for the full contract. */
  stack_overrides_bb?: Record<string, number>
}

// ── A single interactive step within a lesson ─────────────────────────────────

/** How confidently a step's poker claim is grounded — see LEARN_QUESTION_QA.md's
 *  data-authenticity rules. 'exact_derived' = computed from cards/ranges at
 *  runtime (a combo count). 'source_reconstructed' = a specific book example,
 *  traceable to a section/example name. 'pedagogical_model' = a simplified
 *  range we built to isolate a concept, explicitly labeled as such on-screen. */
export type SourceEvidenceType = 'exact_derived' | 'source_reconstructed' | 'pedagogical_model'

/** Internal traceability metadata for a step's poker-theory content. Not
 *  necessarily rendered verbatim in the learner UI — see `combo_removal_explanation`
 *  and similar on-screen captions for the human-facing version. This is what a
 *  content audit (e.g. section 39/40-style theory QA) walks to verify claims. */
export interface LessonSource {
  book: string
  author?: string
  /** Book section/theme this step's claim comes from, e.g. "Blocker Effects". */
  section: string
  /** Named example within that section, e.g. "Blocker Example 1", when applicable. */
  example?: string
  type: SourceEvidenceType
}

export interface LessonStep {
  id: string
  type: StepType
  /** Traceability for this step's poker-theory claim — see `LessonSource`. */
  source?: LessonSource
  concept_ids?: string[]
  // Poker context
  board?: string[]
  hero_position?: string
  villain_position?: string
  hero_hand?: string[]
  pot_bb?: number
  effective_stack_bb?: number
  /** Per-seat effective-stack override in bb, keyed by position (e.g. `{ BB: 10 }`) — for a
   *  scenario where one seat's stack genuinely diverges from `effective_stack_bb` (e.g. a
   *  short-stacked player behind Hero). Only positions that diverge need an entry; every other
   *  seat falls back to `effective_stack_bb`. Only set when the narrative explicitly states a
   *  seat's stack differs — never fabricated to "spice up" a table. */
  stack_overrides_bb?: Record<string, number>
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
  /** Which canonical chart family the post-answer range reveal (see `DecisionSpotRangeReveal`)
   *  should resolve `hero_position`/`villain_position`/`hero_hand`/`effective_stack_bb` against.
   *  Omit (or `'defend'`) for the original Module 5 behavior — Hero as the one facing an open,
   *  resolved by `defendRangeReveal.ts`. `'3bet'` resolves Hero as the 3-bettor against
   *  `villain_position`'s open via `threebetRangeReveal.ts` (Module 4, "The 3-Bet"). Both funnel
   *  into the same `DecisionSpotRangeReveal` shape and the same `RangeRevealCard`/`PokerRangeGrid`
   *  renderer — adding a future direction (e.g. facing-a-3-bet for Module 6, 4-betting for Module 7)
   *  means adding one more resolver + one more value here, never a new viewer. */
  range_reveal_direction?: 'defend' | '3bet'
  /** Post-answer "who owns more of the strongest hands" reveal, rendered via
   *  `NutAdvantageMeter` after the score — see `NutAdvantageRevealData`. Purely
   *  presentational (passed through `evaluator.ts` unchanged, from `step` alone),
   *  same non-grading contract as `range_reveal_direction`/`range_reveal`. */
  nut_advantage_reveal?: NutAdvantageRevealData
  /** Post-answer compact "Solver Strategy" reveal (e.g. Check 72% / Bet-small 28%),
   *  rendered via `RangeCoverageBar` after the score — see `SolverRevealData`. Same
   *  purely-presentational, non-grading contract as `range_reveal_direction`. */
  solver_reveal?: SolverRevealData
  /** Paired with `scenario_b`: the question compares two distinct poker states
   *  (two opener positions, two stack depths, two action sequences, ...), so
   *  `decision_spot`/`table_decision` render a ScenarioComparison switcher —
   *  ONE shared table plus a segmented control — instead of a single static
   *  PreflopTable. Both fields must be present together; a step with only one
   *  falls back to normal single-table rendering. Only add these when the
   *  authored narrative genuinely names two concrete scenarios — never invent
   *  a second scenario to fill this in. See ScenarioComparison.tsx. */
  scenario_a?: ComparisonScenario
  scenario_b?: ComparisonScenario
  /** One short authored line shown under the scenario switcher describing what's
   *  held constant vs. what differs, e.g. "Same Hero seat. Different opener
   *  position." Always authored, never generated from scenario_a/scenario_b at
   *  runtime — omit rather than guess at a comparison's framing. */
  scenario_comparison_context?: string
  /** How `scenario_a`/`scenario_b` render, when both are present. Omit (or
   *  `'switch'`) for the default ONE-table segmented toggle (`ScenarioComparison`)
   *  — unchanged for every existing comparison step. `'side_by_side'` mounts BOTH
   *  scenarios as independent `PreflopTable`s at once (`ScenarioSideBySide`) — for
   *  a question whose whole point is seeing two table states simultaneously (e.g.
   *  "how many players remain behind at UTG vs. SB"), where toggling back and
   *  forth would hide the comparison the question is actually testing. */
  scenario_layout?: 'switch' | 'side_by_side'
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
  /** range_build: hands pre-selected when the grid loads, e.g. ['AA','KK','AKs'] — the
   *  "obvious core" of the range so the learner isn't clicking premium hands one at a
   *  time. Must be a strict subset of the graded target, never the whole range (the
   *  boundary/marginal hands are the actual exercise). Wins over `range_prefilled_key`
   *  if both are set. The learner can freely deselect these; scoring only looks at the
   *  final submitted set, so prefilling never grants free credit. */
  range_prefilled?: string[]
  /** range_build: lookup key into RANGE_FOUNDATIONS (frontend/lib/learn/ranges.ts) for a
   *  reusable named prefilled-foundation set, analogous to `range_target` vs `range_combos`. */
  range_prefilled_key?: string
  /** range_build: custom copy shown above the grid when a prefilled foundation is present,
   *  explaining why some cells are already filled in. Falls back to a generic default. */
  range_prefilled_note?: string
  /** For range_heatmap: equity value per hand (0–100) keyed by hand notation */
  range_heatmap_data?: Record<string, number>
  /** For range_heatmap: which hands are in the "target" range to identify */
  range_heatmap_target?: string[]
  /** For range_heatmap: renders a 3-4 color action-map grid instead of the numeric equity gradient. */
  range_heatmap_action_map?: Record<string, 'raise' | 'limp' | 'shove' | 'fold'>
  // ── Multi-action range build (Module 3 MTT upgrade; generalized for Module 4's
  //    facing-a-3-bet response lab) — range_build_multi only ──
  /** Which chart registry `range_build_multi_chart` resolves against. 'mtt_rfi' (default) reads
   *  MTT_RFI_CHARTS (raise/limp/jam/fold). 'threebet_response' reads THREEBET_RESPONSE_CHARTS
   *  ('4bet'/call/fold) — see threebetResponseBaselines.ts. 'defend_response' reads
   *  DEFEND_RESPONSE_CHARTS ('3bet'/'jam'/call/fold) — see defendResponseBaselines.ts (Module 5's
   *  HJ/CO/BTN/SB defending-an-open charts). 'bb_defense_complete' reads BB_DEFENSE_COMPLETE_100BB
   *  (bbDefenseComplete.ts) — BB's pixel-exact, genuinely mixed-frequency 100bb complete strategy;
   *  `range_build_multi_chart` is a BBOpenDefenseMatchup key like 'BB_vs_BTN'. Every existing
   *  lesson omits this field and keeps its current 'mtt_rfi' behavior unchanged. */
  range_build_multi_domain?: 'mtt_rfi' | 'threebet_response' | 'defend_response' | 'bb_defense_complete'
  /** Chart key into whichever registry `range_build_multi_domain` selects, e.g. 'UTG1_RFI_25BB'
   *  or 'BTN_vs_BB_3bet_response'. The single source of truth this step is graded against —
   *  lessons, drills, and the Lab all resolve through this same chart so an answer can never
   *  disagree with itself. */
  range_build_multi_chart?: string
  /** Which action chips are offered, in order — lets earlier lessons omit 'limp'/'jam' until
   *  they're introduced. Defaults to whichever actions actually appear in the target chart. */
  range_build_multi_actions?: ('raise' | 'limp' | 'jam' | 'fold' | '4bet' | 'call' | '3bet')[]
  range_build_multi_prefilled?: Record<string, 'raise' | 'limp' | 'jam' | 'fold' | '4bet' | 'call' | '3bet'>
  /** Lookup key into MTT_RFI_FOUNDATIONS (mttRfiRanges.ts) or THREEBET_RESPONSE_FOUNDATIONS
   *  (threebetResponseRanges.ts), per `range_build_multi_domain` — analogous to `range_prefilled_key`. */
  range_build_multi_prefilled_key?: string
  range_build_multi_prefilled_note?: string
  /** After submitting, show the learner-vs-book diff + the mixed-hand inspector before advancing. */
  range_build_multi_show_diff?: boolean
  /** Combo-weighted expected-accuracy tolerance band, same convention/units as `range_tolerance`. Default 5. */
  range_build_multi_tolerance?: number
  /** range_build_multi only — a source chart key (same registry as `range_build_multi_chart`)
   *  whose full dominant-action map seeds the grid (a "Transformation Challenge": start from
   *  this chart's built strategy, edit only what differs). Grading is unaffected — always the
   *  full submission vs. `range_build_multi_chart`. */
  range_build_multi_transform_from_chart?: string
  /** range_build_multi only, shown on the post-submit diff reveal — hand classes the learner
   *  already saw in this lesson's earlier decision_spot puzzles, so the reveal can ring every
   *  one of them on the Baseline Strategy grid (Module 5's "connect the puzzle hands back to
   *  the full range" requirement). Purely a display hint — never affects grading. */
  range_build_multi_puzzle_hands?: string[]
  // ── Table decision (Module 3 structural redesign) — table_decision only ──
  /** MTT_RFI_CHARTS key — the sole grading source, mirroring range_build_multi_chart's convention. */
  table_decision_chart?: string
  /** Hand class under test, e.g. 'A5s'. */
  table_decision_hand?: string
  // ── MTT stack-depth compare (Module 3 structural redesign) — mtt_stack_depth_compare only ──
  mtt_stack_depth_compare_position?: string
  /** Diff-mode's fixed "from" depth. Defaults to 60 (the curriculum's canonical build depth). */
  mtt_stack_depth_compare_reference_bb?: 15 | 25 | 40 | 60
  mtt_stack_depth_compare_prompt?: string
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
  /** Module 11, Lesson 4 ("Bluffs Have a Job") — purely a rendering/caption variant, no change to
   *  the underlying MDF/alpha computation. 'river' = the exact, hard target framing (both of
   *  Alpha/MDF's underlying assumptions — a checked-back hand's EV is 0, a called bluff loses
   *  everything — are literally true there). 'flop' = the same slider/formula, but captioned as an
   *  approximation, since on earlier streets a "bluff" often keeps backdoor equity and a checked-back
   *  hand often isn't truly EV-0. Omit for every existing (Module 10) use of this step type. */
  mdf_slider_framing?: 'river' | 'flop'
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
  /** 'suited'/'offsuit' isolate one class of an unpaired hand (4 / 12 combos) — the
   *  "explode the square" progression before recombining into 'unpaired' (all 16). */
  combo_visualizer_kind?: 'pair' | 'unpaired' | 'removal' | 'suited' | 'offsuit'
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
   *  option are rendered as one bound, fully-clickable unit — see `equity_realization_hands`.
   *  `strategies`: optional full action-frequency mix (see rangeStrategy.ts) — when present,
   *  the grid renders PokerRangeGrid's 'strategy' mode (colored by action) instead of plain
   *  membership, for comparisons where WHICH action a hand takes is the point (e.g. a 4-bet/
   *  call/fold response range), not just whether it's in range. */
  range_compare_a?: { label: string; range: string[]; option_id?: string; strategies?: import('./rangeStrategy').RangeStrategyMap }
  range_compare_b?: { label: string; range: string[]; option_id?: string; strategies?: import('./rangeStrategy').RangeStrategyMap }
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
   *  'threebet_defense' reads threebetBaselines.ts; 'defend' reads defendBaselines.ts (both keyed by
   *  `stack_depth_morph_key`); 'defend_response' reads DEFEND_RESPONSE_CHARTS (defendResponseBaselines.ts)
   *  — a genuine complete_strategy, keyed by `stack_depth_morph_key` as `${heroPosition}_vs_${villainPosition}`
   *  (e.g. 'SB_vs_BTN'), sampled at 15/40/60bb for this component's 3-stop slider. */
  stack_depth_morph_dataset?: 'rfi' | 'threebet_defense' | 'defend' | 'defend_response'
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
  /** Module 11, Lesson 5 ("Protect the Checking Range") — additive, opt-in. When present, the sort
   *  is scored by `evalRangeSurgeryProtection` instead of the default `evalRangeBucket`: the SAME
   *  combo-weighted accuracy against `range_bucket_correct`/`range_bucket_acceptable` still drives the
   *  base score, but the feedback additionally names a protection verdict — whether the learner's
   *  CHECK-pile combos include enough of the pool's genuinely strong hands to avoid being "capped and
   *  face-up" (too few), too many (a thin, unconvincing bet-pile in the opposite direction), or a
   *  sound protected split. Absent on every other `range_bucket` step (Modules 4+), which keeps
   *  their existing scoring/feedback completely unchanged. */
  range_bucket_protection_target?: {
    /** The category id representing "bet"/"lead"/the aggressive pile. */
    bet_category_id: string
    /** The category id representing "check"/the passive pile. */
    check_category_id: string
    /** Which pool entries count as "genuinely strong" for protection purposes — a subset of
     *  `range_bucket_pool`. Only these combos' pile placement drives the verdict; every other
     *  pool entry still counts toward the ordinary accuracy score, just not toward the verdict. */
    strong_hands: string[]
    /** Minimum acceptable fraction (0-1, combo-weighted) of the strong-hand combo mass that should
     *  land in the CHECK pile for the checking range to count as protected. Below this, the verdict
     *  is 'unprotected' (a capped, face-up checking range). */
    min_check_strong_share: number
    /** Maximum acceptable fraction (0-1, combo-weighted) of the strong-hand combo mass that should
     *  land in the CHECK pile. Above this, the verdict is 'over_protected' (the betting range has
     *  been stripped of too much of its own strength to stay credible). */
    max_check_strong_share: number
  }
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
  /** 'list' (default) = BoardRankSort.tsx's tap-to-reorder list. 'spectrum' = BoardSortingPuzzle.tsx's
   *  drag-onto-a-horizontal-spectrum UI (with a tap move-left/move-right non-drag fallback) — same
   *  step type, same evaluator, purely a presentational choice. End labels for spectrum mode. */
  board_rank_sort_layout?: 'list' | 'spectrum'
  board_rank_sort_spectrum_low_label?: string
  board_rank_sort_spectrum_high_label?: string
  /** 'list' layout only — overrides the default "bets most"/"bets least" captions
   *  so the same generic tap-to-order UI can rank things other than c-bet
   *  frequency (e.g. Module 9's "best blocker" → "worst blocker" ranking). */
  board_rank_sort_high_label?: string
  board_rank_sort_low_label?: string
  // ── Range vs Range (Module 8) ───────────────────────────────────────────────
  // Range Collision Viewer — two full 13x13 ranges rendered against a board, in one
  // of four modes. Per-cell "does this hand connect with the board" highlighting is
  // ALWAYS derived live from handBoardInteraction.ts's deterministic card-logic
  // classifier (never hand-authored, never an equity number) — `range_collision_a/b`
  // only supply the actual hand LIST, not per-hand strength.
  range_collision_mode?: 'reveal' | 'predict' | 'morph' | 'archaeology'
  /** Optional: real per-hand preflop action frequency (0-1) for hands in `range` that don't
   *  always take the range-defining action — e.g. a hand that only calls 20% of the time and
   *  folds/3-bets the rest. Drives PokerRangeGrid's mixed-frequency shading so a "sometimes"
   *  hand never renders identically to a "always" hand. A hand present in `range` but absent
   *  from `frequencyMap` (or `frequencyMap` omitted entirely) renders as pure/always — never
   *  fabricated, only ever real sourced frequency data. */
  range_collision_a?: { label: string; range: string[]; source_note?: string; frequencyMap?: Record<string, number> }
  range_collision_b?: { label: string; range: string[]; source_note?: string; frequencyMap?: Record<string, number> }
  /** Book-cited preflop range-vs-range equity split, shown in 'reveal'/'archaeology' modes. */
  range_collision_preflop_equity?: { a: number; b: number }
  /** Book-cited postflop range-vs-range equity split on `board`. */
  range_collision_postflop_equity?: { a: number; b: number }
  /** Which hand-connection categories (from handBoardInteraction.ts) this step calls out in its
   *  legend/emphasis — a teaching hint, not a data source (the classifier itself is always live). */
  range_collision_emphasize_categories?: import('./handBoardInteraction').HandBoardCategory[]
  /** predict mode: '5pt' = STRONGLY A .. STRONGLY B, '3pt' = A / CLOSE / B — use '3pt' whenever
   *  the source doesn't support 5-way precision. Scored via `options` (ids match the scale). */
  range_collision_scale?: '5pt' | '3pt'
  range_collision_prompt?: string
  /** morph mode: additional curated board states to switch between. */
  range_collision_boards?: {
    id: string
    label: string
    board: string[]
    preflop_equity?: { a: number; b: number }
    postflop_equity?: { a: number; b: number }
  }[]
  /** archaeology mode: real side labels, revealed only after the learner answers (uses `options` for the guess). */
  range_collision_reveal_labels?: { a: string; b: string }
  /** Progressive "Show Me Why" layers, revealed one at a time after the main reveal. */
  range_collision_show_me_why?: { title: string; body: string }[]
  range_collision_source_ref?: string
  // Range equity predict — slider estimate of a range-vs-range equity split, then reveal.
  range_equity_predict_a_label?: string
  range_equity_predict_b_label?: string
  range_equity_predict_board?: string[]
  /** Side A's equity %, 0-100 — the book-cited answer. */
  range_equity_predict_correct?: number
  range_equity_predict_tolerance?: number
  range_equity_predict_prompt?: string
  range_equity_predict_source_ref?: string
  // Range X-Ray — Strong/Good/Weak/Trash bucket bar(s). `strong` is numeric only where the
  // source gives an exact figure; good/weak/trash are qualitative captions, never invented %.
  range_xray_entries?: { label: string; strong?: number; good_note?: string; weak_note?: string; trash_note?: string }[]
  range_xray_prompt?: string
  /** Optional: a mini range grid rendered beneath the bars, click-a-bucket-to-highlight (via the
   *  same live card-logic classifier as range_collision — never fabricated per-hand equity). */
  /** See `range_collision_a`'s `frequencyMap` doc — same real-frequency-only, mixed-strategy
   *  shading, applied to this mini grid. */
  range_xray_grid?: { label: string; range: string[]; frequencyMap?: Record<string, number> }
  range_xray_board?: string[]
  range_xray_source_ref?: string
  // ── Blockers & Card Removal (Module 9) ──────────────────────────────────────
  /** combo_removal: hand-class notation whose full combo set renders as tappable
   *  tiles, e.g. 'AA' (6 tiles) or 'AK' (16 tiles, suited+offsuit combined —
   *  see `expandGenericUnpaired` in combos.ts; anything containing a letter
   *  followed by 's'/'o' stays single-suited-class instead). */
  combo_removal_subject?: string
  /** Alternative to `combo_removal_subject` — multiple hand-class notations
   *  (e.g. a river value region: ['99','44','76s']) flattened into ONE tile
   *  set, for exercises about a whole named region of a range rather than a
   *  single hand class. When both are set, this one wins. */
  combo_removal_range?: string[]
  /** Cards already known (Hero's hand and/or the board) that make some of the
   *  subject's combos physically impossible — the ground truth the learner's
   *  taps are graded against, computed live via combos.ts, never hard-coded.
   *  Use this when the board/Hero distinction doesn't matter to the exercise;
   *  use the two fields below when it does (they render distinct badges). */
  combo_removal_known_cards?: string[]
  /** Board cards making some combos impossible — rendered with a distinct
   *  "B" badge from Hero-card removal, per section 11's requirement that the
   *  two removal sources stay visually distinguishable, not just color-coded. */
  combo_removal_board_cards?: string[]
  /** Hero's hole cards making some combos impossible — rendered with an "H"
   *  badge. Combines with `combo_removal_board_cards`; either or both may be set. */
  combo_removal_hero_cards?: string[]
  combo_removal_prompt?: string
  /** Shown after submit regardless of correctness — the causal explanation of
   *  *why* the flagged combos are impossible (which known card collides). */
  combo_removal_explanation?: string
  // ── Flush pyramid (Module 9 — "The Nut Blocker") ────────────────────────────
  /** The flush suit this pyramid is built on, e.g. 'h'. */
  flush_pyramid_suit?: string
  /** Ranks of `flush_pyramid_suit` already dead (on the board) — the ONLY input
   *  the tier breakdown is derived from; see combos.ts's `flushTiers`. */
  flush_pyramid_dead_ranks?: string[]
  /** Cards (in `flush_pyramid_suit`) Hero is shown holding — determines which
   *  tier(s) the learner should tap as "affected," computed live, never authored. */
  flush_pyramid_known_cards?: string[]
  flush_pyramid_prompt?: string
  // ── Cross-step tendency summary ─────────────────────────────────────────────
  /** Any step can carry this: a machine id grouping it into a later `tendency_summary`
   *  step (e.g. 'offsuit_broadway'). Purely descriptive metadata — never read by this
   *  step's own evaluator, only by a downstream tendency_summary step. */
  tendency_tag?: string
  /** Human-readable label for `tendency_tag`, e.g. "offsuit broadways". Shown by the
   *  downstream tendency_summary step; authored on the SOURCE step so the summary
   *  component stays fully generic (no hardcoded domain vocabulary). */
  tendency_tag_label?: string
  /** Shown by the downstream tendency_summary step ONLY when this step's answer
   *  wasn't correct — one short clause explaining the pattern, e.g. "these look strong
   *  on paper but get dominated and realize equity poorly". */
  tendency_tag_leak_hint?: string
  /** tendency_summary only: step ids (within the SAME lesson, already answered earlier
   *  in this playthrough) whose real StepResult.quality + tendency_tag/label/leak_hint
   *  feed this step's synthesized message. Always reads actual results from THIS
   *  playthrough — never a canned or simulated readout. */
  summary_source_step_ids?: string[]
  /** Optional lead-in shown above the synthesized tendency breakdown. */
  tendency_summary_intro?: string
  // ── Game Theory Foundations (Module 10) ─────────────────────────────────────
  // Strategy Response Lab — A→B→A strategy feedback loop. All EV math routes through
  // gameTheoryEngine.ts's evOfBetting/evOfChecking on a one-street toy bet/check game
  // (pot/bet/equity below), never hand-authored per-frequency EV numbers.
  /** 'intro' = pick between two labeled pure strategies, see the fixed opposing response (10.1).
   *  'best_response' = Villain's call frequency is fixed/locked; learner searches Hero's bet-frequency
   *  slider for the MES (10.2). 'counter_exploit' = FREEZE/UNFREEZE Villain; the learner's exploit
   *  found while frozen gets re-evaluated after Villain adjusts (10.3). 'iterate' = step through a fixed
   *  sequence of source-cited push/fold states via a "Best Respond" button (10.4). */
  strategy_response_lab_mode?: 'intro' | 'best_response' | 'counter_exploit' | 'iterate'
  strategy_response_lab_prompt?: string
  /** The underlying toy game's pot/bet/equity. Falls back to PRESSURE_GAME_DEFAULT (gameTheoryContent.ts). */
  strategy_response_lab_pot?: number
  strategy_response_lab_bet?: number
  strategy_response_lab_equity_when_called?: number
  strategy_response_lab_equity_when_checked?: number
  /** 'intro' mode: two pure strategies Player A can pick between (uses `options`; option ids must match). */
  strategy_response_lab_intro_strategies?: { id: string; label: string; heroFreq: number }[]
  /** 'best_response' mode: Villain's fixed, already-revealed call frequency (0-1). */
  strategy_response_lab_fixed_villain_freq?: number
  /** 'counter_exploit' mode: Villain's call frequency before and after the learner hits UNFREEZE. */
  strategy_response_lab_villain_freq_before?: number
  strategy_response_lab_villain_freq_after?: number
  /** 'iterate' mode: PUSH_FOLD_ITERATION (gameTheoryContent.ts) step ids to walk through, in order. */
  strategy_response_lab_iteration_ids?: string[]
  /** Tolerance (as a 0-1 frequency fraction) for scoring 'best_response'/'counter_exploit' slider answers. Default 0.05. */
  strategy_response_lab_tolerance?: number

  // Clairvoyance Lab — the AA/QQ-vs-KK polarized toy game (10.7-10.8). `board`/`pot_bb` are not
  // used here; see CLAIRVOYANCE_GAME in gameTheoryContent.ts for the fixed pot/bet/board.
  clairvoyance_lab_prompt?: string
  /** 'explore' = free sliders, unscored, for building intuition. 'find_equilibrium' = adjust the
   *  editable frequencies until neither side can improve — scored against clairvoyanceEquilibrium().
   *  'face_up_compare' (Module 11, Lesson 1 "Why We Bet") = a read-only side-by-side of this SAME
   *  game's equilibrium EV with hidden information versus its EV if both hands were fully visible
   *  (gameTheoryEngine.ts's `faceUpEV`) — no sliders, unscored (the graded prediction is a separate,
   *  preceding decision_spot step; this step only renders the reveal both sides of that prediction
   *  are compared against). */
  clairvoyance_lab_mode?: 'explore' | 'find_equilibrium' | 'face_up_compare'
  /** Which frequency slider(s) the learner controls this step; any other frequency is held at
   *  `clairvoyance_lab_locked`'s value (or the true equilibrium value if unspecified there).
   *  Not used in 'face_up_compare' mode (no sliders in that mode). */
  clairvoyance_lab_editable?: ('aa_bet' | 'qq_bet' | 'kk_call')[]
  clairvoyance_lab_locked?: { aa_bet?: number; qq_bet?: number; kk_call?: number }
  /** Tolerance (0-1 frequency fraction) for the 'find_equilibrium' scoring. Default 0.05. */
  clairvoyance_lab_tolerance?: number

  // EV Indifference Balance — two action bars (e.g. BET/CHECK or CALL/FOLD) whose EVs respond to
  // an opponent-frequency slider the learner controls. Same underlying toy game as strategy_response_lab.
  ev_indifference_balance_prompt?: string
  ev_indifference_balance_action_a_label?: string
  ev_indifference_balance_action_b_label?: string
  ev_indifference_balance_pot?: number
  ev_indifference_balance_bet?: number
  ev_indifference_balance_equity_when_called?: number
  ev_indifference_balance_equity_when_checked?: number
  /** Tolerance (0-1 frequency fraction) for the "found indifference" check. Default 0.03. */
  ev_indifference_balance_tolerance?: number

  // Unilateral Deviation Test — "can this player improve by changing strategy alone?" One control
  // (the tested player's own frequency), everything else fixed at the candidate-equilibrium value.
  unilateral_deviation_test_prompt?: string
  /** Which side the learner is testing this step — the OTHER side's frequency is held fixed. */
  unilateral_deviation_test_player?: 'A' | 'B'
  unilateral_deviation_test_pot?: number
  unilateral_deviation_test_bet?: number
  /** The candidate equilibrium both players are AT before the learner tries deviating —
   *  `heroFreq` is the tested player's own candidate-equilibrium frequency (their starting
   *  point / the "no deviation" baseline), `villainFreq` is the fixed other side. */
  unilateral_deviation_test_equilibrium?: { heroFreq: number; villainFreq: number }
  unilateral_deviation_test_tolerance?: number

  // Visual
  visual?: 'table' | 'range_grid' | 'equity_bar' | 'heatmap' | 'pressure_chart'
  /** Overrides the default 3-example carousel shown by the 'equity_bar' visual, so a
   *  lesson can demonstrate equity with a scenario that fits its own content instead of
   *  reusing the shared default (36% flush draw / 50% pair vs pair / 78% overpair vs two overcards). */
  equity_bar_examples?: { hero: number; label: string }[]
  /** Renders a small supporting chart inside a concept_reveal card via ConceptIllustration,
   *  independent of `visual`. Currently only 'convergence' is implemented (a short volatile
   *  run vs. a long run smoothing out toward `targetPct`) — add new `kind`s here as future
   *  theory cards need other lightweight illustrations, rather than one-off components. */
  concept_illustration?: {
    kind: 'convergence'
    targetPct: number
    shortTrialCount?: number
    longTrialCount?: number
    shortLabel?: string
    longLabel?: string
    shortCaption?: string
    longCaption?: string
    seed?: number
  }
  // ── Adaptive system (remediation) ───────────────────────────────────────────
  /** Ordered alternate representations of this step's concept, injected one at a time on repeated misses. */
  remediation_ladder?: LessonStep[]
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
  /** One-line book/solver citation for `correct` (chapter + page, ideally the exact
   *  quoted line) — e.g. "Modern Poker Theory, Ch. 11, p.633". Only ever a direct
   *  passthrough of a step's own authored source field, never fabricated here.
   *  Reusable across any book-backed reference value (solver equity, EV, GTO
   *  frequency, ...), not specific to one step type. */
  source?: string
  /** Signed distance between `yours` and `correct` as a short display value, e.g.
   *  "+0.3%" or "Exact match" — only set by callers that opt into always showing
   *  the reference value (see evaluator.ts's `evalNumeric` `alwaysReveal` option). */
  delta?: string
}

// ── Step evaluation result from API ──────────────────────────────────────────

/** One stage of a multi-stage reasoning exercise (Module 9 spec section 15) —
 *  e.g. "did the learner read the range correctly" is tracked separately from
 *  "did they make the right final decision". Purely additive: existing step
 *  types that never populate this see `undefined` and render exactly as before. */
export interface ReasoningStageResult {
  /** Machine id, e.g. 'range_identification' | 'combo_removal' | 'blocker_classification' | 'final_decision'. */
  stage: string
  /** Human-readable label shown in the stage-by-stage breakdown, e.g. "Range read". */
  label: string
  correct: boolean
  /** Optional one-line explanation of what was right/wrong at this stage. */
  detail?: string
}

/** Post-answer "who owns more of the strongest hands" reveal — see
 *  `LessonStep.nut_advantage_reveal`, rendered via `NutAdvantageMeter`
 *  (`components/learn/visuals/NutAdvantageMeter.tsx`). Always hand-authored on the
 *  step (never computed from a range engine), so `caption` must say plainly whether
 *  `advantage` is an exact book/solver figure or an illustrative pedagogical model —
 *  see `LessonSource`/`SourceEvidenceType` for the same distinction elsewhere. */
export interface NutAdvantageRevealData {
  /** -100..100 — positive favors `ipLabel`'s side, negative favors `oopLabel`'s side. */
  advantage: number
  ipLabel?: string
  oopLabel?: string
  /** One-line sourcing/interpretation caption shown under the meter. */
  caption?: string
}

/** One labeled slice of a post-answer "Solver Strategy" reveal — see `SolverRevealData`. */
export interface SolverRevealBucket {
  label: string
  /** 0-100; the set of buckets on one `SolverRevealData` should sum to ~100. */
  pct: number
  /** Tailwind background class, e.g. 'bg-emerald-500' — see `RangeCoverageBar`. */
  color: string
}

/** Post-answer compact strategy-mix reveal (e.g. "Check 72% / Bet-small 28%") — see
 *  `LessonStep.solver_reveal`, rendered via `RangeCoverageBar`
 *  (`components/learn/visuals/NutAdvantageMeter.tsx`). Same hand-authored,
 *  never-computed contract as `NutAdvantageRevealData`. */
export interface SolverRevealData {
  buckets: SolverRevealBucket[]
  title?: string
  /** One-line sourcing caption, e.g. "Exact — Modern Poker Theory, Table 100, p.634"
   *  or "Illustrative, solver-inspired — not a specific solve". */
  caption?: string
}

/** Resolved (never learner-facing-computed) full Hero strategy shown after a decision_spot is
 *  answered — see `defendRangeReveal.ts` (Hero facing an open) and `threebetRangeReveal.ts`
 *  (Hero as the 3-bettor), dispatched by `step.range_reveal_direction` in evaluator.ts.
 *  Purely presentational: built from `step` alone, independent of grading, so its presence
 *  can never influence `quality`/`score`/`xp_earned` above. */
export interface DecisionSpotRangeReveal {
  /** Hand -> action-frequency mix, ready for `PokerRangeGrid`'s `strategy` mode. */
  strategies: RangeStrategyMap
  /** What `strategies` actually proves — see `RangeSemantics` in rangeStrategy.ts. E.g.
   *  `{ kind: 'action_slice', action: 'call' }` for a calling-frequency-only defend reveal, or
   *  `{ kind: 'action_slice', action: '3bet' }` for a 3-betting-frequency-only reveal — either
   *  way, a hand absent from `strategies` must render as the honest "untracked" bucket, never
   *  fold, unless `kind` is `'complete_strategy'` (every action genuinely known). */
  strategySemantics: RangeSemantics
  /** Hand list backing the resolved chart (required by `PokerRangeGrid`'s `range` prop;
   *  unused for coloring in `strategy` mode, which reads `strategies` instead). */
  range: string[]
  /** The just-answered hand's class (e.g. 'K9o'), for `PokerRangeGrid`'s `highlightHand`. */
  highlightHand: string
  heroPosition: string
  villainPosition: string
  /** e.g. "BB CALLING RANGE vs UTG OPEN" — never "DEFENSE"/"DEFENDING STRATEGY", which
   *  would overclaim a complete strategy this action-slice data doesn't have. */
  label: string
  /** e.g. "See where K9o sits in Hero's calling frequency." */
  subtitle: string
}

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
  /** Post-answer full-range reveal (defending range or 3-betting range, see
   *  `step.range_reveal_direction`) for decision_spot steps — see `DecisionSpotRangeReveal`.
   *  Undefined whenever the step's scenario can't resolve to one, or the canonical data can't
   *  back it (never fabricated to fill the gap). */
  range_reveal?: DecisionSpotRangeReveal
  /** Post-answer nut-advantage reveal — direct passthrough of `step.nut_advantage_reveal`,
   *  see `NutAdvantageRevealData`. Same non-grading contract as `range_reveal`. */
  nut_advantage_reveal?: NutAdvantageRevealData
  /** Post-answer "Solver Strategy" reveal — direct passthrough of `step.solver_reveal`,
   *  see `SolverRevealData`. Same non-grading contract as `range_reveal`. */
  solver_reveal?: SolverRevealData
  // Evaluation pipeline metadata — always present from v2 onwards
  evaluation_source: EvaluationSource
  confidence: EvaluationConfidence
  evaluation_valid: boolean
  fallback_used: boolean
  error_type?: string
  /** True for passive/informational steps (concept_reveal, exploration modes of the
   *  various visualizer steps) that had nothing to grade. When true, `score`/`quality`
   *  are meaningless placeholders and `xp_earned` is always 0 — the UI must never render
   *  a graded result screen ("Perfect Play"/"Score: X/100") for these, only advance. */
  unscored: boolean
  /** Present only for steps whose evaluator populated a multi-stage reasoning
   *  breakdown (see `ReasoningStageResult`) — e.g. Module 9's range→combo→
   *  removal→blocker→decision chain. Absent for every ordinary single-stage
   *  step; existing modules never see this field change. */
  reasoning_stages?: ReasoningStageResult[]
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
// The level curve itself lives in `./levelCurve.ts` (the single shared
// helper every Learn surface must use) — re-exported here so existing
// `from '@/lib/learn/types'` imports keep working.

export { levelForXP, getLevelProgress, type LevelProgress } from './levelCurve'
import { getLevelProgress } from './levelCurve'
import type { RangeStrategyMap, RangeSemantics } from './rangeStrategy'

export function xpToNextLevel(xp: number): { current: number; needed: number; pct: number } {
  const p = getLevelProgress(xp)
  return { current: p.currentLevelXp, needed: p.xpRequiredForNextLevel, pct: p.progressPercent }
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
  // Range vs Range (Module 8)
  {
    id: 'range_thinker',
    title: 'Range Thinker',
    description: 'Learned to see a flop as two colliding ranges, not one strong hand',
    icon: '🧬',
    category: 'learning',
    condition: 'Complete "Stop Thinking Hand vs Hand" and "Who Owns This Flop?"',
    xp_bonus: 75,
    tier: 'bronze',
  },
  {
    id: 'board_archaeologist',
    title: 'Board Archaeologist',
    description: 'Correctly reasoned backward from range composition to identify the preflop raiser',
    icon: '🗺️',
    category: 'performance',
    condition: 'Score well on the Range Archaeology exercise',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'xray_vision',
    title: 'X-Ray Vision',
    description: 'Mastered reading an equity-bucket distribution, not just a raw equity number',
    icon: '🩻',
    category: 'mastery',
    condition: 'Complete "X-Ray the Range"',
    xp_bonus: 100,
    tier: 'silver',
  },
  {
    id: 'range_scientist',
    title: 'Range Scientist',
    description: 'Completed Module 8: Range vs Range',
    icon: '🔬',
    category: 'mastery',
    condition: 'Complete "The Range Lab" capstone',
    xp_bonus: 200,
    tier: 'gold',
  },
]
