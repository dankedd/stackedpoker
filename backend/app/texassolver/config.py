"""
SolverConfig — configuration model for a single TexasSolver run.

MVP scope:
  - SRP, BTN vs BB, 100bb, flop-only
  - Configurable bet sizes, rake, iterations, accuracy
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SolverConfig:
    """
    Full configuration for a single TexasSolver solve.

    spot_type       — pot construction type: "SRP", "3BET", etc.
    positions       — positional matchup: "BTN_vs_BB"
    stack_depth     — effective stack in BB (e.g. 100)
    board           — board cards as list of card strings: ["Ah", "7d", "2c"]

    bet_sizes       — bet sizing options as fractions of pot: [0.33, 0.5, 0.75, 1.0]
    raise_sizes     — raise sizing options as fractions of pot: [0.5, 0.75, 1.0]
    rake            — rake percentage (None = no rake)

    iterations      — maximum solver iterations
    accuracy_target — target exploitability in % of pot (lower = more precise)

    solver_path     — path to TexasSolver executable (None = auto-detect)
    """

    spot_type: str = "SRP"
    positions: str = "BTN_vs_BB"
    stack_depth: int = 100
    board: list[str] = field(default_factory=lambda: ["Ah", "7d", "2c"])

    bet_sizes: list[float] = field(default_factory=lambda: [0.33, 0.5, 0.75, 1.0])
    raise_sizes: list[float] = field(default_factory=lambda: [0.5, 0.75, 1.0])
    rake: Optional[float] = None

    iterations: int = 1000
    accuracy_target: float = 0.5

    solver_path: Optional[str] = None

    def pot_size_bb(self) -> float:
        """Derive the starting pot from spot type and stack depth."""
        if self.spot_type == "SRP":
            # Standard SRP: open to 2.5bb, BB calls → pot = 6.5bb (after blinds)
            return 6.5
        if self.spot_type == "3BET":
            return 22.0
        if self.spot_type == "4BET":
            return 48.0
        # Default
        return 6.5

    def effective_stack_chips(self) -> float:
        """Effective stack remaining after preflop action (in BB)."""
        return self.stack_depth - (self.pot_size_bb() / 2.0)

    def spr(self) -> float:
        """Stack-to-pot ratio at the flop."""
        pot = self.pot_size_bb()
        if pot <= 0:
            return 0.0
        return self.effective_stack_chips() / pot

    def ip_position(self) -> str:
        """Extract IP position from matchup string."""
        return self.positions.split("_vs_")[0]

    def oop_position(self) -> str:
        """Extract OOP position from matchup string."""
        parts = self.positions.split("_vs_")
        return parts[1] if len(parts) > 1 else "BB"

    def board_string(self) -> str:
        """Board as space-separated string for solver input."""
        return " ".join(self.board)

    def validate(self) -> list[str]:
        """Return a list of validation errors (empty = valid)."""
        errors: list[str] = []
        if len(self.board) not in (3, 4, 5):
            errors.append(f"Board must have 3-5 cards, got {len(self.board)}")
        if self.stack_depth < 10:
            errors.append(f"Stack depth must be >= 10bb, got {self.stack_depth}")
        if self.iterations < 1:
            errors.append(f"Iterations must be >= 1, got {self.iterations}")
        if self.accuracy_target <= 0:
            errors.append(f"Accuracy target must be > 0, got {self.accuracy_target}")
        if not self.bet_sizes:
            errors.append("At least one bet size is required")
        if "_vs_" not in self.positions:
            errors.append(f"Positions must be in IP_vs_OOP format, got {self.positions}")
        return errors
