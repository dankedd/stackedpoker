"""
Canonical Preflop Node Library
================================
Original node definitions with GTO-theory-informed annotations.

A "node" is a specific point in the game tree defined by:
  - Position matchup (e.g., BTN vs BB)
  - Action sequence (e.g., RFI, 3-bet, 4-bet)
  - Stack depth class (short/medium/deep)
  - Pot type (SRP, 3bet, 4bet)

Each node specifies:
  - Legal actions and their typical frequencies
  - Range morphology of each player
  - Recommended bet-size range
  - Key strategic concept for this node

All data here is original synthesis based on well-established poker heuristics,
not reproduced from any specific copyrighted source.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class StackDepth(str, Enum):
    SHORT  = "short"   # <40bb
    MEDIUM = "medium"  # 40–80bb
    DEEP   = "deep"    # 80–120bb
    VERY_DEEP = "very_deep"  # 120bb+


class PotType(str, Enum):
    SRP    = "srp"    # single raised pot (RFI + call)
    THREEB = "3bet"   # 3-bet pot
    FOURB  = "4bet"   # 4-bet pot


class PositionAdvantage(str, Enum):
    IP  = "ip"   # acting last postflop
    OOP = "oop"  # acting first postflop


@dataclass(frozen=True)
class NodeRangeProfile:
    """Range description for one player at a specific node."""
    morphology: str          # "linear", "polarized", "condensed", "capped", "uncapped"
    approximate_pct: float   # rough fraction of all hands (e.g. 0.15 = 15%)
    nut_presence: bool       # does range include strongest hands?
    key_hands: list[str]     # representative hands (descriptive, not exhaustive)
    description: str


@dataclass(frozen=True)
class PokerNode:
    """
    A canonical preflop game node with full strategic context.
    """
    node_id: str             # e.g. "BTN_RFI_vs_BB_call_100bb"
    label: str               # human label e.g. "BTN vs BB SRP (100bb)"
    pot_type: PotType
    stack_depth: StackDepth
    ip_position: str         # e.g. "BTN"
    oop_position: str        # e.g. "BB"
    aggressor: str           # who was last aggressor preflop
    ip_range: NodeRangeProfile
    oop_range: NodeRangeProfile
    range_advantage_holder: PositionAdvantage  # who has equity advantage
    nut_advantage_holder: PositionAdvantage    # who has more nut combos
    recommended_ip_sizing: str   # e.g. "33–50% pot"
    recommended_oop_sizing: str
    key_concept: str
    coaching_tags: list[str]
    typical_spr_range: tuple[float, float]


NODE_LIBRARY: dict[str, PokerNode] = {

    # ─────────────────────────────────────────────────────────────────────────
    # BTN vs BB — Single Raised Pot
    # ─────────────────────────────────────────────────────────────────────────
    "BTN_BB_SRP_100": PokerNode(
        node_id="BTN_BB_SRP_100",
        label="BTN vs BB — SRP (100bb)",
        pot_type=PotType.SRP,
        stack_depth=StackDepth.DEEP,
        ip_position="BTN",
        oop_position="BB",
        aggressor="BTN",
        ip_range=NodeRangeProfile(
            morphology="uncapped",
            approximate_pct=0.45,
            nut_presence=True,
            key_hands=["AA", "KK", "QQ", "AKs", "AKo", "A2s-A9s", "KQs", "T9s", "87s", "small_pairs"],
            description=(
                "BTN opens ~45% of hands — a wide, uncapped range that includes both "
                "premium hands and many speculative hands. BTN has the nut advantage "
                "and a range advantage vs BB on most flop textures."
            ),
        ),
        oop_range=NodeRangeProfile(
            morphology="condensed",
            approximate_pct=0.64,
            nut_presence=False,
            key_hands=["all_pairs", "Axs", "broadway_hands", "suited_connectors"],
            description=(
                "BB calls very wide (defending ~64% vs BTN) but 3-bets strong hands. "
                "The flat-call range is capped — it excludes premium hands that 3-bet. "
                "BB has many weak/trash hands that struggle to realize equity OOP."
            ),
        ),
        range_advantage_holder=PositionAdvantage.IP,
        nut_advantage_holder=PositionAdvantage.IP,
        recommended_ip_sizing="25–40% pot (merged) on most boards; 67%+ on wet/connected",
        recommended_oop_sizing="25–50% pot (donk) on low connected boards; check most other boards",
        key_concept=(
            "BTN has massive positional and range advantages vs BB. "
            "BTN should c-bet at high frequency using a small merged size on dry boards "
            "(capturing equity denial) and a larger polarized size on wet boards "
            "(charging draws and protecting value). "
            "BB must check most flops but can lead (donk) on low connected boards "
            "where BB's range has a nut advantage."
        ),
        coaching_tags=[
            "range_advantage_ip", "equity_denial", "merged_cbet",
            "bb_capped_range", "position_value", "donk_bet_applicable",
        ],
        typical_spr_range=(8.0, 13.0),
    ),

    "BTN_BB_SRP_40": PokerNode(
        node_id="BTN_BB_SRP_40",
        label="BTN vs BB — SRP (40bb)",
        pot_type=PotType.SRP,
        stack_depth=StackDepth.SHORT,
        ip_position="BTN",
        oop_position="BB",
        aggressor="BTN",
        ip_range=NodeRangeProfile(
            morphology="uncapped",
            approximate_pct=0.45,
            nut_presence=True,
            key_hands=["AA-55", "AKo", "AQs-A2s", "KQs", "suited_connectors"],
            description="Same BTN open range but plays shorter — fewer implied odds spots.",
        ),
        oop_range=NodeRangeProfile(
            morphology="condensed",
            approximate_pct=0.60,
            nut_presence=False,
            key_hands=["all_pairs", "Axs", "broadway"],
            description="BB defends wide but top pairs become commitment hands at low SPR.",
        ),
        range_advantage_holder=PositionAdvantage.IP,
        nut_advantage_holder=PositionAdvantage.IP,
        recommended_ip_sizing="33–67% pot; top pair commits at 40bb SPR ~3–5",
        recommended_oop_sizing="check or small donk on connected boards",
        key_concept=(
            "At 40bb SPR ~3–5, top pair becomes a commitment hand for BTN on most boards. "
            "BTN can c-bet wide for value because BB cannot call down with weak equity. "
            "BB must be willing to check-raise strong draws and two pair+ to prevent "
            "BTN from profitably auto-cbetting with air."
        ),
        coaching_tags=["low_spr_top_pair_commits", "range_advantage_ip", "equity_denial"],
        typical_spr_range=(3.0, 6.0),
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # CO vs BB — Single Raised Pot
    # ─────────────────────────────────────────────────────────────────────────
    "CO_BB_SRP_100": PokerNode(
        node_id="CO_BB_SRP_100",
        label="CO vs BB — SRP (100bb)",
        pot_type=PotType.SRP,
        stack_depth=StackDepth.DEEP,
        ip_position="CO",
        oop_position="BB",
        aggressor="CO",
        ip_range=NodeRangeProfile(
            morphology="linear",
            approximate_pct=0.26,
            nut_presence=True,
            key_hands=["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AJs", "KQs", "T9s"],
            description="CO opens ~26% — tighter than BTN, stronger average equity.",
        ),
        oop_range=NodeRangeProfile(
            morphology="condensed",
            approximate_pct=0.55,
            nut_presence=False,
            key_hands=["all_pairs", "Axs", "broadway_hands", "suited_connectors_marginal"],
            description="BB still defends wide but CO's tighter range creates more equity pressure.",
        ),
        range_advantage_holder=PositionAdvantage.IP,
        nut_advantage_holder=PositionAdvantage.IP,
        recommended_ip_sizing="33–50% pot on most boards; larger on wet runouts",
        recommended_oop_sizing="check most boards; occasional donk on extreme BB-favoring textures",
        key_concept=(
            "CO range is stronger than BTN range — more high-card heavy. "
            "This increases CO's range advantage on ace-high and king-high boards. "
            "BB should defend more tightly vs CO than vs BTN and cannot donk "
            "as frequently because BB's range disadvantage is more pronounced."
        ),
        coaching_tags=["range_advantage_ip", "high_card_board_advantage_ip", "tighter_ip_range"],
        typical_spr_range=(8.0, 13.0),
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # SB vs BB — Blind vs Blind
    # ─────────────────────────────────────────────────────────────────────────
    "SB_BB_SRP_100": PokerNode(
        node_id="SB_BB_SRP_100",
        label="SB vs BB — BvB SRP (100bb)",
        pot_type=PotType.SRP,
        stack_depth=StackDepth.DEEP,
        ip_position="BB",  # BB is IP postflop vs SB!
        oop_position="SB",
        aggressor="SB",
        ip_range=NodeRangeProfile(
            morphology="condensed",
            approximate_pct=0.60,
            nut_presence=False,
            key_hands=["all_pairs", "broadway", "Axs", "suited_connectors"],
            description=(
                "BB calls wide vs SB and is now IN POSITION postflop — "
                "a crucial difference from other defending spots. BB can defend "
                "extremely wide because it has position advantage for the rest of the hand."
            ),
        ),
        oop_range=NodeRangeProfile(
            morphology="uncapped",
            approximate_pct=0.45,
            nut_presence=True,
            key_hands=["AA-66", "AKo", "AQs-A2s", "KQs", "T9s"],
            description=(
                "SB raises a wide range but is OOP for the entire hand. "
                "SB often raises large (2.5–3x) to give BB worse odds, but "
                "this also limits SB's ability to c-bet frequently."
            ),
        ),
        range_advantage_holder=PositionAdvantage.OOP,  # SB raised → slight range advantage
        nut_advantage_holder=PositionAdvantage.OOP,
        recommended_ip_sizing="check most boards in position; bet for thin value",
        recommended_oop_sizing="small c-bet on low boards; check-heavy on high-card boards",
        key_concept=(
            "BvB is unique: BB is in position postflop. This dramatically increases "
            "BB's equity realization compared to defending vs an IP player. "
            "BB should defend very wide and realize equity with many marginal hands "
            "that would be folds vs other positions. SB's range, while uncapped, "
            "struggles to c-bet frequently because BB has position and can call wide."
        ),
        coaching_tags=["bvb_bb_in_position", "wide_bb_defense", "spr_equity_realization"],
        typical_spr_range=(9.0, 14.0),
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # BTN vs BB — 3-Bet Pot
    # ─────────────────────────────────────────────────────────────────────────
    "BTN_BB_3BET_100": PokerNode(
        node_id="BTN_BB_3BET_100",
        label="BTN vs BB — 3-Bet Pot (100bb)",
        pot_type=PotType.THREEB,
        stack_depth=StackDepth.DEEP,
        ip_position="BTN",
        oop_position="BB",
        aggressor="BB",  # BB 3-bet
        ip_range=NodeRangeProfile(
            morphology="condensed",
            approximate_pct=0.30,
            nut_presence=False,
            key_hands=["KK-TT", "AQs-AJs", "KQs", "T9s", "87s"],
            description=(
                "BTN called a 3-bet: capped range (AA/KK would often 4-bet), "
                "mostly playable hands with good equity realization in position."
            ),
        ),
        oop_range=NodeRangeProfile(
            morphology="polarized",
            approximate_pct=0.12,
            nut_presence=True,
            key_hands=["AA", "KK", "QQ", "AKs", "A5s-A3s", "K4s-K2s"],
            description=(
                "BB 3-bet range is polarized: value hands (QQ+, AK) plus "
                "blocker/bluff hands (A5s, A4s with nut-blocker properties). "
                "Range is uncapped but constructed with polarity in mind."
            ),
        ),
        range_advantage_holder=PositionAdvantage.OOP,  # 3-bettor has range advantage
        nut_advantage_holder=PositionAdvantage.OOP,
        recommended_ip_sizing="call or raise; prefer call with playable hands in 3bet pots",
        recommended_oop_sizing="65–100% pot c-bet; use larger sizes in 3bet pots",
        key_concept=(
            "In 3-bet pots, the 3-bettor (OOP) has the range advantage (QQ+, AK) "
            "but is positionally disadvantaged. SPR is lower (~3–6) which benefits "
            "made hands. OOP should c-bet at a higher frequency and larger size "
            "than in SRPs because SPR allows commitment with strong hands. "
            "IP caller's range is capped and condensed — avoid large bluffs vs capped OOP ranges."
        ),
        coaching_tags=["3bet_pot", "low_spr", "polarized_oop_range", "oop_range_advantage"],
        typical_spr_range=(3.0, 6.0),
    ),

    # ─────────────────────────────────────────────────────────────────────────
    # EP vs BB — Single Raised Pot
    # ─────────────────────────────────────────────────────────────────────────
    "EP_BB_SRP_100": PokerNode(
        node_id="EP_BB_SRP_100",
        label="UTG vs BB — SRP (100bb)",
        pot_type=PotType.SRP,
        stack_depth=StackDepth.DEEP,
        ip_position="UTG",
        oop_position="BB",
        aggressor="UTG",
        ip_range=NodeRangeProfile(
            morphology="linear",
            approximate_pct=0.14,
            nut_presence=True,
            key_hands=["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo", "AQo", "KQs"],
            description=(
                "UTG opens only ~14% — the tightest opening range at the table. "
                "Very linear and strong. BB faces maximum range disadvantage here."
            ),
        ),
        oop_range=NodeRangeProfile(
            morphology="condensed",
            approximate_pct=0.45,
            nut_presence=False,
            key_hands=["77-22", "Axs", "broadway", "suited_connectors"],
            description=(
                "BB defends narrower vs UTG (~45%) than vs BTN because UTG range "
                "is so much stronger. Many marginal hands that call vs BTN must fold here."
            ),
        ),
        range_advantage_holder=PositionAdvantage.IP,
        nut_advantage_holder=PositionAdvantage.IP,
        recommended_ip_sizing="33–50% pot on most boards; UTG has massive equity advantage",
        recommended_oop_sizing="very limited donk betting; check-call on medium boards only",
        key_concept=(
            "UTG vs BB is the largest range mismatch at the table. "
            "UTG has a near-linear range — mostly strong hands. "
            "BB must fold many hands that defend vs BTN. "
            "BB's equity is severely limited on ace-high and king-high boards. "
            "Calling out of position vs a tight range requires strict hand selection "
            "and an understanding that equity realization will be low."
        ),
        coaching_tags=["maximum_range_disadvantage_bb", "linear_ip_range", "tight_defending"],
        typical_spr_range=(8.0, 13.0),
    ),
}


def get_node(
    ip_pos: str,
    oop_pos: str,
    pot_type: str = "srp",
    stack_depth: str = "deep",
) -> Optional[PokerNode]:
    """
    Look up the best matching node from the library.

    Args:
        ip_pos:      IP player position (e.g. "BTN", "CO", "UTG")
        oop_pos:     OOP player position (e.g. "BB", "SB")
        pot_type:    "srp", "3bet", or "4bet"
        stack_depth: "short", "medium", "deep"

    Returns:
        PokerNode if found, else None
    """
    # Build candidate node IDs
    depth_suffix = {"short": "40", "medium": "60", "deep": "100"}.get(stack_depth, "100")
    pot_suffix = {"srp": "SRP", "3bet": "3BET", "4bet": "4BET"}.get(pot_type, "SRP")

    candidate = f"{ip_pos}_{oop_pos}_{pot_suffix}_{depth_suffix}"
    if candidate in NODE_LIBRARY:
        return NODE_LIBRARY[candidate]

    # Fallback: try without stack depth
    for k, node in NODE_LIBRARY.items():
        if node.ip_position == ip_pos and node.oop_position == oop_pos:
            if node.pot_type.value == pot_type:
                return node

    return None
