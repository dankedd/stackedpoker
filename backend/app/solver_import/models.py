"""
Data models for the GTO+ solver import pipeline.

These are raw intermediate models — they represent solver export data
before normalization, mapping, and compression into StrategyNodes.

Pipeline:
  GTO+ CSV export
    → parse_gto_export()   → list[RawSolverNode]
    → normalize()          → list[RawSolverNode]  (validated + cleaned)
    → map_solver_node()    → (node_key_str, is_ip)
    → compress_solver_node() → StrategyNode
    → StrategyStore.register_strategy()

MVP scope:
  - BTN vs BB, Single Raised Pot, 100bb, flop only
  - Supports both node-level CSVs (aggregated freq per action) and
    combo-level CSVs (per-hand-combo action distribution)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class RawAction:
    """
    A single action bucket from the solver output.

    action_name  — raw string from solver (e.g. "Bet 33%", "Check", "Raise 2.5x")
    frequency    — fraction of the range that takes this action [0.0, 1.0]
    ev_chips     — expected value in chips (None if not exported)
    """
    action_name: str
    frequency: float
    ev_chips: float | None = None


@dataclass
class RawComboEntry:
    """
    Solver frequency data for a single hand combo at a node.

    combo     — canonical 2-card hand string (e.g. "AhKs", "QdQc")
    actions   — list of (action_name, frequency) for this combo
    equity    — combo equity vs villain range [0.0, 1.0] (optional)
    ev_chips  — EV of optimal play for this combo (optional)
    """
    combo: str
    actions: list[RawAction] = field(default_factory=list)
    equity: float | None = None
    ev_chips: float | None = None


@dataclass
class RawSolverNode:
    """
    A single node from the GTO+ export, representing one decision point.

    node_id      — unique identifier within the export (e.g. row number or GTO+ node path)
    board        — board cards as a space-separated string (e.g. "Ah Kc 7d")
    position     — acting player position label (e.g. "BTN", "BB")
    pot_chips    — pot size in chips at this decision point
    stack_chips  — effective stack in chips
    street       — "flop" | "turn" | "river"
    spot_type    — "SRP" | "3BET" | "4BET" | "LIMPED" etc. (inferred or provided)
    actions      — aggregate action frequencies (node-level export)
    combos       — per-combo detail (combo-level export; may be empty)
    source_file  — originating file path (for provenance)
    """
    node_id: str
    board: str
    position: str
    pot_chips: float
    stack_chips: float
    street: str
    spot_type: str = "SRP"
    actions: list[RawAction] = field(default_factory=list)
    combos: list[RawComboEntry] = field(default_factory=list)
    source_file: str = ""

    @property
    def spr(self) -> float:
        """Stack-to-pot ratio at this decision point."""
        if self.pot_chips <= 0:
            return 0.0
        return self.stack_chips / self.pot_chips

    @property
    def total_frequency(self) -> float:
        """Sum of all action frequencies — should be ~1.0 for valid nodes."""
        return sum(a.frequency for a in self.actions)

    def is_valid(self) -> bool:
        """Quick validity check: has actions, frequencies approximately sum to 1."""
        if not self.actions:
            return False
        return abs(self.total_frequency - 1.0) < 0.02  # 2% tolerance


@dataclass
class ImportResult:
    """
    Summary of a completed solver import run.

    parsed    — number of raw nodes read from CSV
    valid     — number of nodes that passed validation
    mapped    — number of nodes successfully mapped to NodeKey
    stored    — number of StrategyNodes registered in the store
    skipped   — number of nodes skipped (out of scope, below threshold, etc.)
    errors    — list of (node_id, error_message) pairs for failed nodes
    dry_run   — if True, nothing was written to the store
    source_file — path that was imported
    """
    parsed: int = 0
    valid: int = 0
    mapped: int = 0
    stored: int = 0
    skipped: int = 0
    errors: list[tuple[str, str]] = field(default_factory=list)
    dry_run: bool = False
    source_file: str = ""

    @property
    def success_rate(self) -> float:
        if self.parsed == 0:
            return 0.0
        return self.stored / self.parsed

    def summary(self) -> str:
        mode = " [DRY RUN]" if self.dry_run else ""
        return (
            f"Import{mode}: parsed={self.parsed} valid={self.valid} "
            f"mapped={self.mapped} stored={self.stored} "
            f"skipped={self.skipped} errors={len(self.errors)}"
        )

    def to_dict(self) -> dict:
        return {
            "parsed": self.parsed,
            "valid": self.valid,
            "mapped": self.mapped,
            "stored": self.stored,
            "skipped": self.skipped,
            "error_count": len(self.errors),
            "errors": [{"node_id": nid, "error": msg} for nid, msg in self.errors],
            "dry_run": self.dry_run,
            "source_file": self.source_file,
            "success_rate": round(self.success_rate, 4),
        }
