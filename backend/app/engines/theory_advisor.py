"""
Theory Advisor — Grounded Strategic Analysis Engine
====================================================

Replaces speculative heuristic output with theory-grounded, confidence-aware
strategic advice derived from Modern Poker Theory (Acevedo) concepts.

DESIGN RULES:
  - NEVER output fake frequencies (e.g. "37%", "65-75%")
  - NEVER claim solver output unless explicitly computed
  - ALWAYS attach confidence levels to strategic claims
  - ALWAYS hedge low/medium confidence claims with appropriate language
  - Advice must be STRATEGICALLY DEFENSIBLE and MATHEMATICALLY COHERENT

This module produces TheoryAnalysis — the structured 7-section advice format.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from app.engines.theory.acevedo_knowledge import (
    AcevedoConcept,
    Confidence,
    build_situation_tags,
    get_concepts_for_situation,
    get_concept,
)


# ── Output types ──────────────────────────────────────────────────────────────

@dataclass
class StrategicOption:
    """
    A theory-grounded strategic alternative — NOT a solver frequency.

    priority: 1 = theory primarily supports, 2 = secondary option, 3 = alternative
    confidence: how strongly theory supports this as correct
    reasoning: WHY theory supports this option (no fake numbers)
    """
    action: str
    priority: int            # 1=primary, 2=secondary, 3=alternative
    confidence: Confidence
    reasoning: str


@dataclass
class TheoryAnalysis:
    """
    The 7-section structured advice output.
    Every field uses appropriately hedged language tied to confidence level.
    """
    # Section 1: What is happening strategically in this hand
    strategic_overview: str

    # Section 2: How the two ranges interact with the board
    range_interaction: str

    # Section 3: IP/OOP implications
    positional_dynamics: str

    # Section 4: The GTO principle — hedged by confidence
    likely_gto_principle: str

    # Section 5: Common mistakes in this spot type
    common_mistake_risks: list[str]

    # Section 6: Acevedo chapter references — concept names/themes, NOT page numbers
    book_concept_refs: list[str]

    # Section 7: Concrete single-action takeaway
    action_takeaway: str

    # Meta
    confidence_level: Confidence
    confidence_caveats: list[str]          # why we are not fully confident
    strategic_options: list[StrategicOption]  # alternatives — NO fake frequencies
    theory_tags: list[str]                 # for filtering/categorization
    matched_concepts: list[AcevedoConcept] # book concepts matched


# ── Main advisor function ─────────────────────────────────────────────────────

def build_theory_analysis(
    # From existing engines
    spot_pot_type: str,           # "SRP", "3bet", "4bet"
    hero_is_ip: bool,
    hero_is_pfr: bool,
    board_family: str,            # from board_theory.BoardFamily
    board_description: str,
    board_range_advantage: str,   # "pfr", "caller", "neutral"
    board_wetness: str,           # "dry", "semi_wet", "wet"
    board_suitedness: str,        # "rainbow", "two_tone", "monotone"
    board_is_paired: bool,
    spr_value: float,
    spr_zone: str,                # from spr_theory.SPRZone
    street: str,
    hero_position: str,
    opp_position: str,
    stack_depth: str,             # "short", "medium", "deep"
    # Optional
    has_draw: bool = False,
    has_flush_draw: bool = False,
    is_combo_draw: bool = False,
    hero_hand_category: int = 0,  # 0=air, 1=pair, 2=two_pair, 3=trips, etc.
    hero_cards: Optional[list[str]] = None,
    equity_bucket: Optional[str] = None,
    last_hero_action: Optional[str] = None,
    node_concept: Optional[str] = None,
    bet_fraction: Optional[float] = None,
    is_tournament: bool = False,
) -> TheoryAnalysis:
    """
    Build a grounded, confidence-aware theory analysis.
    No fake frequencies. No solver claims. Theory-defensible only.
    """
    hero_role = "preflop aggressor" if hero_is_pfr else "preflop caller"
    position_str = "in position (IP)" if hero_is_ip else "out of position (OOP)"
    opp_role = "preflop caller" if hero_is_pfr else "preflop aggressor"

    is_monotone = board_suitedness == "monotone"
    is_dry = board_wetness == "dry"
    is_wet = board_wetness == "wet"

    # ── Build situation tags for concept retrieval ────────────────────────────
    situation_tags = build_situation_tags(
        board_family=board_family,
        pot_type=spot_pot_type,
        hero_is_ip=hero_is_ip,
        hero_is_pfr=hero_is_pfr,
        has_draw=has_draw,
        has_flush_draw=has_flush_draw,
        street=street,
        is_paired_board=board_is_paired,
        is_monotone_board=is_monotone,
        spr_zone=spr_zone,
    )

    # ── Retrieve matched Acevedo concepts ────────────────────────────────────
    matched = get_concepts_for_situation(situation_tags, max_concepts=4)
    theory_tags = situation_tags[:8]

    # ── Compute overall confidence ────────────────────────────────────────────
    confidence, caveats = _assess_confidence(
        hero_is_ip=hero_is_ip,
        hero_is_pfr=hero_is_pfr,
        board_family=board_family,
        spr_zone=spr_zone,
        spot_pot_type=spot_pot_type,
        has_draw=has_draw,
        is_monotone=is_monotone,
        hero_hand_category=hero_hand_category,
    )

    # ── Section 1: Strategic Overview ────────────────────────────────────────
    strategic_overview = _build_strategic_overview(
        pot_type=spot_pot_type,
        hero_role=hero_role,
        position_str=position_str,
        hero_position=hero_position,
        opp_position=opp_position,
        spr_value=spr_value,
        spr_zone=spr_zone,
        board_description=board_description,
        stack_depth=stack_depth,
        is_tournament=is_tournament,
    )

    # ── Section 2: Range Interaction ────────────────────────────────────────
    range_interaction = _build_range_interaction(
        hero_is_pfr=hero_is_pfr,
        board_family=board_family,
        board_range_advantage=board_range_advantage,
        is_dry=is_dry,
        is_wet=is_wet,
        is_monotone=is_monotone,
        board_is_paired=board_is_paired,
        hero_position=hero_position,
        opp_position=opp_position,
        spot_pot_type=spot_pot_type,
    )

    # ── Section 3: Positional Dynamics ──────────────────────────────────────
    positional_dynamics = _build_positional_dynamics(
        hero_is_ip=hero_is_ip,
        hero_is_pfr=hero_is_pfr,
        street=street,
        board_wetness=board_wetness,
    )

    # ── Section 4: GTO Principle (hedged) ───────────────────────────────────
    likely_gto_principle = _build_gto_principle(
        board_family=board_family,
        hero_is_pfr=hero_is_pfr,
        hero_is_ip=hero_is_ip,
        board_range_advantage=board_range_advantage,
        spr_zone=spr_zone,
        spr_value=spr_value,
        has_draw=has_draw,
        has_flush_draw=has_flush_draw,
        is_combo_draw=is_combo_draw,
        bet_fraction=bet_fraction,
        confidence=confidence,
        matched_concepts=matched,
    )

    # ── Section 5: Common Mistake Risks ──────────────────────────────────────
    common_mistakes = _build_common_mistakes(
        hero_is_pfr=hero_is_pfr,
        hero_is_ip=hero_is_ip,
        board_family=board_family,
        board_range_advantage=board_range_advantage,
        spr_zone=spr_zone,
        has_draw=has_draw,
        spot_pot_type=spot_pot_type,
    )

    # ── Section 6: Book Concept References ───────────────────────────────────
    book_refs = [
        f"{c.name} ({c.chapter_theme.value})"
        for c in matched
    ]

    # ── Section 7: Action Takeaway ───────────────────────────────────────────
    action_takeaway = _build_action_takeaway(
        hero_is_pfr=hero_is_pfr,
        hero_is_ip=hero_is_ip,
        board_family=board_family,
        board_range_advantage=board_range_advantage,
        spr_zone=spr_zone,
        last_hero_action=last_hero_action,
        confidence=confidence,
    )

    # ── Strategic Options (no fake frequencies) ──────────────────────────────
    strategic_options = _build_strategic_options(
        hero_is_pfr=hero_is_pfr,
        hero_is_ip=hero_is_ip,
        board_family=board_family,
        board_range_advantage=board_range_advantage,
        spr_zone=spr_zone,
        spr_value=spr_value,
        has_draw=has_draw,
        hero_hand_category=hero_hand_category,
        bet_fraction=bet_fraction,
        street=street,
        last_hero_action=last_hero_action,
    )

    return TheoryAnalysis(
        strategic_overview=strategic_overview,
        range_interaction=range_interaction,
        positional_dynamics=positional_dynamics,
        likely_gto_principle=likely_gto_principle,
        common_mistake_risks=common_mistakes,
        book_concept_refs=book_refs,
        action_takeaway=action_takeaway,
        confidence_level=confidence,
        confidence_caveats=caveats,
        strategic_options=strategic_options,
        theory_tags=theory_tags,
        matched_concepts=matched,
    )


# ── Section builders ──────────────────────────────────────────────────────────

def _build_strategic_overview(
    pot_type: str, hero_role: str, position_str: str,
    hero_position: str, opp_position: str, spr_value: float, spr_zone: str,
    board_description: str, stack_depth: str, is_tournament: bool,
) -> str:
    pot_label = {
        "SRP": "single-raised pot",
        "3bet": "3-bet pot",
        "4bet": "4-bet pot",
    }.get(pot_type, pot_type.lower() + " pot")

    spr_description = {
        "micro": "very low SPR — near commitment",
        "low": "low SPR — shallow postflop play",
        "medium": "medium SPR — standard postflop depth",
        "high": "high SPR — deep postflop play with implied odds",
        "deep": "very deep SPR — complex multi-street planning",
    }.get(spr_zone, f"SPR {spr_value:.1f}")

    tournament_note = " Tournament ICM considerations apply." if is_tournament else ""

    return (
        f"{hero_position} ({hero_role}) vs {opp_position} in a {pot_label}. "
        f"Hero is {position_str}. "
        f"Effective SPR ≈ {spr_value:.1f} ({spr_description}).{tournament_note} "
        f"Board: {board_description}."
    )


def _build_range_interaction(
    hero_is_pfr: bool, board_family: str, board_range_advantage: str,
    is_dry: bool, is_wet: bool, is_monotone: bool, board_is_paired: bool,
    hero_position: str, opp_position: str, spot_pot_type: str,
) -> str:
    adv_holder = "the preflop aggressor" if board_range_advantage == "pfr" else \
                 "the preflop caller" if board_range_advantage == "caller" else \
                 "neither player significantly"

    hero_adv = board_range_advantage == "pfr" and hero_is_pfr or \
               board_range_advantage == "caller" and not hero_is_pfr

    if is_dry:
        texture_note = (
            "On this dry, disconnected board, few drawing combinations exist for either player. "
            "Range advantage is primarily determined by who holds more top-pair and over-pair combinations."
        )
    elif is_wet:
        texture_note = (
            "This connected, draw-heavy board reduces the range advantage gap. "
            "The calling range typically contains more two-pair and straight draw combinations "
            "on these low-to-mid connected boards."
        )
    elif is_monotone:
        texture_note = (
            "This monotone board significantly shifts equity toward whoever holds flush combinations. "
            "Both ranges are re-evaluated by flush draw ownership."
        )
    elif board_is_paired:
        texture_note = (
            "Paired boards reduce drawing equity for both ranges. "
            "Full-house and trips combinations become key differentiators."
        )
    else:
        texture_note = (
            "Board texture moderately affects range distributions. "
            "Both players maintain playable ranges."
        )

    adv_statement = (
        f"Range advantage on this board lies with {adv_holder}. "
        f"{'Hero holds this advantage.' if hero_adv else 'Hero does not hold range advantage here.'}"
    )

    return f"{texture_note} {adv_statement}"


def _build_positional_dynamics(
    hero_is_ip: bool, hero_is_pfr: bool, street: str, board_wetness: str,
) -> str:
    if hero_is_ip:
        base = (
            "Hero acts last on every postflop street, providing the significant positional advantage "
            "of seeing opponent's action before deciding. This allows pot control with marginal hands "
            "and value extraction with strong hands."
        )
        if not hero_is_pfr:
            base += (
                " As the in-position caller, hero can profitably take free cards "
                "with draws and control pot size with medium-strength holdings."
            )
    else:
        base = (
            "Hero acts first on every postflop street, which is a structural disadvantage. "
            "Out-of-position decisions require more caution with marginal holdings and "
            "more deliberate range construction for bets and raises."
        )
        if board_wetness == "wet":
            base += (
                " On this wet board OOP, check-raising with strong hands and semi-bluffs "
                "is a key tool to deny free cards and build the pot on hero's terms."
            )

    return base


def _build_gto_principle(
    board_family: str, hero_is_pfr: bool, hero_is_ip: bool,
    board_range_advantage: str, spr_zone: str, spr_value: float,
    has_draw: bool, has_flush_draw: bool, is_combo_draw: bool,
    bet_fraction: Optional[float], confidence: Confidence,
    matched_concepts: list[AcevedoConcept],
) -> str:
    # Hedge based on confidence
    hedge = {
        Confidence.HIGH:   "Theory strongly supports",
        Confidence.MEDIUM: "Theory generally suggests",
        Confidence.LOW:    "In this situation, theory tentatively indicates",
    }[confidence]

    has_range_advantage = (
        board_range_advantage == "pfr" and hero_is_pfr or
        board_range_advantage == "caller" and not hero_is_pfr
    )

    if matched_concepts:
        primary_concept = matched_concepts[0]
        concept_name = primary_concept.name
        principle_excerpt = primary_concept.strategic_principle[:300]
        return (
            f"{hedge} the key principle here is {concept_name}. "
            f"{principle_excerpt}"
        )

    # Fallback based on basic features
    if has_range_advantage and hero_is_pfr and is_dry_board(board_family):
        return (
            f"{hedge} a high-frequency, small-bet approach on this texture. "
            "Range advantage allows frequent pressure with a merged range — "
            "the opponent's capped range cannot effectively raise."
        )
    elif has_draw and has_flush_draw:
        return (
            f"{hedge} semi-bluffing with flush draws. "
            "A flush draw provides meaningful equity to improve, "
            "allowing aggressive lines to generate fold equity alongside draw equity."
        )
    elif spr_zone in ("micro", "low"):
        return (
            f"{hedge} simplified, commitment-oriented play at low SPR. "
            "With limited stack depth relative to the pot, "
            "strong made hands should generally commit toward all-in."
        )
    else:
        return (
            f"{hedge} strategy should be guided by range advantage, SPR, and position. "
            "Without a dominant range advantage, balanced play with appropriate "
            "bet frequencies and sizing is the sound approach."
        )


def _build_common_mistakes(
    hero_is_pfr: bool, hero_is_ip: bool, board_family: str,
    board_range_advantage: str, spr_zone: str, has_draw: bool, spot_pot_type: str,
) -> list[str]:
    mistakes = []
    is_dry = is_dry_board(board_family)
    is_wet = is_wet_board(board_family)
    has_adv = board_range_advantage == "pfr" and hero_is_pfr or \
              board_range_advantage == "caller" and not hero_is_pfr

    if hero_is_pfr and is_dry and hero_is_ip:
        mistakes.append(
            "Oversizing on dry boards: large bets are less necessary when the caller's "
            "range is capped. Small, frequent bets are typically more efficient."
        )
    if hero_is_pfr and is_wet:
        mistakes.append(
            "Continuation betting too frequently on wet boards where the caller's "
            "range connects well. Selective c-bets are more appropriate here."
        )
    if not hero_is_ip and hero_is_pfr:
        mistakes.append(
            "OOP c-betting at high frequency is generally exploitable. "
            "Check-calling and check-raising with the appropriate frequency "
            "is more balanced than leading into the opponent."
        )
    if not has_adv and hero_is_pfr:
        mistakes.append(
            "Assuming range advantage exists when the board structure favors "
            "the caller's range. Defaulting to c-betting on unfavorable textures "
            "without adjusting frequency downward is a common leak."
        )
    if has_draw and not hero_is_ip:
        mistakes.append(
            "Playing draws passively OOP — check-calling every street rather than "
            "using check-raises to build the pot and generate fold equity with draws."
        )
    if spr_zone in ("micro", "low") and spot_pot_type == "3bet":
        mistakes.append(
            "Over-complicating decisions in low-SPR 3-bet pots. "
            "At low SPR, most top-pair hands should take straightforward commitment lines."
        )

    # Always include a general reminder
    if not mistakes:
        mistakes.append(
            "The primary risk in any spot is deviation from range-balanced frequencies — "
            "betting too often or too rarely in ways that expose your range to exploitation."
        )

    return mistakes[:3]  # Cap at 3 for readability


def _build_action_takeaway(
    hero_is_pfr: bool, hero_is_ip: bool, board_family: str,
    board_range_advantage: str, spr_zone: str,
    last_hero_action: Optional[str], confidence: Confidence,
) -> str:
    has_adv = board_range_advantage == "pfr" and hero_is_pfr or \
              board_range_advantage == "caller" and not hero_is_pfr

    if confidence == Confidence.LOW:
        return (
            "This spot requires careful consideration of the specific range dynamics. "
            "When in doubt, lean on position and SPR to guide the decision — "
            "avoid overcommitting without clear range or nut advantage."
        )

    is_dry = is_dry_board(board_family)
    is_wet = is_wet_board(board_family)

    if hero_is_pfr and hero_is_ip and has_adv and is_dry:
        return (
            "Range advantage on this dry board supports a continued betting strategy. "
            "Prefer smaller sizing to maximize frequency — the board structure "
            "does not require large bets to protect or extract value."
        )
    elif hero_is_pfr and not hero_is_ip and not has_adv and is_wet:
        return (
            "On this board with reduced range advantage OOP, selective continuation "
            "is key. Prioritize check-calling strong hands and check-raising with "
            "the strongest value and semi-bluff combinations."
        )
    elif not hero_is_pfr and hero_is_ip:
        return (
            "As the in-position caller, take advantage of positional equity realization. "
            "Check behind with medium-strength hands for pot control; "
            "build the pot when strong made hands allow you to call raises comfortably."
        )
    else:
        return (
            "Maintain balanced range construction on this texture. "
            "Let range advantage and position guide your frequency; "
            "let hand strength and SPR guide your sizing."
        )


def _build_strategic_options(
    hero_is_pfr: bool, hero_is_ip: bool, board_family: str,
    board_range_advantage: str, spr_zone: str, spr_value: float,
    has_draw: bool, hero_hand_category: int, bet_fraction: Optional[float],
    street: str, last_hero_action: Optional[str],
) -> list[StrategicOption]:
    """
    Build strategic options with priority and confidence — NO fake frequencies.
    """
    options: list[StrategicOption] = []
    is_dry = is_dry_board(board_family)
    is_wet = is_wet_board(board_family)
    has_adv = board_range_advantage == "pfr" and hero_is_pfr or \
              board_range_advantage == "caller" and not hero_is_pfr

    is_strong_hand = hero_hand_category >= 2  # two pair or better
    is_pair = hero_hand_category == 1

    if street == "flop":
        if hero_is_pfr and hero_is_ip:
            if has_adv and is_dry:
                options.append(StrategicOption(
                    action="Small bet (~25-33% pot)",
                    priority=1,
                    confidence=Confidence.HIGH,
                    reasoning=(
                        "Range advantage on dry boards supports high-frequency small bets. "
                        "The capped calling range cannot effectively raise, "
                        "making small size efficient."
                    ),
                ))
                options.append(StrategicOption(
                    action="Check",
                    priority=2,
                    confidence=Confidence.MEDIUM,
                    reasoning=(
                        "Checking back with medium-strength hands protects your checking range "
                        "and prevents over-betting when you don't need protection."
                    ),
                ))
            elif is_wet:
                options.append(StrategicOption(
                    action="Check",
                    priority=1,
                    confidence=Confidence.MEDIUM,
                    reasoning=(
                        "On wet boards where range advantage is reduced, "
                        "checking to protect your range and control pot size "
                        "is often more sound than c-betting widely."
                    ),
                ))
                options.append(StrategicOption(
                    action="Medium bet (~40-50% pot)",
                    priority=2,
                    confidence=Confidence.MEDIUM,
                    reasoning=(
                        "A medium-sized selective c-bet on wet boards charges draws "
                        "while not over-investing with vulnerable hands."
                    ),
                ))
            else:
                options.append(StrategicOption(
                    action="Small bet (~33% pot)",
                    priority=1,
                    confidence=Confidence.MEDIUM,
                    reasoning="Balanced small bet maintains pressure while managing pot size.",
                ))
                options.append(StrategicOption(
                    action="Check",
                    priority=2,
                    confidence=Confidence.MEDIUM,
                    reasoning="Checking maintains range balance across strong and weak holdings.",
                ))

        elif not hero_is_pfr and not hero_is_ip:  # OOP caller
            options.append(StrategicOption(
                action="Check",
                priority=1,
                confidence=Confidence.HIGH,
                reasoning=(
                    "OOP callers generally check at high frequency, "
                    "allowing the preflop aggressor to continue with their range."
                ),
            ))
            if has_adv:
                options.append(StrategicOption(
                    action="Lead (donk bet ~40-50% pot)",
                    priority=2,
                    confidence=Confidence.LOW,
                    reasoning=(
                        "If range advantage favors the caller on this board, "
                        "a selective lead can be appropriate — though this is "
                        "situational and easily over-applied."
                    ),
                ))

    elif street in ("turn", "river"):
        if is_strong_hand:
            options.append(StrategicOption(
                action="Value bet (sizing based on opponent's calling range)",
                priority=1,
                confidence=Confidence.HIGH,
                reasoning=(
                    "Strong made hands generally benefit from continued aggression "
                    "to extract value from weaker holdings that call."
                ),
            ))
        elif is_pair:
            options.append(StrategicOption(
                action="Bet for thin value or pot control",
                priority=1,
                confidence=Confidence.MEDIUM,
                reasoning=(
                    "Medium-strength hands face a bet/check decision based on "
                    "whether value is available against weaker hands that call."
                ),
            ))
        if has_draw and street == "turn":
            options.append(StrategicOption(
                action="Semi-bluff or check for pot control",
                priority=1,
                confidence=Confidence.MEDIUM,
                reasoning=(
                    "Draws on the turn have meaningful equity to improve. "
                    "Aggressive semi-bluffing or controlled check-calling "
                    "both have merit depending on equity and fold equity."
                ),
            ))

    return options[:3]  # Maximum 3 options for clarity


# ── Confidence assessment ─────────────────────────────────────────────────────

def _assess_confidence(
    hero_is_ip: bool, hero_is_pfr: bool, board_family: str,
    spr_zone: str, spot_pot_type: str, has_draw: bool,
    is_monotone: bool, hero_hand_category: int,
) -> tuple[Confidence, list[str]]:
    """Assess overall confidence and reasons for any reduction."""
    caveats = []

    if is_monotone:
        caveats.append(
            "Monotone boards have complex equity distributions that require "
            "knowing the specific flush combos in both ranges."
        )
    if spot_pot_type in ("3bet", "4bet") and spr_zone in ("high", "deep"):
        caveats.append(
            "High-SPR 3/4-bet pots have complex range interactions "
            "that vary significantly by specific position matchup."
        )
    if has_draw and not hero_is_pfr and not hero_is_ip:
        caveats.append(
            "OOP caller draw spots require precise understanding of "
            "the betting range's composition to determine optimal play."
        )

    if not caveats:
        # Clear scenario — high confidence
        return Confidence.HIGH, []
    elif len(caveats) == 1:
        return Confidence.MEDIUM, caveats
    else:
        return Confidence.LOW, caveats


# ── Board family helpers ──────────────────────────────────────────────────────

def is_dry_board(board_family: str) -> bool:
    return "dry" in board_family.lower()


def is_wet_board(board_family: str) -> bool:
    return any(x in board_family.lower() for x in ("wet", "connected", "low"))
