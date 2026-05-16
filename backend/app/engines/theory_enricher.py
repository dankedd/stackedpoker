"""
Theory Enricher
================
Integrates the theory layer into the existing analysis pipeline.

This module takes the outputs of the existing engines (PokerState,
BoardTexture, SpotClassification, DrawAnalysis) and enriches them
with structured theory context from the theory layer.

The enriched context is then injected into:
  - AI coaching prompts (openai_coach.py)
  - Heuristic findings (more precise explanations)
  - Replay coaching (per-action context)
  - Puzzle tagging (auto-tag puzzles with theory concepts)

Design principle: this layer ADDS context on top of existing engines;
it does NOT replace them. All existing validation and analysis still runs.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from app.engines.theory.mdf_alpha import (
    alpha, mdf, bluff_value_ratio, required_fold_equity, ALPHA_TABLE,
    BACKDOOR_FLUSH_EQUITY,
)
from app.engines.theory.equity_buckets import (
    classify_equity_bucket, EquityBucket, EQB_STRATEGY_NOTES,
)
from app.engines.theory.spr_theory import (
    classify_spr, spr_hand_guidelines, compute_spr, SPRZone, commitment_threshold_met,
)
from app.engines.theory.range_theory import RangeMorphology
from app.engines.theory.node_library import get_node, PokerNode
from app.engines.theory.board_theory import (
    classify_board_family, get_board_profile, donk_bet_frequency_class,
    BoardFamily, DonkBetFrequencyClass,
)
from app.engines.theory.betting_theory import (
    classify_bet_size, optimal_bet_size_for_spr, BetSizingStrategy,
)
from app.engines.theory.concepts import (
    get_concept, get_concepts_by_tag, ConceptTag, CONCEPT_REGISTRY,
)


@dataclass
class TheoryContext:
    """
    Complete theory context for an analysis — injected into coaching and UI.
    """
    # Board
    board_family: Optional[BoardFamily]
    board_family_label: str
    board_keyconcept: str
    ip_cbet_guidance: str
    oop_donk_guidance: str
    donk_frequency_class: str

    # Node
    detected_node: Optional[PokerNode]
    node_key_concept: str
    ip_range_description: str
    oop_range_description: str

    # SPR
    spr_value: float
    spr_zone: SPRZone
    spr_key_concept: str
    commitment_assessment: str

    # Bet sizing (for current hero action)
    bet_fraction: Optional[float]
    bet_size_category: str
    alpha_value: Optional[float]
    mdf_value: Optional[float]
    bluff_value_label: str
    bet_sizing_assessment: str

    # Equity bucket
    equity_bucket: Optional[EquityBucket]
    equity_bucket_action: str

    # Relevant concepts for coaching
    relevant_concepts: list[str]   # concept IDs
    theory_tags: list[str]         # coaching/puzzle tags

    # Warnings
    warnings: list[str]


def enrich_with_theory(
    spot_classification,    # SpotClassification
    board_texture,          # BoardTexture
    poker_state,            # PokerState | None
    parsed_hand,            # ParsedHand
) -> TheoryContext:
    """
    Build a complete TheoryContext from existing engine outputs.

    Args:
        spot_classification: From spot_classifier.py
        board_texture:       From board_texture.py
        poker_state:         From poker_state.py (may be None)
        parsed_hand:         ParsedHand from parser

    Returns:
        TheoryContext with all theory-enriched information
    """
    warnings: list[str] = []

    # ── 1. Board Theory ───────────────────────────────────────────────────
    board_family = _map_board_family(board_texture)
    board_profile = get_board_profile(board_family) if board_family else None

    board_keyconcept = board_profile.key_concept if board_profile else ""
    ip_cbet_guidance = (
        f"C-bet frequency: {board_profile.ip_cbet_frequency}; "
        f"Size: {board_profile.ip_cbet_size}"
        if board_profile else "C-bet guidance unavailable"
    )
    oop_donk_guidance = board_profile.oop_donk_rationale if board_profile else ""
    donk_freq = donk_bet_frequency_class(board_family) if board_family else None
    donk_frequency_class = donk_freq.value if donk_freq else "unknown"

    # ── 2. Node Detection ─────────────────────────────────────────────────
    detected_node = _detect_node(spot_classification)
    node_key_concept = detected_node.key_concept if detected_node else ""
    ip_range_desc = detected_node.ip_range.description if detected_node else ""
    oop_range_desc = detected_node.oop_range.description if detected_node else ""

    # ── 3. SPR Theory ─────────────────────────────────────────────────────
    spr_value = _compute_spr(parsed_hand, poker_state)
    spr_zone = classify_spr(spr_value)
    spr_guidelines = spr_hand_guidelines(spr_value)

    # Commitment assessment
    hand_cat = _get_hand_category(poker_state)
    committed = commitment_threshold_met(hand_cat, spr_value)
    commitment_assessment = (
        f"With {hand_cat.replace('_', ' ')} at SPR {spr_value:.1f} ({spr_zone.value}): "
        + ("commitment is justified." if committed else "stack commitment is NOT justified — proceed with caution.")
    )

    # ── 4. Bet Sizing Analysis ────────────────────────────────────────────
    hero_bet_action = _get_hero_current_bet(parsed_hand)
    bet_fraction: Optional[float] = None
    alpha_value: Optional[float] = None
    mdf_value: Optional[float] = None
    bluff_value_label = "N/A"
    bet_size_category = "no_bet"
    bet_sizing_assessment = ""

    if hero_bet_action and hero_bet_action.size_bb:
        pot_at_action = _estimate_pot(parsed_hand, hero_bet_action.street)
        if pot_at_action > 0:
            bet_fraction = hero_bet_action.size_bb / pot_at_action
            alpha_value = round(alpha(hero_bet_action.size_bb, pot_at_action), 3)
            mdf_value = round(mdf(hero_bet_action.size_bb, pot_at_action), 3)
            bluff_frac, val_frac = bluff_value_ratio(hero_bet_action.size_bb, pot_at_action)
            bet_size_category = classify_bet_size(bet_fraction)
            # bluff:value ratio
            if val_frac > 0:
                ratio = bluff_frac / val_frac
                if ratio <= 0.4:
                    bluff_value_label = "1 bluff : 2+ value (tight)"
                elif ratio <= 0.6:
                    bluff_value_label = "1 bluff : 2 value (balanced)"
                elif ratio <= 1.1:
                    bluff_value_label = "1 bluff : 1 value (equal)"
                else:
                    bluff_value_label = "2+ bluffs : 1 value (bluff-heavy)"

            # Bet sizing vs recommended for this SPR
            recommended = optimal_bet_size_for_spr(spr_value)
            diff = abs(bet_fraction - recommended.size_fraction)
            if diff > 0.30:
                if bet_fraction > recommended.size_fraction:
                    bet_sizing_assessment = (
                        f"Sizing ({bet_fraction:.0%}) is larger than recommended "
                        f"({recommended.size_fraction:.0%}) for SPR {spr_value:.1f}. "
                        f"Theory suggests {recommended.size_label} at this SPR."
                    )
                    warnings.append(f"Oversized bet vs SPR recommendation ({recommended.size_label})")
                else:
                    bet_sizing_assessment = (
                        f"Sizing ({bet_fraction:.0%}) is smaller than recommended "
                        f"({recommended.size_fraction:.0%}) for this SPR. "
                        f"Theory suggests {recommended.size_label}."
                    )
            else:
                bet_sizing_assessment = f"Sizing ({bet_fraction:.0%}) is within theory range for SPR {spr_value:.1f}."

    # ── 5. Equity Bucket ─────────────────────────────────────────────────
    equity_bucket: Optional[EquityBucket] = None
    equity_bucket_action = ""
    if poker_state is not None:
        eq = _estimate_equity(poker_state)
        if eq is not None:
            equity_bucket = classify_equity_bucket(eq)
            notes = EQB_STRATEGY_NOTES.get(equity_bucket, {})
            equity_bucket_action = notes.get("rationale", "")

    # ── 6. Relevant Concepts ─────────────────────────────────────────────
    relevant_concepts = _select_relevant_concepts(
        board_family, spr_zone, equity_bucket, spot_classification,
        bet_fraction, donk_freq,
    )

    # ── 7. Theory Tags ────────────────────────────────────────────────────
    theory_tags = _build_theory_tags(
        board_family, spr_zone, equity_bucket, spot_classification,
        bet_fraction, donk_freq, board_profile,
    )

    return TheoryContext(
        board_family=board_family,
        board_family_label=board_family.value if board_family else "unknown",
        board_keyconcept=board_keyconcept,
        ip_cbet_guidance=ip_cbet_guidance,
        oop_donk_guidance=oop_donk_guidance,
        donk_frequency_class=donk_frequency_class,
        detected_node=detected_node,
        node_key_concept=node_key_concept,
        ip_range_description=ip_range_desc,
        oop_range_description=oop_range_desc,
        spr_value=spr_value,
        spr_zone=spr_zone,
        spr_key_concept=spr_guidelines.key_concept,
        commitment_assessment=commitment_assessment,
        bet_fraction=bet_fraction,
        bet_size_category=bet_size_category,
        alpha_value=alpha_value,
        mdf_value=mdf_value,
        bluff_value_label=bluff_value_label,
        bet_sizing_assessment=bet_sizing_assessment,
        equity_bucket=equity_bucket,
        equity_bucket_action=equity_bucket_action,
        relevant_concepts=relevant_concepts,
        theory_tags=theory_tags,
        warnings=warnings,
    )


def build_theory_coaching_block(ctx: TheoryContext) -> str:
    """
    Build a structured theory block for injection into the AI coaching prompt.

    This replaces vague heuristic phrases with precise theory-grounded language.
    """
    lines = []

    # Board theory
    if ctx.board_family:
        lines.append(f"Board Family: {ctx.board_family.value}")
        lines.append(f"Board Theory: {ctx.board_keyconcept[:300]}")
        lines.append(f"IP C-Bet Guidance: {ctx.ip_cbet_guidance}")
        if ctx.donk_frequency_class in ("mid", "high"):
            lines.append(f"OOP Donk Bet: {ctx.oop_donk_guidance[:200]}")

    # Node
    if ctx.detected_node:
        lines.append(f"Node: {ctx.detected_node.label}")
        lines.append(f"Node Concept: {ctx.node_key_concept[:300]}")
        lines.append(f"IP Range: {ctx.ip_range_description[:200]}")
        lines.append(f"OOP Range: {ctx.oop_range_description[:200]}")

    # SPR
    lines.append(f"SPR: {ctx.spr_value:.1f} ({ctx.spr_zone.value} zone)")
    lines.append(f"SPR Theory: {ctx.spr_key_concept[:250]}")
    lines.append(f"Commitment: {ctx.commitment_assessment}")

    # Bet sizing
    if ctx.bet_fraction is not None:
        lines.append(f"Bet Size Category: {ctx.bet_size_category} ({ctx.bet_fraction:.0%} pot)")
        lines.append(f"Alpha: {ctx.alpha_value:.3f} (bluff needs {ctx.alpha_value:.0%} folds to break even)")
        lines.append(f"MDF: {ctx.mdf_value:.3f} (villain must defend {ctx.mdf_value:.0%})")
        lines.append(f"Bluff:Value Balance: {ctx.bluff_value_label}")
        if ctx.bet_sizing_assessment:
            lines.append(f"Sizing Assessment: {ctx.bet_sizing_assessment}")

    # Equity bucket
    if ctx.equity_bucket:
        lines.append(f"Equity Bucket: {ctx.equity_bucket.value}")
        if ctx.equity_bucket_action:
            lines.append(f"EQB Strategy: {ctx.equity_bucket_action[:200]}")

    # Warnings
    if ctx.warnings:
        lines.append("Theory Warnings: " + "; ".join(ctx.warnings))

    return "\n".join(lines)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _map_board_family(texture) -> Optional[BoardFamily]:
    """Map BoardTexture to BoardFamily using board_theory classification."""
    try:
        high_card = texture.high_card_rank if hasattr(texture, "high_card_rank") else "T"
        connectivity = texture.connectivity if hasattr(texture, "connectivity") else "disconnected"
        suitedness = texture.suitedness if hasattr(texture, "suitedness") else "rainbow"
        is_paired = texture.is_paired if hasattr(texture, "is_paired") else False
        return classify_board_family(high_card, connectivity, suitedness, is_paired)
    except Exception:
        return None


def _detect_node(spot) -> Optional[PokerNode]:
    """Detect canonical node from SpotClassification."""
    try:
        ip_pos = spot.ip_player if hasattr(spot, "ip_player") else "BTN"
        oop_pos = spot.oop_player if hasattr(spot, "oop_player") else "BB"
        pot_type = spot.pot_type.lower() if hasattr(spot, "pot_type") else "srp"
        depth = spot.stack_depth if hasattr(spot, "stack_depth") else "deep"
        return get_node(ip_pos, oop_pos, pot_type, depth)
    except Exception:
        return None


def _compute_spr(parsed_hand, poker_state) -> float:
    """Compute SPR from available data."""
    try:
        if poker_state and hasattr(poker_state, "spr") and poker_state.spr:
            return float(poker_state.spr)
        # Fallback: estimate from hand
        stack = parsed_hand.effective_stack_bb if parsed_hand else 50.0
        pot = parsed_hand.pot_size_bb if parsed_hand else 5.0
        return compute_spr(stack, pot)
    except Exception:
        return 8.0  # default to medium SPR


def _get_hand_category(poker_state) -> str:
    """Get hand category string from PokerState."""
    try:
        if poker_state and hasattr(poker_state, "hand_strength") and poker_state.hand_strength:
            cat = poker_state.hand_strength.relative_strength
            if cat:
                return str(cat)
        return "unknown"
    except Exception:
        return "unknown"


def _estimate_equity(poker_state) -> Optional[float]:
    """Estimate hero's equity from PokerState."""
    try:
        if poker_state and hasattr(poker_state, "hand_strength") and poker_state.hand_strength:
            eq = poker_state.hand_strength.equity_estimate
            if eq is not None:
                return float(eq)
        return None
    except Exception:
        return None


