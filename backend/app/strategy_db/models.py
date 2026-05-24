"""
StrategyNode — normalized storage model for strategy database entries.

Flat representation: all strategy fields are stored directly (no nested
StrategyProfile) to make JSON serialization trivial and avoid circular
imports between strategy_db ↔ strategy.

Source values:
  "texassolver"  — TexasSolver offline solve (highest priority)
  "handcrafted"  — generated from Phase 4 registry
  "pio"          — future PioSolver export
  "gto_wizard"   — future GTO Wizard export
  "manual"       — human-authored override

The extended_key adds a ::ip / ::oop suffix to the node_key string so
the store can hold separate IP and OOP strategies for the same position
matchup without ambiguity.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass


def _extended_key(node_key_str: str, is_ip: bool) -> str:
    """Append ::ip or ::oop suffix for unambiguous store keying."""
    return f"{node_key_str}::{'ip' if is_ip else 'oop'}"


@dataclass
class StrategyNode:
    """
    Single strategy database entry.

    Hashable by node_key; serialisable to/from plain dicts.
    Designed so future solver imports (Pio, GTO Wizard) can plug in
    by constructing StrategyNodes and calling StrategyStore.register_strategy().
    """

    # ── Identity ──────────────────────────────────────────────────────────
    node_key: str           # canonical NodeKey.to_string() value
    spot_type: str          # SpotType.value
    board_class: str        # BoardClassEnum.value
    spr_bucket: str         # SPRBucket.value
    stack_depth_bucket: str # StackDepthBucket.value
    position_matchup: str   # PositionMatchup.value
    street: str             # SolverStreet.value
    player_count: int
    is_ip: bool

    # ── Strategy (flattened StrategyProfile fields) ───────────────────────
    bet_frequency: float
    check_frequency: float
    primary_sizing: str | None
    range_advantage: float
    nut_advantage: float
    pressure_score: float
    volatility_score: float
    equity_realization: float
    rationale: str

    # ── Provenance ────────────────────────────────────────────────────────
    source: str = "handcrafted"
    version: str = "1.0"

    # ── Derived ───────────────────────────────────────────────────────────

    @property
    def extended_key(self) -> str:
        """Unambiguous store key: node_key + ::ip/::oop."""
        return _extended_key(self.node_key, self.is_ip)

    # ── Serialisation ─────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> StrategyNode:
        # Accept extra keys gracefully (forward-compat with future fields)
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in known})

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, s: str) -> StrategyNode:
        return cls.from_dict(json.loads(s))

    # ── Equality / hashing ────────────────────────────────────────────────

    def __hash__(self) -> int:
        return hash(self.extended_key)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, StrategyNode):
            return NotImplemented
        return self.extended_key == other.extended_key

    def __repr__(self) -> str:
        return f"StrategyNode(key={self.extended_key!r}, source={self.source!r})"
