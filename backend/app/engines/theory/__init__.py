"""
Poker Truth Engine — Theory Layer
==================================
Original poker intelligence architecture inspired by modern GTO theory concepts.

All mathematics, formulas, and structural logic in this module are original
implementations based on well-known poker mathematics (pot odds, MDF, alpha,
equity realization) that are mathematical facts, not copyrighted content.

Architecture:
    concepts      → canonical concept registry (taxonomy, tags, coaching metadata)
    mdf_alpha     → MDF / Alpha / bluff-value ratio mathematics
    equity_buckets→ hand vs range equity classification (EQB system)
    spr_theory    → SPR guidelines and hand-type mappings
    range_theory  → range morphology (polar, linear, condensed, capped)
    node_library  → canonical preflop node definitions with GTO annotations
    board_theory  → board texture → strategy mapping
    betting_theory→ bet-sizing logic (geometric, polar, merged)
"""

from .concepts import CONCEPT_REGISTRY, ConceptTag, StrategicCategory
from .mdf_alpha import alpha, mdf, bluff_value_ratio, required_fold_equity
from .equity_buckets import EquityBucket, classify_equity_bucket, EQB_THRESHOLDS
from .spr_theory import SPRZone, classify_spr, spr_hand_guidelines
from .range_theory import RangeMorphology, classify_range_morphology
from .node_library import NODE_LIBRARY, PokerNode, get_node
from .board_theory import BoardFamily, classify_board_family, donk_bet_frequency_class
from .betting_theory import (
    geometric_bet_size,
    optimal_bet_size_for_spr,
    BetSizingStrategy,
    classify_bet_size,
)

__all__ = [
    # Concepts
    "CONCEPT_REGISTRY", "ConceptTag", "StrategicCategory",
    # Math
    "alpha", "mdf", "bluff_value_ratio", "required_fold_equity",
    # EQB
    "EquityBucket", "classify_equity_bucket", "EQB_THRESHOLDS",
    # SPR
    "SPRZone", "classify_spr", "spr_hand_guidelines",
    # Range morphology
    "RangeMorphology", "classify_range_morphology",
    # Nodes
    "NODE_LIBRARY", "PokerNode", "get_node",
    # Board theory
    "BoardFamily", "classify_board_family", "donk_bet_frequency_class",
    # Betting
    "geometric_bet_size", "optimal_bet_size_for_spr",
    "BetSizingStrategy", "classify_bet_size",
]
