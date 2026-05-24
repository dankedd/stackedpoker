"""
Mapper — converts a normalized RawSolverNode into a (node_key_str, is_ip) pair.

map_solver_node(node) → (node_key_str, is_ip) | None

Uses the existing BoardClassifier to classify the board, then constructs
the NodeKey string in the canonical format:

  {spot_type}::{position_matchup}::{stack_depth_bucket}::{spr_bucket}::{board_class}::{street}::{player_count}p

MVP assumptions:
  - All imports are BTN vs BB, SRP, 100bb, heads-up (2 players)
  - BTN is always IP; BB is always OOP
  - SPR bucket is derived from node.spr (stack_chips / pot_chips)
"""

from __future__ import annotations

from .models import RawSolverNode

from app.solver.board_classifier import BoardClassifier
from app.solver.enums import BoardClassEnum

# Module-level classifier (stateless, reusable)
_classifier = BoardClassifier()

# ── SPR bucketing ─────────────────────────────────────────────────────────────

def _spr_to_bucket(spr: float) -> str:
    """Map a numeric SPR to a bucket label."""
    if spr < 2.0:
        return "0_2"
    if spr < 4.0:
        return "2_4"
    if spr < 8.0:
        return "4_8"
    return "8_PLUS"


# ── IP / OOP determination ────────────────────────────────────────────────────

_IP_POSITIONS  = {"BTN", "CO", "HJ", "LJ", "UTG", "UTG1", "UTG2"}
_OOP_POSITIONS = {"BB", "SB"}


def _is_ip(position: str) -> bool | None:
    """
    Return True if position is IP, False if OOP, None if unknown.

    MVP scope: only BTN (IP) and BB (OOP) are expected.
    """
    if position in _IP_POSITIONS:
        return True
    if position in _OOP_POSITIONS:
        return False
    return None


# ── Position matchup construction ─────────────────────────────────────────────

def _position_matchup(ip_pos: str, oop_pos: str) -> str:
    """Build canonical position matchup string: {IP}_vs_{OOP}."""
    return f"{ip_pos}_vs_{oop_pos}"


# ── Board classification ──────────────────────────────────────────────────────

def _classify_board(board_str: str, street: str) -> str | None:
    """
    Classify board string to a BoardClassEnum value.

    board_str: space-separated cards, e.g. "Ah Kc 7d" or "Ah Kc 7d 2s"
    Returns BoardClassEnum.value string, or None on failure.
    """
    cards = board_str.strip().split()
    try:
        if street == "flop" and len(cards) == 3:
            features = _classifier.classify_flop(cards)
        elif street == "turn" and len(cards) == 4:
            features = _classifier.classify_turn(cards[:3], cards[3])
        elif street == "river" and len(cards) == 5:
            features = _classifier.classify_river(cards[:4], cards[4])
        else:
            # Attempt flop classification if 3 cards regardless of street label
            if len(cards) == 3:
                features = _classifier.classify_flop(cards)
            else:
                return None
        return features.board_class.value
    except Exception:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def map_solver_node(node: RawSolverNode) -> tuple[str, bool] | None:
    """
    Map a normalized RawSolverNode to a (node_key_str, is_ip) tuple.

    Returns None if the node cannot be mapped (unknown position, board
    classification failure, or out of scope).

    Args:
        node: A validated, normalized RawSolverNode.

    Returns:
        (node_key_str, is_ip) or None.

    node_key_str format:
        "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
    """
    # Determine IP/OOP
    ip = _is_ip(node.position)
    if ip is None:
        return None

    # Derive position matchup (MVP: BTN vs BB only)
    if ip:
        matchup = _position_matchup(node.position, "BB")
    else:
        matchup = _position_matchup("BTN", node.position)

    # Classify board
    board_class = _classify_board(node.board, node.street)
    if board_class is None:
        return None

    # SPR bucket
    spr_bucket = _spr_to_bucket(node.spr)

    # MVP: always 100bb stack depth, 2 players heads-up
    stack_depth = "100bb"
    player_count = 2

    node_key_str = (
        f"{node.spot_type}::{matchup}::{stack_depth}"
        f"::{spr_bucket}::{board_class}::{node.street}::{player_count}p"
    )
    return node_key_str, ip