def _get_hero_current_bet(parsed_hand) -> Optional[object]:
    """Get the most recent hero bet/raise action."""
    try:
        hero_bets = [
            a for a in parsed_hand.actions
            if a.is_hero and a.action in ("bet", "raise") and a.size_bb
        ]
        return hero_bets[-1] if hero_bets else None
    except Exception:
        return None


def _estimate_pot(parsed_hand, target_street: str) -> float:
    """Estimate pot size at start of a street."""
    try:
        pot = parsed_hand.pot_size_bb or 0.0
        bb = parsed_hand.big_blind or 1.0
        # Simple approximation: start with pot from hand
        # A more precise version would use pot_engine, but this is a fallback
        return max(pot, bb * 2)
    except Exception:
        return 5.0


def _select_relevant_concepts(
    board_family, spr_zone, equity_bucket, spot, bet_fraction, donk_freq
) -> list[str]:
    """Select the most relevant concepts for this spot."""
    concepts = ["equity_realization", "spr_theory"]

    if board_family:
        if "dry" in board_family.value:
            concepts.append("merged_betting")
            concepts.append("range_advantage")
        elif "connected" in board_family.value or "low" in board_family.value:
            concepts.append("donk_bet")
            concepts.append("nut_advantage")
        elif "wet" in board_family.value:
            concepts.append("polarized_betting")
            concepts.append("cbet_theory")

    if spr_zone.value in ("micro", "low"):
        concepts.append("spr_theory")
    elif spr_zone.value in ("high", "deep"):
        concepts.append("nut_advantage")
        concepts.append("geometric_sizing")

    if equity_bucket == EquityBucket.TRASH:
        concepts.append("alpha")
        concepts.append("bluff_value_ratio")
    elif equity_bucket == EquityBucket.WEAK:
        concepts.append("mdf")
        concepts.append("equity_realization")

    if spot and hasattr(spot, "pot_type") and "3bet" in spot.pot_type.lower():
        concepts.append("range_advantage")
        concepts.append("capped_range")

    if bet_fraction and bet_fraction > 1.0:
        concepts.append("overbet")
        concepts.append("nut_advantage")

    if donk_freq and donk_freq.value in ("mid", "high"):
        concepts.append("donk_bet")

    # Deduplicate
    return list(dict.fromkeys(concepts))


