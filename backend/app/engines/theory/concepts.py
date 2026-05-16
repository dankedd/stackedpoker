"""
Canonical Poker Concept Registry
=================================
Original structured taxonomy of poker strategy concepts.

Each concept is defined by:
  - Unique ID and canonical name
  - Strategic category (game theory, preflop, postflop, etc.)
  - Related concepts (graph of connections)
  - Educational metadata (beginner / intermediate / advanced explanations)
  - Puzzle tags and coaching tags
  - Solver/node relevance markers

This is an ORIGINAL knowledge architecture — concepts are universal poker
strategy principles, not reproduced from any specific copyrighted source.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class StrategicCategory(str, Enum):
    GAME_THEORY    = "game_theory"
    PREFLOP        = "preflop"
    POSTFLOP       = "postflop"
    HAND_READING   = "hand_reading"
    BET_SIZING     = "bet_sizing"
    RANGES         = "ranges"
    POSITION       = "position"
    TOURNAMENT     = "tournament"
    EQUITY         = "equity"
    EXPLOITATIVE   = "exploitative"
    MENTAL_GAME    = "mental_game"


class ConceptTag(str, Enum):
    # Mathematical
    MDF                 = "mdf"
    ALPHA               = "alpha"
    EV                  = "ev"
    EQUITY              = "equity"
    EQUITY_REALIZATION  = "equity_realization"
    POT_ODDS            = "pot_odds"
    OUTS                = "outs"
    IMPLIED_ODDS        = "implied_odds"
    FOLD_EQUITY         = "fold_equity"
    BLUFF_VALUE_RATIO   = "bluff_value_ratio"

    # Range concepts
    POLARIZED           = "polarized"
    CONDENSED           = "condensed"
    CAPPED              = "capped"
    UNCAPPED            = "uncapped"
    LINEAR              = "linear"
    MERGED              = "merged"
    RANGE_ADVANTAGE     = "range_advantage"
    NUT_ADVANTAGE       = "nut_advantage"
    BLOCKERS            = "blockers"
    BOARD_COVERAGE      = "board_coverage"

    # Position
    IP_ADVANTAGE        = "ip_advantage"
    OOP_DISADVANTAGE    = "oop_disadvantage"
    POSITIONAL_VALUE    = "positional_value"

    # Postflop
    CBET                = "cbet"
    DONK_BET            = "donk_bet"
    CHECK_RAISE         = "check_raise"
    OVERBET             = "overbet"
    GEOMETRIC_SIZING    = "geometric_sizing"
    SPR                 = "spr"
    EQUITY_BUCKET       = "equity_bucket"
    SHOWDOWN_VALUE      = "showdown_value"
    SEMI_BLUFF          = "semi_bluff"
    DRAW_EQUITY         = "draw_equity"

    # GTO
    NASH_EQUILIBRIUM    = "nash_equilibrium"
    INDIFFERENCE        = "indifference"
    MIXED_STRATEGY      = "mixed_strategy"
    UNEXPLOITABLE       = "unexploitable"
    EXPLOIT             = "exploit"
    GTO                 = "gto"

    # Tournament
    ICM                 = "icm"
    BUBBLE_FACTOR       = "bubble_factor"
    CHIP_EV             = "chip_ev"
    PUSH_FOLD           = "push_fold"


@dataclass
class ConceptExplanation:
    """Multi-level explanation of a concept."""
    beginner: str
    intermediate: str
    advanced: str


@dataclass
class PokerConcept:
    """A canonical poker strategy concept with full metadata."""
    concept_id: str
    name: str
    category: StrategicCategory
    tags: list[ConceptTag]
    related_concepts: list[str]          # Other concept_ids
    related_nodes: list[str]             # Node IDs from node_library
    related_board_types: list[str]       # Board family names
    explanation: ConceptExplanation
    coaching_tags: list[str]             # Tags for the coaching system
    puzzle_tags: list[str]               # Tags for puzzle classification
    solver_relevance: list[str]          # What solver metrics this affects
    formula: Optional[str] = None        # Mathematical formula if applicable
    example_situations: list[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# CONCEPT REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

CONCEPT_REGISTRY: dict[str, PokerConcept] = {

    # ─────────────────────────────────────────────────────────────────────────
    # GAME THEORY CONCEPTS
    # ─────────────────────────────────────────────────────────────────────────

    "mdf": PokerConcept(
        concept_id="mdf",
        name="Minimum Defense Frequency (MDF)",
        category=StrategicCategory.GAME_THEORY,
        tags=[ConceptTag.MDF, ConceptTag.ALPHA, ConceptTag.NASH_EQUILIBRIUM],
        related_concepts=["alpha", "bluff_value_ratio", "indifference", "pot_odds"],
        related_nodes=["BTN_BB_SRP_100", "CO_BB_SRP_100"],
        related_board_types=["A_high_dry", "K_high_dry"],
        explanation=ConceptExplanation(
            beginner=(
                "MDF tells you the minimum percentage of your hands you must continue with "
                "(call or raise) when facing a bet. If you fold more than this, your opponent "
                "can profitably bluff with any hand. "
                "Formula: MDF = pot / (pot + bet). "
                "Example: Villain bets 50% pot → you must continue with at least 67% of your range."
            ),
            intermediate=(
                "MDF is derived from making the bettor's bluffs break even (EV = 0) against "
                "your folding frequency. If you fold at frequency F > alpha, the bluffer profits "
                "regardless of their hand — they can use any two cards. "
                "MDF assumes the bluff has 0% equity. Semi-bluffs with equity reduce "
                "the required calling frequency because even called bluffs sometimes win."
            ),
            advanced=(
                "On the flop and turn, MDF is a rough guideline only. The bettor's 'bluffs' "
                "rarely have 0% equity — most have backdoor draws or some pair equity. "
                "This means the EV of checking is not 0, which changes the calculation. "
                "True equilibrium defense frequencies are computed by solvers and account "
                "for the full game tree (future streets, stack depth, runout coverage). "
                "MDF becomes most accurate on the river where hand strengths are finalized."
            ),
        ),
        formula="MDF = pot / (pot + bet) = 1 - alpha",
        coaching_tags=["mdf_defense", "calling_frequency", "fold_too_much"],
        puzzle_tags=["MDF_pressure", "fold_too_much", "call_down"],
        solver_relevance=["folding_frequency", "bluff_profitability", "range_defense"],
        example_situations=[
            "Villain bets 67% pot on river: MDF = 60% (must call ≥60% of range)",
            "Villain bets pot: MDF = 50% (call 1 in 2 hands)",
            "Villain overbets 2x pot: MDF = 33% (call only strong hands)",
        ],
    ),

    "alpha": PokerConcept(
        concept_id="alpha",
        name="Alpha — Required Fold Frequency for Break-even Bluffs",
        category=StrategicCategory.GAME_THEORY,
        tags=[ConceptTag.ALPHA, ConceptTag.FOLD_EQUITY, ConceptTag.EV],
        related_concepts=["mdf", "bluff_value_ratio", "fold_equity"],
        related_nodes=[],
        related_board_types=[],
        explanation=ConceptExplanation(
            beginner=(
                "Alpha tells you how often your bluff needs to work to break even. "
                "If you bluff and your opponent folds more than alpha% of the time, "
                "the bluff shows a profit. "
                "Formula: alpha = bet / (pot + bet). "
                "Example: You bet 50% pot → alpha = 33%. Bluff is profitable if opponent folds >33%."
            ),
            intermediate=(
                "Alpha is calculated assuming the bluff has 0% equity when called. "
                "Semi-bluffs (hands with draw equity) need villain to fold less often "
                "to be profitable, because even when called they win some fraction. "
                "Alpha answers: 'How tight does villain need to be for my bluff to profit?'"
            ),
            advanced=(
                "Alpha and MDF are two sides of the same coin: "
                "alpha = required_fold_freq; MDF = 1 - alpha = required_call_freq. "
                "In multiway pots, each player must fold at alpha^(1/n) individually "
                "for a bluff to achieve the same total fold probability alpha. "
                "Alpha increases as bet size increases — larger bets need more folds but "
                "can be balanced with more bluffs (the bluff-to-value ratio also scales)."
            ),
        ),
        formula="alpha = bet / (pot + bet)",
        coaching_tags=["bluff_breakeven", "fold_equity", "bluff_sizing"],
        puzzle_tags=["alpha_calculation", "bluff_profitability"],
        solver_relevance=["bluff_frequency", "fold_to_bet", "bet_size_selection"],
    ),

    "nash_equilibrium": PokerConcept(
        concept_id="nash_equilibrium",
        name="Nash Equilibrium (GTO)",
        category=StrategicCategory.GAME_THEORY,
        tags=[ConceptTag.NASH_EQUILIBRIUM, ConceptTag.GTO, ConceptTag.UNEXPLOITABLE],
        related_concepts=["mdf", "indifference", "mixed_strategy", "exploitative_play"],
        related_nodes=["BTN_BB_SRP_100", "BTN_BB_3BET_100"],
        related_board_types=[],
        explanation=ConceptExplanation(
            beginner=(
                "Nash Equilibrium (called 'GTO' in poker) is a strategy where neither "
                "player can improve by changing their play, assuming the opponent plays "
                "perfectly. A GTO player cannot be exploited — they might lose to "
                "better players who make mistakes less often, but no opponent can "
                "gain an edge by knowing their strategy."
            ),
            intermediate=(
                "GTO gives a guaranteed minimum EV — no opponent can exploit you below it. "
                "Against suboptimal opponents, GTO passively exploits their mistakes "
                "without requiring you to identify specific leaks. "
                "GTO requires mixed strategies at equilibrium — sometimes playing "
                "the same hand differently at random frequencies so opponents "
                "cannot read your range perfectly."
            ),
            advanced=(
                "In NLH, individual hands are played in the most profitable way possible "
                "at equilibrium. Mixed strategies only arise when multiple actions "
                "have identical EV — the indifference principle. "
                "GTO does not involve 'balance for its own sake' — every action in a "
                "GTO strategy maximizes EV for that specific hand given opponent's range. "
                "True equilibrium requires solving the full game tree; human approximations "
                "use heuristics derived from solver outputs."
            ),
        ),
        coaching_tags=["gto_baseline", "unexploitable", "mixed_strategy"],
        puzzle_tags=["gto_concept", "equilibrium"],
        solver_relevance=["all_decisions", "range_construction", "bet_sizing"],
    ),

    "indifference": PokerConcept(
        concept_id="indifference",
        name="Indifference Principle",
        category=StrategicCategory.GAME_THEORY,
        tags=[ConceptTag.INDIFFERENCE, ConceptTag.MIXED_STRATEGY, ConceptTag.GTO],
        related_concepts=["nash_equilibrium", "mdf", "bluff_value_ratio"],
        related_nodes=[],
        related_board_types=[],
        explanation=ConceptExplanation(
            beginner=(
                "Indifference means 'it doesn't matter which action I take — they both "
                "have the same outcome.' In GTO play, the bettor constructs their bluffing "
                "range to make the caller indifferent to calling or folding. "
                "This is why, in perfectly balanced scenarios, folding is never 'wrong.'"
            ),
            intermediate=(
                "The indifference principle states: at equilibrium, any hand played "
                "as a mixed strategy must have equal EV for all actions taken with it. "
                "This tells us something important: if you're bluffing at the right "
                "frequency, your opponent's decision to call or fold is irrelevant to "
                "your EV. Their choice only affects theirs."
            ),
            advanced=(
                "Indifference drives the derivation of both alpha and MDF. "
                "The bettor's bluff frequency makes the caller indifferent to calling/folding. "
                "The caller's call frequency makes the bettor indifferent to bluffing/checking. "
                "Both players simultaneously making each other indifferent is Nash Equilibrium. "
                "Identifying which hands are at the margin of indifference helps calibrate "
                "calling ranges and bluff frequencies in practice."
            ),
        ),
        coaching_tags=["indifference_principle", "balance", "equilibrium"],
        puzzle_tags=["indifference", "gto_concept"],
        solver_relevance=["bluff_frequency_calibration", "calling_threshold"],
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # EQUITY CONCEPTS
    # ─────────────────────────────────────────────────────────────────────────

    "equity_realization": PokerConcept(
        concept_id="equity_realization",
        name="Equity Realization (EqR)",
        category=StrategicCategory.EQUITY,
        tags=[ConceptTag.EQUITY_REALIZATION, ConceptTag.IP_ADVANTAGE, ConceptTag.SPR],
        related_concepts=["spr_theory", "position_value", "range_advantage", "hand_playability"],
        related_nodes=["BTN_BB_SRP_100", "SB_BB_SRP_100"],
        related_board_types=["A_high_dry", "low_connected"],
        explanation=ConceptExplanation(
            beginner=(
                "Equity realization is how much of your theoretical equity you actually "
                "capture in practice. A hand with 40% equity doesn't always win 40% of "
                "the pot — it might fold to pressure and realize less, or it might be "
                "in position and realize more by seeing free cards."
            ),
            intermediate=(
                "Factors that increase equity realization: position (IP), suitedness, "
                "connectedness, range advantage, low SPR. "
                "Factors that reduce equity realization: OOP, disconnected offsuit hands, "
                "range disadvantage, high SPR with weak hands. "
                "IP players realize equity at ~110% of raw equity; OOP at ~90% on average."
            ),
            advanced=(
                "EqR = EV / equity × (pot/2). A hand over-realizes if it captures more "
                "than its equity share — this happens with strong hands that deny opponent "
                "equity, or with positional advantage that allows free cards. "
                "Suited hands realize ~16% more equity than offsuit equivalents due to "
                "backdoor flush draw access. Equity realization is the primary reason "
                "why many OOP calls with marginal hands are losing plays even when "
                "pot odds appear favorable."
            ),
        ),
        formula="EqR = EV / (equity × pot/2)",
        coaching_tags=["equity_realization", "oop_struggle", "suited_bonus"],
        puzzle_tags=["equity_realization", "oop_defense", "ip_advantage"],
        solver_relevance=["calling_ranges", "oop_defense", "hand_selection"],
        example_situations=[
            "SB completes and checks every street: poor EqR OOP",
            "BTN calls 3-bet in position: high EqR with suited connectors",
            "BB defends 95o OOP vs UTG: severe EqR reduction",
        ],
    ),

    "spr_theory": PokerConcept(
        concept_id="spr_theory",
        name="Stack-to-Pot Ratio (SPR)",
        category=StrategicCategory.EQUITY,
        tags=[ConceptTag.SPR, ConceptTag.EQUITY_REALIZATION],
        related_concepts=["equity_realization", "commitment_threshold", "geometric_sizing"],
        related_nodes=["BTN_BB_SRP_100", "BTN_BB_3BET_100"],
        related_board_types=["A_high_dry", "low_connected"],
        explanation=ConceptExplanation(
            beginner=(
                "SPR = remaining stack / pot. It tells you how much money is left to play "
                "relative to the pot. Low SPR (1–5): top pair is often a commitment hand. "
                "High SPR (10+): you need a very strong hand (set, two pair) to risk a large pot."
            ),
            intermediate=(
                "SPR changes which hands are profitable to play postflop. "
                "In low SPR pots, raw equity dominates — speculative hands lose value. "
                "In high SPR pots, implied odds and nut potential dominate — "
                "suitedness and connectedness gain value. "
                "3-bet pots have low SPR (3–6); deep stacked single raised pots have SPR 8–15."
            ),
            advanced=(
                "SPR determines commitment thresholds: the minimum hand strength "
                "that justifies stacking off on a given street. "
                "At SPR 5, top pair top kicker can commit. At SPR 10, two pair is "
                "typically the commitment threshold. At SPR 20+, only sets and better. "
                "OOP players should prefer lower SPR (by raising more preflop) to "
                "reduce the positional disadvantage. IP players prefer higher SPR to "
                "maximize the value of their positional edge across multiple streets."
            ),
        ),
        formula="SPR = effective_stack / pot",
        coaching_tags=["spr", "commitment_threshold", "stack_depth"],
        puzzle_tags=["spr_commitment", "low_spr_top_pair", "high_spr_nuttiness"],
        solver_relevance=["commitment_decisions", "bet_sizing", "hand_selection"],
        example_situations=[
            "SPR 2 on flop: top pair = commit",
            "SPR 10 on flop: top pair = pot control only",
            "3-bet pot SPR 4: two pair+ commits easily",
        ],
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # RANGE CONCEPTS
    # ─────────────────────────────────────────────────────────────────────────

    "range_advantage": PokerConcept(
        concept_id="range_advantage",
        name="Range Advantage",
        category=StrategicCategory.RANGES,
        tags=[ConceptTag.RANGE_ADVANTAGE, ConceptTag.EQUITY, ConceptTag.IP_ADVANTAGE],
        related_concepts=["nut_advantage", "equity_realization", "board_coverage", "cbet_theory"],
        related_nodes=["BTN_BB_SRP_100", "EP_BB_SRP_100"],
        related_board_types=["A_high_dry", "K_high_dry"],
        explanation=ConceptExplanation(
            beginner=(
                "Range advantage means your collection of hands has more equity "
                "than your opponent's collection. On ace-high boards, the preflop "
                "raiser has range advantage because their opening range has more aces."
            ),
            intermediate=(
                "Range advantage is measured by comparing range-vs-range equity. "
                "The player with range advantage can bet more frequently, use "
                "merged strategies, and deny equity more efficiently. "
                "The disadvantaged player must check more often to protect their range."
            ),
            advanced=(
                "Range advantage manifests differently per board texture. "
                "IP has range advantage on most ace-high and king-high boards "
                "because the preflop raising range contains more of these high cards. "
                "OOP has range advantage on low connected boards because the "
                "defending range contains more suited connectors and small pairs. "
                "The player with range advantage can bet higher frequency with "
                "smaller sizes (merged strategy); the disadvantaged player should "
                "use less frequent but larger bets (polarized strategy)."
            ),
        ),
        coaching_tags=["range_advantage", "cbet_frequency", "board_texture"],
        puzzle_tags=["range_advantage", "high_card_board", "low_card_board"],
        solver_relevance=["cbet_frequency", "bet_sizing", "donk_bet_viability"],
        example_situations=[
            "BTN c-bets 85% on A72r — strong range advantage",
            "BB leads 65% on 654r — BB has range advantage on low boards",
            "SB checks most of 100% on AK9r — severe range disadvantage",
        ],
    ),

    "nut_advantage": PokerConcept(
        concept_id="nut_advantage",
        name="Nut Advantage",
        category=StrategicCategory.RANGES,
        tags=[ConceptTag.NUT_ADVANTAGE, ConceptTag.POLARIZED, ConceptTag.OVERBET],
        related_concepts=["range_advantage", "polarized_range", "overbet_theory"],
        related_nodes=["BTN_BB_SRP_100", "BTN_BB_3BET_100"],
        related_board_types=["low_connected", "A_high_wet"],
        explanation=ConceptExplanation(
            beginner=(
                "Nut advantage means you have more of the 'best possible hands' "
                "than your opponent. If you can have the nuts and they cannot, "
                "you have nut advantage. This allows you to use large bets and "
                "overbets that your opponent cannot counter-with."
            ),
            intermediate=(
                "Nut advantage is different from range advantage. You can have "
                "range advantage (more equity on average) without nut advantage "
                "(fewer nuts) and vice versa. "
                "A player with nut advantage can credibly polarize their range "
                "with large bets, because their bluffs are 'protected' by nuts "
                "their opponent cannot match."
            ),
            advanced=(
                "Nut advantage is the primary justification for large bets and overbets. "
                "If you have nut advantage, using a polarized strategy with large bets "
                "forces your opponent into a severe MDF problem — they must call wide "
                "to prevent you from bluffing profitably, but they cannot raise because "
                "you have hands that dominate their best hands. "
                "On low connected boards, BB has nut advantage (more straights, two pairs) "
                "which is why solver-optimal play involves BB donk betting at high frequency."
            ),
        ),
        coaching_tags=["nut_advantage", "overbet_viable", "polarized_betting"],
        puzzle_tags=["nut_advantage", "overbet_spot", "polar_river"],
        solver_relevance=["overbet_frequency", "river_bet_sizing", "bluff_protection"],
    ),

    "capped_range": PokerConcept(
        concept_id="capped_range",
        name="Capped Range",
        category=StrategicCategory.RANGES,
        tags=[ConceptTag.CAPPED, ConceptTag.CONDENSED],
        related_concepts=["uncapped_range", "nut_advantage", "range_advantage"],
        related_nodes=["BTN_BB_SRP_100", "BTN_BB_3BET_100"],
        related_board_types=["A_high_dry", "K_high_dry"],
        explanation=ConceptExplanation(
            beginner=(
                "A capped range is missing the strongest hands. If you called instead "
                "of raising preflop, your opponent knows you probably don't have AA, KK. "
                "Your range is 'capped' — it has a ceiling."
            ),
            intermediate=(
                "Capped ranges are vulnerable to large bets and overbets. "
                "When your range is capped, you cannot credibly represent the nuts, "
                "which means your opponent can bet very large knowing you lack the "
                "strongest hands to call or re-raise with. "
                "To protect against exploitation of capped ranges, players should "
                "sometimes slow-play strong hands to maintain an uncapped range."
            ),
            advanced=(
                "Capping occurs when certain action sequences logically exclude "
                "the strongest hands from a player's range. "
                "After calling a 3-bet out of position (when 4-betting would be standard "
                "with AA/KK), the caller's range is weakly capped. "
                "On specific board textures, ranges become capped: calling a BTN open "
                "as BB on an AKQ board leaves BB without AA, KK, QQ, AK (would have "
                "3-bet preflop and now holds those cards as well). "
                "The solver counters capping by including slowplayed hands and "
                "strong draws in the capped range's checking ranges."
            ),
        ),
        coaching_tags=["capped_range", "slowplay_consideration", "overbet_vulnerable"],
        puzzle_tags=["capped_range", "bluff_catcher", "overbet_spot"],
        solver_relevance=["calling_frequencies", "bet_sizing_response", "slowplay_frequency"],
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # POSTFLOP CONCEPTS
    # ─────────────────────────────────────────────────────────────────────────

    "equity_bucket": PokerConcept(
        concept_id="equity_bucket",
        name="Equity Bucket (EQB) Classification",
        category=StrategicCategory.POSTFLOP,
        tags=[ConceptTag.EQUITY_BUCKET, ConceptTag.EQUITY, ConceptTag.SHOWDOWN_VALUE],
        related_concepts=["range_advantage", "nut_advantage", "betting_strategy"],
        related_nodes=["BTN_BB_SRP_100"],
        related_board_types=["A_high_dry", "low_connected", "paired_board"],
        explanation=ConceptExplanation(
            beginner=(
                "Equity buckets classify your hand into one of four groups based on "
                "how it stacks up against your opponent's range: "
                "Strong (≥75% equity): bet for value. "
                "Good (50–74%): bet or call. "
                "Weak (33–49%): check or call cautiously. "
                "Trash (<33%): fold or bluff."
            ),
            intermediate=(
                "Equity buckets are not fixed — the same hand changes buckets depending "
                "on the board and ranges. Top pair on a dry board might be 'Good' (60%), "
                "but on a wet draw-heavy board it drops to 'Weak' (45%). "
                "The distribution of your range's EQBs determines your strategic approach: "
                "a range-dominant player has many Strong/Good hands, enabling high-frequency betting."
            ),
            advanced=(
                "EQB distributions per player per board drive optimal strategy selection. "
                "When IP has 22% Strong hands vs BB's 7% Strong hands on average, "
                "IP can bet at much higher frequency (value range is large). "
                "When both players have similar EQB distributions (symmetric equity), "
                "the optimal strategy shifts to more checking and small bets. "
                "EQBs visualize why low connected boards (where BB's range is more "
                "polarized) favor OOP donk betting."
            ),
        ),
        coaching_tags=["equity_bucket", "hand_strength_classification", "betting_threshold"],
        puzzle_tags=["equity_bucket", "hand_classification"],
        solver_relevance=["betting_frequency", "bet_sizing", "check_frequency"],
    ),

    "cbet_theory": PokerConcept(
        concept_id="cbet_theory",
        name="Continuation Bet (C-Bet) Theory",
        category=StrategicCategory.POSTFLOP,
        tags=[ConceptTag.CBET, ConceptTag.RANGE_ADVANTAGE, ConceptTag.EQUITY_REALIZATION],
        related_concepts=["range_advantage", "board_texture", "merged_betting", "polar_betting"],
        related_nodes=["BTN_BB_SRP_100", "CO_BB_SRP_100", "EP_BB_SRP_100"],
        related_board_types=["A_high_dry", "K_high_dry", "low_connected", "mid_high_wet"],
        explanation=ConceptExplanation(
            beginner=(
                "A c-bet is a bet made by the preflop aggressor on the flop. "
                "You bet to follow up on your preflop aggression. "
                "Good c-bet boards: ace-high dry boards (you have more aces). "
                "Bad c-bet boards: low connected boards (your opponent's range connects better)."
            ),
            intermediate=(
                "C-bet strategy depends on: board texture, range advantage, SPR, position. "
                "High-frequency small c-bets (merged strategy) work on dry boards where "
                "IP has range advantage — bet most of the range for a small size. "
                "Lower-frequency larger c-bets (polarized strategy) work on wet boards — "
                "bet only strong hands and selected bluffs, check the middle of the range."
            ),
            advanced=(
                "Modern solver-derived c-bet strategy: "
                "Dry boards with IP range advantage: high frequency (~85%), small (25-33%). "
                "Wet boards with contested equity: medium frequency (~55%), medium (50-67%). "
                "Low connected boards with OOP range advantage: low frequency (~45%), "
                "and use mixed sizes. "
                "Never betting (checking 100%) on the flop costs IP ~26bb/100 in EV — "
                "c-betting is essential to IP strategy, particularly on high-card boards."
            ),
        ),
        coaching_tags=["cbet_frequency", "merged_cbet", "polarized_cbet", "cbet_sizing"],
        puzzle_tags=["cbet_spot", "cbet_frequency", "dry_board_cbet", "wet_board_cbet"],
        solver_relevance=["cbet_frequency", "cbet_sizing", "flop_bet_strategy"],
        example_situations=[
            "BTN c-bets 90% for 25% on A72r — merged high frequency",
            "BTN c-bets 55% for 67% on QJT — polarized lower frequency",
            "CO checks back 60% on 654r — range disadvantage limits c-bet",
        ],
    ),

    "donk_bet": PokerConcept(
        concept_id="donk_bet",
        name="Donk Bet (Leading Out)",
        category=StrategicCategory.POSTFLOP,
        tags=[ConceptTag.DONK_BET, ConceptTag.NUT_ADVANTAGE, ConceptTag.OOP_DISADVANTAGE],
        related_concepts=["range_advantage", "nut_advantage", "oop_strategy"],
        related_nodes=["BTN_BB_SRP_100", "SB_BB_SRP_100"],
        related_board_types=["low_connected"],
        explanation=ConceptExplanation(
            beginner=(
                "A donk bet is when the player out of position bets into the preflop aggressor, "
                "rather than checking and letting them c-bet. "
                "When to donk: you have a big hand on a board that hits your range more than theirs. "
                "Example: you called BTN from BB with 76s and flop comes 8♠5♦4♣."
            ),
            intermediate=(
                "Donk betting is valid when OOP has a range advantage or nut advantage "
                "on specific board textures. Low connected boards (2–8 high) hit BB's "
                "calling range more than IP's opening range because openers rarely include "
                "low suited connectors, while BB defends with them. "
                "The small donk bet (25% pot) is most common — it builds the pot with "
                "a wide range of hands while preventing IP from seeing a free turn."
            ),
            advanced=(
                "Donk betting is a complex tool that solvers use on specific textures: "
                "High donk boards (50%+ donk frequency): 6XX and 7XX with connectivity. "
                "Mid donk boards (25–50%): 8XX and 7XX with moderate connectivity. "
                "Low donk boards (<25%): 9XX, paired, high-card boards. "
                "No donk boards (0–10%): ace-high, king-high, monotone. "
                "The primary donk bet size is 25% pot — building the pot cheaply. "
                "Larger donk bets (67%) are used on specific textures with polarized ranges."
            ),
        ),
        coaching_tags=["donk_bet", "oop_aggression", "low_board_bb_advantage"],
        puzzle_tags=["donk_bet", "oop_lead", "low_connected_board"],
        solver_relevance=["donk_frequency", "donk_sizing", "oop_initiative"],
        example_situations=[
            "BB leads 654r for 25% pot with entire range — correct dominant strategy",
            "BB leads AK9r for 25% — incorrect, IP has massive range advantage",
            "BB leads paired board 77x for 25% — occasional, not dominant",
        ],
    ),

    "overbet": PokerConcept(
        concept_id="overbet",
        name="Overbet (>100% Pot)",
        category=StrategicCategory.BET_SIZING,
        tags=[ConceptTag.OVERBET, ConceptTag.NUT_ADVANTAGE, ConceptTag.POLARIZED],
        related_concepts=["nut_advantage", "polarized_range", "mdf", "geometric_sizing"],
        related_nodes=["BTN_BB_SRP_100", "BTN_BB_3BET_100"],
        related_board_types=["low_connected", "A_high_wet"],
        explanation=ConceptExplanation(
            beginner=(
                "An overbet is a bet larger than the pot. Example: pot is 20bb, "
                "you bet 30bb (1.5x pot). Overbets are used when you want to force "
                "your opponent into a very difficult decision — call a huge amount "
                "or fold. They only work when your range has the nuts."
            ),
            intermediate=(
                "Overbets require nut advantage. If you overbet without the nuts "
                "in your range, your opponent can raise and destroy you. "
                "Overbets work by raising MDF pressure dramatically — "
                "a 2x pot overbet requires the defender to call only 33% of their range, "
                "but the defender must include strong hands because you could have the nuts. "
                "This forces difficult call-downs with marginal holdings."
            ),
            advanced=(
                "Geometrically, overbets are optimal when polarization is extreme. "
                "In the clairvoyance game (nuts vs bluffs), the optimal bet is always "
                "all-in because larger bets let the bettor bluff more often and "
                "capture more pot EV. "
                "In real poker, overbets are used: "
                "(1) On turn/river when one player has a decisive range advantage. "
                "(2) When the board runout strongly favors one player's range. "
                "(3) OOP players overbet more than IP players because they use "
                "overbets to compensate for positional disadvantage and reduce SPR."
            ),
        ),
        coaching_tags=["overbet", "nut_advantage_required", "polar_sizing"],
        puzzle_tags=["overbet_spot", "polar_river", "nut_advantage"],
        solver_relevance=["overbet_frequency", "mdf_at_overbet", "nut_advantage_requirement"],
    ),

    "polarized_betting": PokerConcept(
        concept_id="polarized_betting",
        name="Polarized Betting Strategy",
        category=StrategicCategory.BET_SIZING,
        tags=[ConceptTag.POLARIZED, ConceptTag.BLUFF_VALUE_RATIO, ConceptTag.NUT_ADVANTAGE],
        related_concepts=["merged_betting", "bluff_value_ratio", "nut_advantage"],
        related_nodes=["BTN_BB_3BET_100"],
        related_board_types=["low_connected", "A_high_wet"],
        explanation=ConceptExplanation(
            beginner=(
                "Polarized betting means you bet with either very strong hands (for value) "
                "or weak hands (as bluffs), checking your medium-strength hands. "
                "Large bet sizes go with polarized ranges. "
                "Example: on the river, bet pot with your flushes and gut-shot misses, "
                "but check your two pair (medium strength)."
            ),
            intermediate=(
                "Polarization is correct when your betting range is split between "
                "nut hands (that want value) and air (that need folds). "
                "Medium-strength hands (showdown value) are checked because they "
                "can win at showdown — there's no need to risk them in a bet/fold situation. "
                "The larger the bet, the more polarized the range should be."
            ),
            advanced=(
                "Polarized strategies dominate when: "
                "(1) The bettor has nut advantage. "
                "(2) Multiple streets remain (nuts can be played aggressively). "
                "(3) The opponent's range is condensed (no nuts to counter). "
                "The bluff-to-value ratio in a polarized strategy equals alpha: "
                "1 bluff per (1/alpha - 1) value hands. "
                "Polarized betting on the flop with very large sizes is rarely optimal "
                "because it gives away range information too early — instead, small "
                "merged bets with polarization emerging naturally on later streets."
            ),
        ),
        coaching_tags=["polarized_betting", "value_bluff_balance", "large_sizing"],
        puzzle_tags=["polar_strategy", "value_or_bluff", "large_cbet"],
        solver_relevance=["bet_sizing", "range_construction", "bluff_frequency"],
    ),

    "merged_betting": PokerConcept(
        concept_id="merged_betting",
        name="Merged Betting Strategy",
        category=StrategicCategory.BET_SIZING,
        tags=[ConceptTag.MERGED, ConceptTag.RANGE_ADVANTAGE, ConceptTag.CBET],
        related_concepts=["polarized_betting", "range_advantage", "equity_denial"],
        related_nodes=["BTN_BB_SRP_100"],
        related_board_types=["A_high_dry", "K_high_dry"],
        explanation=ConceptExplanation(
            beginner=(
                "Merged betting means betting most of your range at a small size. "
                "Instead of only betting your best hands, you bet with strong, medium, "
                "and even some weak hands for a small fraction of the pot. "
                "Example: c-bet 25% pot with your entire range on A72r."
            ),
            intermediate=(
                "Merged betting works when you have a significant range advantage. "
                "The small size forces your opponent to defend wide (per MDF) "
                "while denying equity to their weak holdings that would otherwise "
                "see free cards. It's cheap to execute and maximizes EV across a large range."
            ),
            advanced=(
                "Merged strategies emerge when: "
                "(1) Range advantage is strong (lots of hands have >50% equity). "
                "(2) SPR is high enough that equity denial across the range has value. "
                "(3) Board texture favors the bettor consistently. "
                "The key insight: on A-high dry boards, even air gets some equity "
                "from fold equity, and the bettor's medium hands (middle pair) "
                "beat the defender's medium hands often enough to make betting profitable. "
                "Merged betting is a 'flooding' strategy — bet so often and cheaply that "
                "your opponent cannot possibly have the right odds to raise or fold everything."
            ),
        ),
        coaching_tags=["merged_betting", "small_cbet", "high_frequency", "equity_denial"],
        puzzle_tags=["merged_cbet", "dry_board_strategy", "high_frequency_bet"],
        solver_relevance=["cbet_frequency", "cbet_sizing", "dry_board_strategy"],
    ),

    "geometric_sizing": PokerConcept(
        concept_id="geometric_sizing",
        name="Geometric Bet-Sizing",
        category=StrategicCategory.BET_SIZING,
        tags=[ConceptTag.GEOMETRIC_SIZING, ConceptTag.SPR, ConceptTag.POLARIZED],
        related_concepts=["polarized_betting", "spr_theory", "overbet"],
        related_nodes=[],
        related_board_types=[],
        explanation=ConceptExplanation(
            beginner=(
                "Geometric sizing is betting the same fraction of pot on each street "
                "so that you end up all-in on the river. "
                "Example: With pot 10bb and stack 90bb across 3 streets, "
                "bet roughly the same fraction each street to commit all chips by the river."
            ),
            intermediate=(
                "The geometric bet size ensures the pot grows at a constant rate "
                "relative to both players' stacks. It's optimal for the player with a "
                "polarized range who wants to commit all chips efficiently. "
                "Going all-in on the river after geometric betting is often the goal "
                "when you have the nuts or are executing a multi-street bluff."
            ),
            advanced=(
                "Formula: R = (final_pot / starting_pot)^(1/streets) - 1 "
                "where final_pot = starting_pot + 2 × effective_stack. "
                "With deep stacks, geometric bets are often overbets — this is "
                "theoretically correct for perfectly polarized ranges but impractical "
                "because real ranges are never perfectly polar. "
                "In practice, smaller geometric bets (50-75% pot) are used to build "
                "the pot over multiple streets while preserving range complexity. "
                "The concept matters most in 3-bet pots with low SPR, where "
                "the pot grows quickly and all-in on the river is natural."
            ),
        ),
        formula="bet_fraction = (final_pot/starting_pot)^(1/streets) - 1",
        coaching_tags=["geometric_sizing", "multi_street_plan", "stack_off_plan"],
        puzzle_tags=["geometric_bet", "multi_street_bluff", "commit_plan"],
        solver_relevance=["multi_street_bet_sizing", "all_in_setup", "pot_construction"],
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # EXPLOITATIVE CONCEPTS
    # ─────────────────────────────────────────────────────────────────────────

    "exploitative_play": PokerConcept(
        concept_id="exploitative_play",
        name="Exploitative vs GTO Play",
        category=StrategicCategory.EXPLOITATIVE,
        tags=[ConceptTag.EXPLOIT, ConceptTag.GTO, ConceptTag.NASH_EQUILIBRIUM],
        related_concepts=["nash_equilibrium", "mdf", "fold_equity"],
        related_nodes=[],
        related_board_types=[],
        explanation=ConceptExplanation(
            beginner=(
                "GTO play is unexploitable — it wins money from everyone who deviates. "
                "Exploitative play adjusts to specific opponents' mistakes to win even more. "
                "Against a player who folds too much, bluff more. "
                "Against a player who calls too much, value bet thinner."
            ),
            intermediate=(
                "Exploitative play trades unexploitability for higher EV against specific "
                "opponents. The risk: if your opponent correctly identifies your adjustment, "
                "they can counter-exploit back. "
                "The safest exploit is stealing from tight players who over-fold, "
                "because the downside (getting called) is bounded. "
                "The riskiest exploit is bluffing into calling stations."
            ),
            advanced=(
                "Active exploitation: deviating from GTO to take advantage of a specific leak. "
                "Passive exploitation: playing GTO and profiting from opponent's suboptimal play "
                "(they self-exploit). "
                "Maximal exploitative strategy (MES): the most profitable response to a fixed "
                "opponent strategy — but creates leaks if opponent adjusts. "
                "Key finding: vs opponents who over-fold, MES gains modest extra EV but "
                "is heavily exploitable if caught. GTO gains less but cannot be countered. "
                "Recommendation: Use GTO as baseline; make conservative exploitative adjustments "
                "only when you have high confidence about opponent's specific leak."
            ),
        ),
        coaching_tags=["exploit_vs_gto", "opponent_tendencies", "strategic_deviation"],
        puzzle_tags=["exploit_spot", "gto_deviation", "leak_detection"],
        solver_relevance=["baseline_strategy", "population_tendencies", "exploit_adjustment"],
    ),

    "position_value": PokerConcept(
        concept_id="position_value",
        name="Value of Position",
        category=StrategicCategory.POSITION,
        tags=[ConceptTag.IP_ADVANTAGE, ConceptTag.EQUITY_REALIZATION, ConceptTag.OOP_DISADVANTAGE],
        related_concepts=["equity_realization", "range_advantage", "spr_theory"],
        related_nodes=["BTN_BB_SRP_100", "SB_BB_SRP_100"],
        related_board_types=["A_high_dry", "low_connected"],
        explanation=ConceptExplanation(
            beginner=(
                "Being 'in position' means you act last — you see what your opponent "
                "does before deciding. This is a major advantage: you can check back "
                "to see free cards, or bet when you have information about their hand."
            ),
            intermediate=(
                "Position advantage translates directly to EV. With symmetric ranges, "
                "the IP player captures ~55% of the pot vs OOP's ~45%. "
                "This 5-10% EV advantage comes from: "
                "(1) Free cards: IP can check back and see the next street. "
                "(2) Information advantage: IP acts after OOP reveals their hand strength. "
                "(3) Equity realization: IP over-realizes equity at ~110% vs OOP at ~90%."
            ),
            advanced=(
                "The value of position compounds across multiple streets and deeper stacks. "
                "At SPR 10+, position becomes even more valuable because more streets "
                "remain and the information gathered per street accumulates. "
                "OOP players counteract positional disadvantage by: "
                "(1) Preferring larger bet sizes to reduce SPR faster. "
                "(2) Not splitting their range into multiple bet sizes (avoids information leaks). "
                "(3) Check-raising more frequently to shift initiative. "
                "(4) Choosing spots with lower SPR to minimize positional disadvantage."
            ),
        ),
        coaching_tags=["position_value", "ip_advantage", "equity_realization"],
        puzzle_tags=["position_concept", "ip_vs_oop", "free_card"],
        solver_relevance=["equity_realization", "check_back_frequency", "oop_strategy"],
    ),

    "blockers": PokerConcept(
        concept_id="blockers",
        name="Blockers",
        category=StrategicCategory.HAND_READING,
        tags=[ConceptTag.BLOCKERS, ConceptTag.NUT_ADVANTAGE, ConceptTag.BLUFF_VALUE_RATIO],
        related_concepts=["range_advantage", "bluff_candidate_selection", "combinatorics"],
        related_nodes=["BTN_BB_3BET_100"],
        related_board_types=["A_high_dry", "A_high_wet"],
        explanation=ConceptExplanation(
            beginner=(
                "A blocker is a card in your hand that reduces how many of a specific "
                "combination your opponent can have. If you hold the A♦, your opponent "
                "cannot have AA or A♦K♦ — you block those combos."
            ),
            intermediate=(
                "Blockers affect both bluffing and calling decisions. "
                "Best bluff candidates often have blockers to villain's continuing range: "
                "holding the Ace on a flush board blocks villain's nut flush draw. "
                "Blockers also affect calling: if you hold A-x, villain has fewer AA combos, "
                "making their value range slightly smaller."
            ),
            advanced=(
                "Blocker effects are strongest when villain's range is narrow. "
                "On the river after multiple streets, villain's range is typically small — "
                "a blocker might eliminate 25-50% of their remaining value combos. "
                "Best 3-bet/4-bet bluffs often use hands like A5s: "
                "(1) Ace blocks AA and AK value combos. "
                "(2) 5 has no showdown value (prefers fold equity). "
                "(3) Suited provides backdoor equity as insurance. "
                "Kicker-weak blockers (K2s, K3s) are often chosen over strong kickers (KQs) "
                "as bluffs because KQs has more post-flop value and playability."
            ),
        ),
        coaching_tags=["blocker_effect", "bluff_selection", "combo_reduction"],
        puzzle_tags=["blockers", "bluff_candidate", "range_reduction"],
        solver_relevance=["bluff_hand_selection", "calling_range_adjustment", "combo_counting"],
    ),
}


def get_concept(concept_id: str) -> PokerConcept | None:
    """Look up a concept by ID."""
    return CONCEPT_REGISTRY.get(concept_id)


def get_concepts_by_tag(tag: ConceptTag) -> list[PokerConcept]:
    """Find all concepts with a specific tag."""
    return [c for c in CONCEPT_REGISTRY.values() if tag in c.tags]


def get_concepts_by_category(category: StrategicCategory) -> list[PokerConcept]:
    """Find all concepts in a category."""
    return [c for c in CONCEPT_REGISTRY.values() if c.category == category]


def get_related_concepts(concept_id: str) -> list[PokerConcept]:
    """Get all concepts related to a given concept."""
    concept = CONCEPT_REGISTRY.get(concept_id)
    if not concept:
        return []
    return [CONCEPT_REGISTRY[cid] for cid in concept.related_concepts if cid in CONCEPT_REGISTRY]
