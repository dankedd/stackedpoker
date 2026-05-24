"""
Seed generator — builds StrategyNode list from Phase 4 registry.

Covers all combinations of:
  spot_types    × SRP, 3BET, 4BET, LIMPED, SQUEEZE, ISO_RAISE  (6)
  is_ip         × True, False                                   (2)
  spr_buckets   × 0_2, 2_4, 4_8, 8_PLUS                        (4)
  board_classes × all 17 BoardClassEnum values                  (17)
  streets       × flop, turn (river omitted — same profile)     (2)
──────────────────────────────────────────────────────────────────
Total: 6 × 2 × 4 × 17 × 2 = 1632 seed nodes

Position matchups used for seed keys:
  is_ip=True  → BTN_vs_BB  (canonical IP matchup)
  is_ip=False → SB_vs_BB   (canonical OOP matchup)

Real hands with other position matchups will match via nearest-neighbour
similarity (e.g. CO_vs_BB scores 0.85 against BTN_vs_BB in same family).

Stack depth is fixed at 100bb for the seed library.
Future imports (Pio, GTO Wizard) can register additional nodes with
their specific stack_depth_bucket values.

This function is fast (~2ms) — pure dict operations, no I/O.
"""

from __future__ import annotations

from app.strategy_db.models import StrategyNode
from app.strategy.registry import build_profile_dict

# Increment when registry values change to trigger cache invalidation
SEED_VERSION = "1.0"

_SPOT_TYPES = ["SRP", "3BET", "4BET", "LIMPED", "SQUEEZE", "ISO_RAISE"]
_SPR_BUCKETS = ["0_2", "2_4", "4_8", "8_PLUS"]
_BOARD_CLASSES = [
    "A_HIGH_DRY", "A_HIGH_WET",
    "K_HIGH_DRY", "K_HIGH_WET",
    "LOW_CONNECTED", "LOW_DYNAMIC",
    "MIDDLE_CONNECTED",
    "DOUBLE_BROADWAY", "TRIPLE_BROADWAY",
    "PAIRED_LOW", "PAIRED_HIGH",
    "MONOTONE",
    "RAINBOW_STATIC", "RAINBOW_DYNAMIC",
    "FLUSH_COMPLETING", "STRAIGHT_COMPLETING",
    "NEUTRAL",
]
_STREETS = ["flop", "turn"]
_STACK_DEPTH = "100bb"
_IP_MATCHUP  = "BTN_vs_BB"
_OOP_MATCHUP = "SB_vs_BB"


def _node_key(
    spot_type: str,
    matchup: str,
    spr: str,
    board: str,
    street: str,
) -> str:
    return f"{spot_type}::{matchup}::{_STACK_DEPTH}::{spr}::{board}::{street}::2p"


def generate_all_seed_nodes() -> list[StrategyNode]:
    """
    Generate the full seed library from the Phase 4 registry.

    Returns a flat list of StrategyNode objects.
    Deterministic: same inputs always produce identical outputs.
    """
    nodes: list[StrategyNode] = []

    for spot_type in _SPOT_TYPES:
        for is_ip in (True, False):
            matchup = _IP_MATCHUP if is_ip else _OOP_MATCHUP
            for spr in _SPR_BUCKETS:
                for board in _BOARD_CLASSES:
                    for street in _STREETS:
                        raw = build_profile_dict(spot_type, is_ip, spr, board)
                        key = _node_key(spot_type, matchup, spr, board, street)

                        node = StrategyNode(
                            node_key=key,
                            spot_type=spot_type,
                            board_class=board,
                            spr_bucket=spr,
                            stack_depth_bucket=_STACK_DEPTH,
                            position_matchup=matchup,
                            street=street,
                            player_count=2,
                            is_ip=is_ip,
                            bet_frequency=raw["bet_frequency"],
                            check_frequency=raw["check_frequency"],
                            primary_sizing=raw["primary_sizing"],
                            range_advantage=raw["range_advantage"],
                            nut_advantage=raw["nut_advantage"],
                            pressure_score=raw["pressure_score"],
                            volatility_score=raw["volatility_score"],
                            equity_realization=raw["equity_realization"],
                            rationale=raw["rationale"],
                            source="handcrafted",
                            version=SEED_VERSION,
                        )
                        nodes.append(node)

    return nodes