def _build_theory_tags(
    board_family, spr_zone, equity_bucket, spot, bet_fraction, donk_freq, board_profile
) -> list[str]:
    """Build coaching/puzzle tags for this spot."""
    tags = []

    if board_family:
        if board_family in (BoardFamily.A_HIGH_DRY, BoardFamily.K_HIGH_DRY):
            tags += ["dry_board", "ip_range_advantage", "merged_cbet"]
        elif board_family in (BoardFamily.A_HIGH_WET, BoardFamily.K_HIGH_WET):
            tags += ["wet_board", "charge_draws", "polarized_cbet"]
        elif board_family == BoardFamily.LOW_CONNECTED:
            tags += ["low_connected_board", "donk_bet", "oop_range_advantage"]
        elif board_family == BoardFamily.MONOTONE:
            tags += ["monotone_board", "flush_equity"]

    if spr_zone == SPRZone.MICRO:
        tags.append("pot_committed")
    elif spr_zone == SPRZone.LOW:
        tags.append("low_spr_top_pair")
    elif spr_zone in (SPRZone.HIGH, SPRZone.DEEP):
        tags.append("high_spr_nuttiness")

    if equity_bucket == EquityBucket.STRONG:
        tags.append("value_bet_strong")
    elif equity_bucket == EquityBucket.WEAK:
        tags.append("bluff_catcher")
    elif equity_bucket == EquityBucket.TRASH:
        tags.append("bluff_candidate")

    if bet_fraction and bet_fraction > 1.0:
        tags.append("overbet_spot")
    elif bet_fraction and bet_fraction < 0.35:
        tags.append("merged_cbet")

    if spot and hasattr(spot, "pot_type"):
        pt = spot.pot_type.lower()
        if "3bet" in pt:
            tags.append("3bet_pot")
        elif "4bet" in pt:
            tags.append("4bet_pot")
        else:
            tags.append("srp")

    if donk_freq and donk_freq.value in ("mid", "high"):
        tags.append("donk_bet")

    return list(dict.fromkeys(tags))
