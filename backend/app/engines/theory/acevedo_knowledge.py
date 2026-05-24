"""
Acevedo Knowledge Base
======================
Structured concept database grounded in "Modern Poker Theory: Building an
Unbeatable Strategy Based on GTO Principles" by Michael Acevedo.

Design rules:
  - NO fake page numbers — the book's concepts are referenced by theme/topic.
  - NO invented frequencies — language is qualitative and appropriately hedged.
  - Confidence levels are attached to every claim.
  - Concepts are matchable from extracted hand features.

This module is the SINGLE SOURCE OF THEORY for the advice layer.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Confidence(str, Enum):
    HIGH   = "high"    # Well-established principle; solver behavior aligns universally
    MEDIUM = "medium"  # Principle holds in most configurations; context matters
    LOW    = "low"     # Situational; opposing factors may dominate


class ChapterTheme(str, Enum):
    """Major thematic sections in Modern Poker Theory."""
    GAME_THEORY_FOUNDATIONS = "Game Theory Foundations"
    RANGE_CONSTRUCTION      = "Range Construction and Preflop Theory"
    POSTFLOP_FUNDAMENTALS   = "Postflop Fundamentals"
    BOARD_TEXTURE_ANALYSIS  = "Board Texture Analysis"
    SPR_THEORY              = "Stack-to-Pot Ratio Theory"
    BET_SIZING_THEORY       = "Bet Sizing Theory"
    CBETTING_THEORY         = "C-Betting and Continuation Play"
    RANGE_ADVANTAGE         = "Range Advantage and Board Coverage"
    BLUFFING_THEORY         = "Bluffing and Polarization"
    EQUITY_REALIZATION      = "Equity Realization"
    MULTISTREET_PLANNING    = "Multi-Street Play and Geometric Sizing"
    NUT_ADVANTAGE           = "Nut Advantage and Overbetting"
    POSITION_VALUE          = "Position and Information Advantage"
    TOURNAMENT_ADJUSTMENTS  = "Tournament Play and ICM Adjustments"


@dataclass(frozen=True)
class AcevedoConcept:
    """
    A single theory concept grounded in Modern Poker Theory.

    Fields:
        id:                  Unique machine-readable identifier
        name:                Human-readable concept name
        chapter_theme:       Which thematic section of the book this belongs to
        description:         What the concept is
        strategic_principle: How it applies in practice (appropriately hedged)
        confidence:          How universally applicable this principle is
        applicable_situations: List of spot descriptors where this concept is relevant
        example:             A concrete, honest example — no fake frequencies
        related_concepts:    IDs of related concepts
        hedging_language:    Qualifiers to use when low/medium confidence
    """
    id: str
    name: str
    chapter_theme: ChapterTheme
    description: str
    strategic_principle: str
    confidence: Confidence
    applicable_situations: list[str]
    example: str
    related_concepts: list[str] = field(default_factory=list)
    hedging_language: str = ""


# ── Core Concept Registry ─────────────────────────────────────────────────────

ACEVEDO_CONCEPTS: dict[str, AcevedoConcept] = {}

def _reg(c: AcevedoConcept) -> AcevedoConcept:
    ACEVEDO_CONCEPTS[c.id] = c
    return c


# ── Game Theory Foundations ───────────────────────────────────────────────────

_reg(AcevedoConcept(
    id="mdf",
    name="Minimum Defense Frequency (MDF)",
    chapter_theme=ChapterTheme.GAME_THEORY_FOUNDATIONS,
    description=(
        "MDF is the minimum frequency a player must defend against a bet to prevent "
        "the bettor from profiting with pure bluffs regardless of hand strength. "
        "Formula: MDF = pot / (pot + bet). Against a half-pot bet, you must defend "
        "roughly two-thirds of your range; against a pot-sized bet, one half."
    ),
    strategic_principle=(
        "When facing a bet, folding more than (1 - MDF) of your range allows "
        "profitable pure bluffing. Conversely, defending exactly MDF with your "
        "best hands makes you indifferent to bluffs. MDF defines the lower bound "
        "of required defense — actual defense should also account for the "
        "composition of your range and your ability to realize equity."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "facing_any_bet", "river_decision", "calling_range_construction",
        "evaluating_fold_frequency",
    ],
    example=(
        "Villain bets 50% pot. MDF = pot / (pot + 0.5*pot) ≈ 0.67. "
        "You must continue with at least 67% of your range to prevent "
        "profitable auto-bluffing. This includes calling AND raising."
    ),
    related_concepts=["alpha", "bluff_value_ratio", "equity_realization"],
))

_reg(AcevedoConcept(
    id="alpha",
    name="Alpha — Required Fold Equity",
    chapter_theme=ChapterTheme.GAME_THEORY_FOUNDATIONS,
    description=(
        "Alpha (α) is the minimum fold frequency a bluff requires to break even. "
        "Formula: α = bet / (pot + bet). A bluff of half-pot requires folds "
        "roughly one-third of the time to be immediately profitable."
    ),
    strategic_principle=(
        "A bluff is immediately profitable when opponent folds more than α. "
        "Against tight ranges (river with polarized hands), α may already be "
        "exceeded. Against wide calling ranges, a bluff needs strong equity on "
        "the remaining streets or substantial blockers to justify the risk."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "bluff_spots", "river_bluff", "semi_bluff", "sizing_choice",
    ],
    example=(
        "You bet pot on the river. α = pot / (2*pot) = 0.50. "
        "If villain folds more than 50% of their range, the bluff profits "
        "immediately. Blockers to calling hands increase your fold equity."
    ),
    related_concepts=["mdf", "bluff_value_ratio", "blockers"],
))

_reg(AcevedoConcept(
    id="bluff_value_ratio",
    name="Bluff-to-Value Ratio",
    chapter_theme=ChapterTheme.BLUFFING_THEORY,
    description=(
        "At equilibrium, the ratio of bluffs to value hands in a betting range "
        "is determined by bet size and the MDF. With a half-pot bet, "
        "a balanced range contains roughly 1 bluff for every 2 value hands; "
        "with a pot-sized bet, roughly 1:1."
    ),
    strategic_principle=(
        "A range with too many bluffs relative to value is exploitable by calling. "
        "A range with too few bluffs is exploitable by folding. "
        "Larger bet sizes allow proportionally more bluffs, which is why "
        "polarized, nut-heavy ranges benefit from large or overbet sizing."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "river_bet_construction", "polar_range_betting", "bluff_selection",
    ],
    example=(
        "Betting pot on the river: balanced range has ~50% value, ~50% bluffs. "
        "Betting 33% pot: balanced range has ~75% value, ~25% bluffs. "
        "Choose sizing to match the composition of your actual range."
    ),
    related_concepts=["alpha", "mdf", "polarized_range", "nut_advantage"],
))

_reg(AcevedoConcept(
    id="nash_equilibrium",
    name="Nash Equilibrium and GTO Strategy",
    chapter_theme=ChapterTheme.GAME_THEORY_FOUNDATIONS,
    description=(
        "A Nash Equilibrium in poker is a strategy pair where neither player can "
        "increase their EV by unilaterally deviating. GTO (Game Theory Optimal) "
        "play approximates Nash Equilibrium — it cannot be exploited, but it "
        "also does not maximally exploit opponents."
    ),
    strategic_principle=(
        "Perfect GTO play requires solver computation across all possible ranges "
        "and boards — it cannot be replicated from memory. In practice, GTO "
        "principles inform strategic tendencies (sizing structures, range "
        "construction, defense frequencies) rather than exact mixed strategies."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=["all_spots"],
    example=(
        "GTO is a theoretical benchmark, not a practical memorization target. "
        "Understanding GTO principles helps identify exploitable deviations "
        "in opponents and builds a foundation for exploitative adjustments."
    ),
    related_concepts=["mdf", "alpha", "range_advantage"],
    hedging_language="In GTO theory,",
))


# ── Range Concepts ────────────────────────────────────────────────────────────

_reg(AcevedoConcept(
    id="range_advantage",
    name="Range Advantage",
    chapter_theme=ChapterTheme.RANGE_ADVANTAGE,
    description=(
        "Range advantage exists when one player's entire range connects better "
        "with the board than the opponent's. It is measured across ALL hands in "
        "each range, not just the current holding. The player with range advantage "
        "generally benefits from betting at higher frequencies and smaller sizes."
    ),
    strategic_principle=(
        "On boards where the preflop raiser's range contains many more "
        "strong top-pair+ combinations than the caller's, the raiser typically "
        "holds range advantage. This allows frequent, small c-bets to extract "
        "value while applying pressure on the capped, weaker range."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "flop_cbet_spot", "a_high_dry_board", "k_high_dry_board",
        "preflop_raiser_ip", "postflop_range_construction",
    ],
    example=(
        "BTN opens, BB calls. Flop: K72 rainbow. BTN's range contains all AK, KK, "
        "K9s+ — many king combinations. BB's range rarely has KK (4-bet preflop) "
        "and fewer Kx hands. BTN has strong range advantage here."
    ),
    related_concepts=["nut_advantage", "cbet_theory", "board_texture"],
))

_reg(AcevedoConcept(
    id="nut_advantage",
    name="Nut Advantage",
    chapter_theme=ChapterTheme.NUT_ADVANTAGE,
    description=(
        "Nut advantage is a specific component of range advantage focused on who "
        "has more nutted combinations (strongest possible hands) given the board. "
        "Unlike general range advantage, nut advantage is the key driver for "
        "large and overbet sizing strategies."
    ),
    strategic_principle=(
        "The player with nut advantage can credibly represent the strongest hands "
        "on a given board, justifying polarized large-bet and overbet strategies. "
        "When one player holds many nuts and the other cannot reasonably call with "
        "less, overbetting creates maximum pressure."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "overbet_spots", "river_polarized_betting", "paired_board_turn",
        "monotone_board", "check_raise_as_caller",
    ],
    example=(
        "Turn: A-high board runs out an ace. The preflop caller's range may "
        "contain more trips combos than the raiser. The caller gains nut "
        "advantage and can consider leading or check-raising with large sizes."
    ),
    related_concepts=["range_advantage", "polarized_range", "overbet"],
))

_reg(AcevedoConcept(
    id="polarized_range",
    name="Polarized Range",
    chapter_theme=ChapterTheme.RANGE_CONSTRUCTION,
    description=(
        "A polarized range contains a high proportion of very strong hands "
        "(value) and very weak hands (bluffs), with few medium-strength hands. "
        "Polarized ranges are well-suited to large and overbet sizing, where "
        "the bet-to-call ratio incentivizes bluffing and discourages calling "
        "with medium-strength hands."
    ),
    strategic_principle=(
        "Large bets require polarized ranges because the bettor is committed "
        "to facing a call — they need either strong equity or a compelling "
        "bluff. Medium-strength hands don't benefit from large bets because "
        "they cannot profitably call a raise and often just fold out worse."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "river_betting", "large_bet_sizing", "overbet_spots",
        "3bet_pot_flop", "4bet_pot_flop",
    ],
    example=(
        "On the river with a pot-sized bet, your range should contain strong "
        "made hands you bet for value and hands with no showdown value betting "
        "as bluffs. Middle-pair-type hands generally check/call or check/fold."
    ),
    related_concepts=["bluff_value_ratio", "nut_advantage", "merged_range"],
))

_reg(AcevedoConcept(
    id="merged_range",
    name="Merged (Linear) Betting Range",
    chapter_theme=ChapterTheme.RANGE_CONSTRUCTION,
    description=(
        "A merged or linear betting range contains hands across a continuous "
        "strength spectrum — from strong hands down to medium-strength hands. "
        "Merged ranges are appropriate when using small bet sizes on boards "
        "where range advantage is clear and opponent's range is capped."
    ),
    strategic_principle=(
        "On boards where the raiser holds clear range advantage, betting a merged "
        "range at small size allows high-frequency betting: strong hands get value, "
        "medium hands apply pressure, and the range maintains balance. The small "
        "size doesn't give the opponent an attractive raise target."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "a_high_dry_flop_ip", "k_high_dry_flop_ip", "range_advantage_spot",
        "small_cbet_strategy",
    ],
    example=(
        "BTN c-bets 25% pot on K72r. This small size with a merged range extracts "
        "value from all Kx hands, continues with overcards for equity, and folds "
        "out bottom of BB's range. The capped nature of BB's range prevents "
        "exploitation through raises."
    ),
    related_concepts=["range_advantage", "cbet_theory", "polarized_range"],
))

_reg(AcevedoConcept(
    id="capped_range",
    name="Capped Range",
    chapter_theme=ChapterTheme.RANGE_CONSTRUCTION,
    description=(
        "A capped range lacks the strongest possible hands. Calling ranges are "
        "often capped post-flop because very strong hands (sets, two-pair) are "
        "more likely to have raised preflop or on an earlier street. A capped "
        "range limits the maximum strength one can represent."
    ),
    strategic_principle=(
        "Identifying when your opponent's range is capped allows more aggressive "
        "play — they cannot hold the strongest hands, reducing their ability to "
        "raise effectively. Conversely, recognizing when your OWN range is capped "
        "limits which hands justify large bets or raises."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "caller_range_assessment", "multiway_spots", "calling_station_dynamics",
    ],
    example=(
        "After calling a 3-bet on the flop and turn, villain's range is likely "
        "capped — sets and two-pair often raise. On the river, a large bet puts "
        "maximum pressure on their capped calling range."
    ),
    related_concepts=["range_advantage", "polarized_range", "nut_advantage"],
))


# ── SPR Theory ────────────────────────────────────────────────────────────────

_reg(AcevedoConcept(
    id="spr_theory",
    name="Stack-to-Pot Ratio (SPR)",
    chapter_theme=ChapterTheme.SPR_THEORY,
    description=(
        "SPR is the ratio of the effective stack to the pot at the start of a "
        "street (usually the flop). SPR determines commitment thresholds and "
        "appropriate hand selection. Low SPR: strong made hands commit easily. "
        "High SPR: drawing and nut-potential hands gain in value."
    ),
    strategic_principle=(
        "At low SPR (<4), top pair/top kicker is often strong enough to commit "
        "the stack. At medium SPR (4-12), two pair or better typically justifies "
        "full commitment. At high SPR (>12), you generally need the nuts or "
        "a strong draw to build toward full commitment."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "commitment_decisions", "flop_strategy", "calling_off_stacks",
        "3bet_pot_play", "short_stack_play",
    ],
    example=(
        "In a 3-bet pot, flop SPR ≈ 3. Top pair is often committed at this depth. "
        "In a single-raised pot with 200bb effective stacks, flop SPR ≈ 20 — "
        "top pair requires much more caution before committing."
    ),
    related_concepts=["geometric_sizing", "equity_realization", "commitment_threshold"],
))

_reg(AcevedoConcept(
    id="geometric_sizing",
    name="Geometric Bet Sizing",
    chapter_theme=ChapterTheme.MULTISTREET_PLANNING,
    description=(
        "Geometric sizing plans bets across multiple streets to arrive at a "
        "natural all-in on the final street without any single bet being "
        "disproportionate. The formula: each bet is a constant fraction of "
        "the growing pot, creating exponential growth toward stack commitment."
    ),
    strategic_principle=(
        "With a highly polarized range, geometric sizing maximizes the final "
        "pot while maintaining fold equity at each street. It signals strength "
        "consistently across streets and avoids committing too much too early "
        "or too little too late."
    ),
    confidence=Confidence.MEDIUM,
    applicable_situations=[
        "multi_street_value_hand", "draw_heavy_board", "stack_off_planning",
        "3bet_pot_commitment",
    ],
    example=(
        "With SPR ~10 at the flop and a value hand, geometric sizing across "
        "three streets might be ~33% flop, ~50% turn, ~75% river — growing "
        "the pot to reach all-in naturally. Specific fractions depend on SPR."
    ),
    related_concepts=["spr_theory", "polarized_range", "nut_advantage"],
    hedging_language="Geometric sizing theory suggests",
))


# ── Board Texture Theory ──────────────────────────────────────────────────────

_reg(AcevedoConcept(
    id="dry_board_strategy",
    name="Strategy on Dry, Disconnected Boards",
    chapter_theme=ChapterTheme.BOARD_TEXTURE_ANALYSIS,
    description=(
        "Dry boards (e.g., A72 rainbow, K83 rainbow) have few draws and limited "
        "straight/flush possibilities. The preflop aggressor typically has strong "
        "range advantage on these boards because their range contains more "
        "top-pair and over-pair combinations."
    ),
    strategic_principle=(
        "On dry boards, the preflop aggressor generally benefits from frequent, "
        "small c-bets with a merged range. The caller's range is capped and "
        "has few draws, making large bets less necessary. Small bets with "
        "high frequency are theoretically sound on most dry high-card boards."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "a_high_dry_board", "k_high_dry_board", "rainbow_disconnected_board",
        "ip_cbet_decision",
    ],
    example=(
        "BTN vs BB on A72r: BTN holds strong range advantage. Theory suggests "
        "small, frequent c-bets are effective — the capped caller cannot "
        "raise with strong enough holdings to prevent frequent betting."
    ),
    related_concepts=["range_advantage", "merged_range", "cbet_theory"],
))

_reg(AcevedoConcept(
    id="wet_board_strategy",
    name="Strategy on Wet, Connected Boards",
    chapter_theme=ChapterTheme.BOARD_TEXTURE_ANALYSIS,
    description=(
        "Wet boards (e.g., JT9 two-tone, 876 rainbow) have many draws and "
        "strong made hands for the calling range. The preflop caller's range "
        "often contains more of the connecting cards (mid-cards) that make "
        "straights and two-pair on these boards."
    ),
    strategic_principle=(
        "On wet connected boards, the aggressor's range advantage is reduced "
        "or reversed. C-bet frequency typically decreases; sizing may increase "
        "when continuing (to charge draws) or medium-sized bets are appropriate. "
        "Check-raising becomes more valuable for the OOP caller."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "low_connected_board", "wet_broadway_board", "draw_heavy_board",
        "oop_caller_strategy",
    ],
    example=(
        "CO vs BB on 876 two-tone. BB's range contains more 9s, 8s, 7s, 6s, "
        "and 5s for straight draws than CO's wider preflop opening range. "
        "CO should be selective with c-bets; BB gains check-raise equity."
    ),
    related_concepts=["range_advantage", "nut_advantage", "donk_bet_theory"],
))

_reg(AcevedoConcept(
    id="monotone_board_strategy",
    name="Strategy on Monotone Boards",
    chapter_theme=ChapterTheme.BOARD_TEXTURE_ANALYSIS,
    description=(
        "Monotone boards (three cards of the same suit) heavily skew equity "
        "toward whoever holds the flush draw or made flush. Both players' "
        "ranges change significantly — flush combos gain and off-suit hands lose. "
        "The range with more flush combos has nut advantage."
    ),
    strategic_principle=(
        "On monotone boards, the player with more flush combinations in their "
        "range tends to have nut advantage. C-betting strategy becomes more "
        "complex — hands without the suit of the board lose protection value. "
        "Both players should consider checking more of their ranges."
    ),
    confidence=Confidence.MEDIUM,
    applicable_situations=[
        "monotone_flop", "flush_heavy_board", "draw_assessment",
    ],
    example=(
        "On JhTh9h, the player with more high heart combos (flush draws and "
        "made flushes) has nut advantage. The other player faces difficult "
        "decisions with all non-flush hands, as many strong holding lose equity."
    ),
    related_concepts=["nut_advantage", "wet_board_strategy", "range_advantage"],
    hedging_language="On monotone boards, generally",
))

_reg(AcevedoConcept(
    id="paired_board_strategy",
    name="Strategy on Paired Boards",
    chapter_theme=ChapterTheme.BOARD_TEXTURE_ANALYSIS,
    description=(
        "Paired boards (e.g., AA7, KK9, 772) reduce drawing equity significantly. "
        "The preflop aggressor generally has more full houses and trips in their "
        "range. Drawing hands lose value because the paired cards interact poorly "
        "with straight and flush draws."
    ),
    strategic_principle=(
        "Paired boards often favor small, frequent bets by the range with more "
        "trips and full houses. The threat of trips reduces the calling range's "
        "incentive to continue with weak pairs and draws."
    ),
    confidence=Confidence.MEDIUM,
    applicable_situations=["paired_flop", "turn_pairing", "board_pairing_impact"],
    example=(
        "On AA7r, the preflop raiser's range contains all AA combinations "
        "and more A7/A9-type hands. Small bets are effective — the caller "
        "cannot comfortably continue with weak pairs fearing trips."
    ),
    related_concepts=["range_advantage", "nut_advantage"],
    hedging_language="Paired boards generally favor",
))


# ── C-Betting Theory ──────────────────────────────────────────────────────────

_reg(AcevedoConcept(
    id="cbet_theory",
    name="Continuation Betting Theory",
    chapter_theme=ChapterTheme.CBETTING_THEORY,
    description=(
        "A continuation bet (c-bet) is made by the preflop aggressor on the flop. "
        "The decision to c-bet and the sizing should be driven by: range advantage, "
        "board texture, stack-to-pot ratio, position, and hand strength. "
        "The optimal c-bet frequency and size vary significantly across board types."
    ),
    strategic_principle=(
        "On boards favoring the aggressor's range, high-frequency small c-bets "
        "are theoretically sound. On boards favoring the caller's range, "
        "reduced c-bet frequency with selective medium/large sizing is more "
        "appropriate. The key question: does the board favor value hands in "
        "the aggressor's range or the caller's range?"
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "flop_cbet_decision", "ip_aggressor_flop", "oop_aggressor_flop",
    ],
    example=(
        "BTN vs BB on K72r: BTN has strong range advantage — high-frequency "
        "small c-bet is theoretically supported. BTN vs BB on 876 two-tone: "
        "BB connects better — selective c-betting with medium sizing applies."
    ),
    related_concepts=["range_advantage", "dry_board_strategy", "wet_board_strategy"],
))

_reg(AcevedoConcept(
    id="donk_bet_theory",
    name="Donk Betting",
    chapter_theme=ChapterTheme.CBETTING_THEORY,
    description=(
        "A donk bet (or leading bet) is made by the out-of-position player into "
        "the preflop aggressor before they act. In GTO theory, donk bets are "
        "generally rare but can be used on boards where the OOP player has "
        "specific range advantages, particularly low connected boards."
    ),
    strategic_principle=(
        "Donk bets are most theoretically justified on low-connected boards "
        "where the caller's range has more two-pairs, sets, and made straights "
        "than the aggressor. On high-card dry boards, donk-betting is generally "
        "exploitable because it disrupts the natural flow without range advantage."
    ),
    confidence=Confidence.MEDIUM,
    applicable_situations=[
        "oop_caller_flop_lead", "low_connected_board_oop",
        "caller_range_advantage",
    ],
    example=(
        "BB calls BTN open. Flop: 876 two-tone. BB can consider leading (donk) "
        "with the portion of their range that makes strong two-pair and sets, "
        "as these boards connect well with BB's calling range."
    ),
    related_concepts=["range_advantage", "wet_board_strategy", "nut_advantage"],
    hedging_language="Donk betting is sometimes appropriate when",
))

_reg(AcevedoConcept(
    id="check_raise_theory",
    name="Check-Raise Theory",
    chapter_theme=ChapterTheme.CBETTING_THEORY,
    description=(
        "A check-raise is a powerful OOP tool: checking to induce a c-bet, then "
        "raising. It serves two purposes: building the pot with strong value hands "
        "and applying pressure with semi-bluffs. Check-raises require range balance "
        "— mixing value and bluffs at the correct ratio."
    ),
    strategic_principle=(
        "Check-raising is most effective when the bettor's range is wide and "
        "the check-raiser has strong value hands to protect their bluffs. "
        "The OOP player should construct a check-raising range that includes "
        "the nuts (for value) and hands with good equity and blockers (for bluffs)."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "oop_facing_cbet", "wet_board_oop", "check_raise_spot",
        "semi_bluff_draw",
    ],
    example=(
        "BB faces a BTN c-bet on T87 two-tone. BB can check-raise with sets, "
        "two-pair, and flush/straight draw combos — building a balanced "
        "check-raising range that cannot be easily exploited by folding."
    ),
    related_concepts=["bluff_value_ratio", "semi_bluff", "nut_advantage"],
))


# ── Equity and Position ───────────────────────────────────────────────────────

_reg(AcevedoConcept(
    id="equity_realization",
    name="Equity Realization",
    chapter_theme=ChapterTheme.EQUITY_REALIZATION,
    description=(
        "Equity realization measures how much of a hand's raw equity is converted "
        "into actual winnings. Position, hand playability, stack depth, and "
        "opponent tendencies all affect equity realization. OOP players realize "
        "less of their equity than IP players."
    ),
    strategic_principle=(
        "Hands that play well in multi-way pots and benefit from position "
        "(suited connectors, pocket pairs) realize more equity than hands with "
        "good raw equity but poor playability (off-suit high-card hands OOP). "
        "This justifies tighter calling ranges OOP and looser calling ranges IP."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "preflop_defense_range", "oop_calling_decision", "implied_odds_hand",
        "hand_playability_assessment",
    ],
    example=(
        "87s in the BB vs a BTN open. Despite reasonable raw equity, "
        "the suited connector's equity realization in a BB defense is reduced "
        "because you'll often be OOP in a multi-street pot."
    ),
    related_concepts=["spr_theory", "position_value", "capped_range"],
))

_reg(AcevedoConcept(
    id="position_value",
    name="Positional Advantage",
    chapter_theme=ChapterTheme.POSITION_VALUE,
    description=(
        "Acting after the opponent at every street provides enormous strategic "
        "advantages: more information before each decision, ability to control "
        "pot size, and the ability to take free cards or build the pot at will. "
        "Position is one of the most significant recurring edges in poker."
    ),
    strategic_principle=(
        "In-position players can profitably see free cards with draws, "
        "make bet/raise decisions with more information, and avoid "
        "difficult multi-street decisions OOP. The IP player generally "
        "extracts more value from the same hand strength than the OOP player."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=["all_postflop_spots", "ip_vs_oop", "bet_timing"],
    example=(
        "IP with second pair on a wet board: can check behind to realize equity "
        "with minimal risk. OOP with the same hand: must decide whether to "
        "check-call (facing a bet), check-fold, or lead — all more costly options."
    ),
    related_concepts=["equity_realization", "cbet_theory", "check_raise_theory"],
))

_reg(AcevedoConcept(
    id="semi_bluff",
    name="Semi-Bluffing",
    chapter_theme=ChapterTheme.BLUFFING_THEORY,
    description=(
        "A semi-bluff bets or raises with a hand that is currently not the best "
        "but has meaningful equity to improve. Draws (flush draws, open-ended "
        "straight draws, combo draws) are the prototypical semi-bluffs. "
        "They win in two ways: opponent folds, or the draw completes."
    ),
    strategic_principle=(
        "Semi-bluffs with strong equity (flush draws, OESD) generally benefit "
        "from aggression because they combine fold equity with high realization "
        "potential. Weaker draws (gutshots alone) require careful consideration "
        "of whether the semi-bluff generates sufficient fold equity to justify "
        "investment without certainty of improvement."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "flush_draw", "open_ended_straight_draw", "combo_draw",
        "semi_bluff_decision",
    ],
    example=(
        "With a flush draw on the flop, raising or betting as a semi-bluff "
        "is generally supported: if called, the 9 outs (roughly 35-40% equity "
        "to the river) give substantial winning potential; if folded to, "
        "you win immediately."
    ),
    related_concepts=["alpha", "equity_realization", "draw_equity"],
))

_reg(AcevedoConcept(
    id="blockers",
    name="Blocker Effects",
    chapter_theme=ChapterTheme.BLUFFING_THEORY,
    description=(
        "Holding a card that 'blocks' (removes from the deck) a key card in "
        "the opponent's range affects the probability they hold certain hands. "
        "On the river, bluffing with blockers to the nuts reduces the chance "
        "the opponent has a calling hand."
    ),
    strategic_principle=(
        "Effective bluffing and value-betting uses knowledge of blockers: "
        "holding an ace on an ace-high board blocks opponent's top pair; "
        "holding the flush card reduces the chance opponent has a flush. "
        "Blockers are most impactful on rivers with defined hand categories."
    ),
    confidence=Confidence.HIGH,
    applicable_situations=[
        "river_bluff_selection", "value_hand_assessment", "nut_blocker",
    ],
    example=(
        "River on a 4-flush board. Holding one card of the flush suit reduces "
        "the number of flush combos villain can hold. This blocker effect "
        "increases fold equity on river bluffs with that card."
    ),
    related_concepts=["alpha", "bluff_value_ratio", "polarized_range"],
))

_reg(AcevedoConcept(
    id="overbet",
    name="Overbetting Theory",
    chapter_theme=ChapterTheme.NUT_ADVANTAGE,
    description=(
        "Overbetting (betting more than the pot) is a polarized strategy used "
        "when a player has significant nut advantage. Large bets apply maximum "
        "pressure on the opponent's capped calling range while maintaining "
        "balance through pairing the bet with bluffs at the right ratio."
    ),
    strategic_principle=(
        "Overbets are justified when: (1) the bettor has more nuts than the "
        "defender, (2) the defender's range is capped, and (3) the bettor "
        "can pair the value bets with appropriate bluffs. Used incorrectly "
        "without nut advantage, overbets are simply expensive mistakes."
    ),
    confidence=Confidence.MEDIUM,
    applicable_situations=[
        "turn_overbet_spot", "river_overbet_spot", "nut_advantage_board",
        "capped_calling_range",
    ],
    example=(
        "Turn runs out an ace on K-high board where caller's range lacks "
        "many aces (they'd have 3-bet AK/AQ preflop). The bettor can "
        "overbet to exploit the caller's capped range if they hold Ax combos."
    ),
    related_concepts=["nut_advantage", "capped_range", "polarized_range"],
    hedging_language="Overbetting is theoretically sound when",
))


# ── Concept retrieval by situation ───────────────────────────────────────────

def get_concepts_for_situation(
    situations: list[str],
    max_concepts: int = 4,
) -> list[AcevedoConcept]:
    """
    Retrieve the most relevant concepts given a list of situation tags.
    Prioritizes HIGH confidence concepts and broader applicability.
    """
    scored: list[tuple[int, AcevedoConcept]] = []

    for concept in ACEVEDO_CONCEPTS.values():
        overlap = len(
            set(situations) & set(concept.applicable_situations + ["all_spots"])
        )
        if overlap == 0:
            continue
        # Confidence bonus
        conf_bonus = {"high": 3, "medium": 2, "low": 1}[concept.confidence.value]
        scored.append((overlap * conf_bonus, concept))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:max_concepts]]


def get_concept(concept_id: str) -> Optional[AcevedoConcept]:
    return ACEVEDO_CONCEPTS.get(concept_id)


def get_concepts_by_theme(theme: ChapterTheme) -> list[AcevedoConcept]:
    return [c for c in ACEVEDO_CONCEPTS.values() if c.chapter_theme == theme]


# ── Situation tag builder (from existing engine outputs) ─────────────────────

def build_situation_tags(
    board_family: str,
    pot_type: str,
    hero_is_ip: bool,
    hero_is_pfr: bool,
    has_draw: bool,
    has_flush_draw: bool,
    street: str,
    is_paired_board: bool,
    is_monotone_board: bool,
    spr_zone: str = "medium",
) -> list[str]:
    """
    Build a list of situation tags from existing engine outputs.
    These tags are used to retrieve the most relevant Acevedo concepts.
    """
    tags: list[str] = []

    # Board texture
    if "dry" in board_family.lower():
        tags += ["a_high_dry_board", "k_high_dry_board", "dry_board_spot"]
    if "wet" in board_family.lower() or "connected" in board_family.lower():
        tags += ["wet_board_spot", "wet_broadway_board", "low_connected_board"]
    if is_paired_board:
        tags.append("paired_flop")
    if is_monotone_board:
        tags.append("monotone_flop")

    # Position
    tags.append("ip_cbet_decision" if hero_is_ip else "oop_facing_cbet")
    if hero_is_pfr:
        tags += ["ip_aggressor_flop" if hero_is_ip else "oop_aggressor_flop"]
    else:
        tags += ["caller_range_assessment"]
        if not hero_is_ip:
            tags.append("oop_caller_strategy")

    # Street
    tags.append(f"{street}_decision")

    # Draws
    if has_flush_draw:
        tags += ["flush_draw", "semi_bluff_decision", "draw_equity"]
    if has_draw:
        tags += ["semi_bluff_decision", "open_ended_straight_draw"]

    # SPR
    if spr_zone in ("micro", "low"):
        tags.append("commitment_decisions")
        tags.append("3bet_pot_play")
    elif spr_zone in ("high", "deep"):
        tags.append("high_spr_nuttiness")
        tags.append("implied_odds_hand")

    # Pot type
    if "3bet" in pot_type.lower():
        tags += ["3bet_pot_commitment", "3bet_pot_play"]
    elif "4bet" in pot_type.lower():
        tags += ["4bet_pot_flop", "commitment_decisions"]

    # All spots always
    tags.append("all_spots")

    return list(dict.fromkeys(tags))  # deduplicate
