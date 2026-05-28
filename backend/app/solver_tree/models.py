"""
SolverNode — normalized, solver-agnostic game tree node.

Each node in the solver game tree becomes an independent persistent object
with deterministic IDs, parent/child relationships, and full action-path
metadata.

Design decisions:
  - IDs are deterministic hashes of (solve_id, board, action_path) so the
    same solve always produces the same node IDs.
  - action_path is the source of truth for tree position — not parent refs.
  - Nodes are solver-agnostic: no TexasSolver-specific fields leak through.
  - Terminal nodes (chance_node / showdown) are stored with is_terminal=True.
  - Per-combo strategy data is stored as a flat dict for serialization.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Literal


# ── Action path encoding ─────────────────────────────────────────────────────

# Compact action abbreviations for path strings.
# "CHECK" → "x", "BET 96.000000" → "b96", "CALL" → "c", "FOLD" → "f", "RAISE 192" → "r192"

def encode_action(raw: str) -> str:
    """Encode a raw TexasSolver action name into a compact path token."""
    upper = raw.strip().upper()
    if upper == "CHECK":
        return "x"
    if upper == "CALL":
        return "c"
    if upper == "FOLD":
        return "f"
    if upper.startswith("BET "):
        size = upper.split(" ", 1)[1].strip()
        try:
            return f"b{int(round(float(size)))}"
        except ValueError:
            return f"b{size}"
    if upper.startswith("RAISE "):
        size = upper.split(" ", 1)[1].strip()
        try:
            return f"r{int(round(float(size)))}"
        except ValueError:
            return f"r{size}"
    if upper == "ALLIN":
        return "ai"
    return raw.lower().replace(" ", "")


def decode_action(token: str) -> str:
    """Decode a compact path token back to a human-readable action."""
    if token == "x":
        return "check"
    if token == "c":
        return "call"
    if token == "f":
        return "fold"
    if token == "ai":
        return "all-in"
    if token.startswith("b"):
        return f"bet {token[1:]}"
    if token.startswith("r"):
        return f"raise {token[1:]}"
    return token


# ── Deterministic node ID ────────────────────────────────────────────────────

def make_node_id(
    solve_id: str,
    board_str: str,
    action_path: str,
) -> str:
    """
    Generate a deterministic, collision-resistant node ID.

    The ID is a SHA-256 prefix of (solve_id, board, action_path).
    Same inputs always produce the same ID. The first 16 hex chars
    give 64 bits of entropy — sufficient for trees up to millions of nodes.

    The human-readable path is stored separately in the node for debugging.
    """
    raw = f"{solve_id}:{board_str}:{action_path}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def make_human_path(board_str: str, action_tokens: list[str]) -> str:
    """
    Build a human-readable node path for debugging and deep linking.

    Examples:
      "root:flop:Jh9c4d"
      "root:flop:Jh9c4d:x-b96"
      "root:flop:Jh9c4d:x-b96-c"
    """
    board_compact = board_str.replace(" ", "").replace(",", "")
    street = (
        "flop" if len(board_compact) == 6
        else "turn" if len(board_compact) == 8
        else "river" if len(board_compact) == 10
        else "preflop"
    )
    base = f"root:{street}:{board_compact}"
    if action_tokens:
        return f"{base}:{'-'.join(action_tokens)}"
    return base


# ── SolverNode ───────────────────────────────────────────────────────────────

@dataclass
class SolverNode:
    """
    A single normalized node in the solver game tree.

    Solver-agnostic: no TexasSolver-specific fields. Can represent output
    from TexasSolver, PioSolver, Monker, or any GTO engine.
    """

    # ── Identity ─────────────────────────────────────────────────────────
    id: str                          # deterministic hash (16 hex chars)
    solve_id: str                    # which solve produced this tree
    human_path: str                  # e.g. "root:flop:Jh9c4d:x-b96"

    # ── Tree structure ───────────────────────────────────────────────────
    parent_id: str | None            # None for root
    children_ids: list[str] = field(default_factory=list)

    # ── Position in tree ─────────────────────────────────────────────────
    action_history: list[str] = field(default_factory=list)  # ["x", "b96", "c"]
    action_path: str = ""            # "x-b96-c" (joined action_history)
    depth: int = 0

    # ── Game state ───────────────────────────────────────────────────────
    street: Literal["preflop", "flop", "turn", "river"] = "flop"
    board: list[str] = field(default_factory=list)  # ["Jh", "9c", "4d"]
    pot_size: float = 0.0            # pot in BB at this node

    # ── Decision info ────────────────────────────────────────────────────
    actor: Literal["ip", "oop"] | None = None  # None for terminal/chance
    available_actions: list[str] = field(default_factory=list)  # ["x", "b96"]
    is_terminal: bool = False

    # ── Strategy (per-combo frequencies) ─────────────────────────────────
    # strategy[combo_str] = [freq_action_0, freq_action_1, ...]
    # Indices correspond to available_actions order.
    strategy: dict[str, list[float]] = field(default_factory=dict)

    # ── Aggregate frequencies ────────────────────────────────────────────
    # Precomputed average across all combos for quick access.
    aggregate_freqs: dict[str, float] = field(default_factory=dict)

    # ── Metadata ─────────────────────────────────────────────────────────
    combo_count: int = 0
    node_type: str = "action"        # "action" | "chance" | "terminal"
    raw_player: int | None = None    # 0=IP, 1=OOP from solver (for provenance)

    def to_dict(self) -> dict:
        """Serialize to a JSON-compatible dict."""
        return {
            "id": self.id,
            "solve_id": self.solve_id,
            "human_path": self.human_path,
            "parent_id": self.parent_id,
            "children_ids": self.children_ids,
            "action_history": self.action_history,
            "action_path": self.action_path,
            "depth": self.depth,
            "street": self.street,
            "board": self.board,
            "pot_size": self.pot_size,
            "actor": self.actor,
            "available_actions": self.available_actions,
            "is_terminal": self.is_terminal,
            "strategy": self.strategy,
            "aggregate_freqs": self.aggregate_freqs,
            "combo_count": self.combo_count,
            "node_type": self.node_type,
            "raw_player": self.raw_player,
        }

    @classmethod
    def from_dict(cls, d: dict) -> SolverNode:
        """Deserialize from a dict."""
        return cls(
            id=d["id"],
            solve_id=d["solve_id"],
            human_path=d["human_path"],
            parent_id=d.get("parent_id"),
            children_ids=d.get("children_ids", []),
            action_history=d.get("action_history", []),
            action_path=d.get("action_path", ""),
            depth=d.get("depth", 0),
            street=d.get("street", "flop"),
            board=d.get("board", []),
            pot_size=d.get("pot_size", 0.0),
            actor=d.get("actor"),
            available_actions=d.get("available_actions", []),
            is_terminal=d.get("is_terminal", False),
            strategy=d.get("strategy", {}),
            aggregate_freqs=d.get("aggregate_freqs", {}),
            combo_count=d.get("combo_count", 0),
            node_type=d.get("node_type", "action"),
            raw_player=d.get("raw_player"),
        )
