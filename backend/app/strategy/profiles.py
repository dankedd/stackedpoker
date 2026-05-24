"""
StrategyProfile — deterministic strategic output for a classified poker spot.

Produced by resolve_strategy() from a SolverSpot.
Consumed by recommendations.py (→ HeuristicFinding) and the API response.

DESIGN RULES:
  - frequency fields are internal strategic signals (0.0–1.0).
  - They are NOT shown as raw percentages in user-facing text.
    recommendations.py converts them to appropriately hedged language.
  - Numeric signals (range_advantage, etc.) express relative advantage,
    not fabricated solver outputs. They inform qualitative coaching text.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ActionLabel = Literal["bet", "check", "call", "raise", "fold"]


@dataclass
class ActionFrequency:
    """Internal strategic signal for one action."""

    action: ActionLabel
    frequency: float           # 0.0–1.0 strategic weight
    sizing: str | None = None  # "33pct" | "50pct" | "75pct" | "pot" | None


@dataclass
class StrategyProfile:
    """
    Deterministic strategy profile for a classified solver spot.

    Fields
    ------
    node_key          stable string identifying this spot
    bet_frequency     expected bet/raise frequency as the first actor (0–1)
    check_frequency   expected check frequency as the first actor (0–1)
    primary_sizing    qualitative recommended bet size when betting
    range_advantage   0=caller dominates, 0.5=neutral, 1=pfr dominates
    nut_advantage     0=caller holds nuts more, 1=pfr holds nuts more
    pressure_score    how much betting pressure is theoretically supported (0–1)
    volatility_score  how much future runouts shift equity (0–1)
    equity_realization expected equity realization for the PFR (0–1)
    action_frequencies ordered list of all action signals (most preferred first)
    rationale         one-line theory explanation for this spot
    caveats           edge-case warnings
    source            "registry" (handcrafted) | "fallback" (default)
    """

    node_key: str

    bet_frequency: float = 0.55
    check_frequency: float = 0.45
    primary_sizing: str | None = None

    range_advantage: float = 0.50
    nut_advantage: float = 0.50
    pressure_score: float = 0.50
    volatility_score: float = 0.50
    equity_realization: float = 0.65

    action_frequencies: list[ActionFrequency] = field(default_factory=list)

    rationale: str = ""
    caveats: list[str] = field(default_factory=list)
    source: Literal["registry", "fallback"] = "registry"
