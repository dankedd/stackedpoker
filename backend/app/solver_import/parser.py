"""
GTO+ CSV export parser.

parse_gto_export(path) → list[RawSolverNode]

Supports two export formats:
  1. Node-level  — one row per (node_id, action); actions are pre-aggregated
                   across the full range at that node.
  2. Combo-level — one row per (node_id, combo, action); per-hand frequencies.

The format is auto-detected from column presence:
  - Combo-level: has "combo" column
  - Node-level:  no "combo" column

Required columns (both formats):
  node_id, board, position, pot_chips, stack_chips, street, spot_type,
  action_name, frequency

Optional columns:
  ev_chips    — node-level EV
  combo       — hand combo string (combo-level only)
  equity      — combo equity (combo-level only)

Lines starting with "#" are treated as comments and skipped.
"""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import TextIO

from .models import RawAction, RawComboEntry, RawSolverNode

_REQUIRED_COLS = {
    "node_id", "board", "position", "pot_chips", "stack_chips",
    "street", "spot_type", "action_name", "frequency",
}


def parse_gto_export(path: str | Path) -> list[RawSolverNode]:
    """
    Parse a GTO+ CSV export file into a list of RawSolverNode objects.

    Each row in the CSV represents one action at one node (node-level) or
    one combo's action at one node (combo-level). Rows sharing the same
    node_id are grouped into a single RawSolverNode.

    Args:
        path: Path to the CSV file.

    Returns:
        List of RawSolverNode, one per unique node_id. Ordered by node_id.

    Raises:
        FileNotFoundError: If the path does not exist.
        ValueError: If required columns are missing.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Solver export not found: {path}")

    with path.open("r", encoding="utf-8", newline="") as fh:
        return _parse_fh(fh, source_file=str(path))


def parse_gto_export_string(content: str, source_file: str = "") -> list[RawSolverNode]:
    """
    Parse a GTO+ CSV export from a string (useful for testing).

    Args:
        content: CSV content as a string.
        source_file: Optional source label for provenance.

    Returns:
        List of RawSolverNode.
    """
    fh = io.StringIO(content)
    return _parse_fh(fh, source_file=source_file)


def _parse_fh(fh: TextIO, source_file: str) -> list[RawSolverNode]:
    """Internal: parse from a file-like object, stripping comment lines."""
    # Strip comment lines (start with '#') while preserving header
    clean_lines = [line for line in fh if not line.lstrip().startswith("#")]
    if not clean_lines:
        return []

    reader = csv.DictReader(clean_lines)
    if reader.fieldnames is None:
        return []

    headers = {h.strip() for h in reader.fieldnames}
    missing = _REQUIRED_COLS - headers
    if missing:
        raise ValueError(
            f"Missing required columns in solver export: {missing!r}"
        )

    is_combo_level = "combo" in headers

    # Group rows by node_id
    node_rows: dict[str, list[dict]] = {}
    for row in reader:
        nid = row["node_id"].strip()
        node_rows.setdefault(nid, []).append(row)

    nodes: list[RawSolverNode] = []
    for nid, rows in node_rows.items():
        node = _build_node(nid, rows, is_combo_level, source_file)
        nodes.append(node)

    return nodes


def _build_node(
    node_id: str,
    rows: list[dict],
    is_combo_level: bool,
    source_file: str,
) -> RawSolverNode:
    """Build a RawSolverNode from grouped CSV rows."""
    # All rows for a node share the same metadata — use the first row
    first = rows[0]

    node = RawSolverNode(
        node_id=node_id,
        board=first["board"].strip(),
        position=first["position"].strip(),
        pot_chips=float(first["pot_chips"]),
        stack_chips=float(first["stack_chips"]),
        street=first["street"].strip().lower(),
        spot_type=first["spot_type"].strip().upper(),
        source_file=source_file,
    )

    if is_combo_level:
        node.combos = _build_combos(rows)
        # Also aggregate node-level actions from combo data for convenience
        node.actions = _aggregate_actions_from_combos(node.combos)
    else:
        node.actions = _build_actions(rows)

    return node


def _build_actions(rows: list[dict]) -> list[RawAction]:
    """Build action list from node-level rows (one action per row)."""
    actions = []
    for row in rows:
        ev_raw = row.get("ev_chips", "").strip()
        ev = float(ev_raw) if ev_raw else None
        actions.append(RawAction(
            action_name=row["action_name"].strip(),
            frequency=float(row["frequency"]),
            ev_chips=ev,
        ))
    return actions


def _build_combos(rows: list[dict]) -> list[RawComboEntry]:
    """Build per-combo entries from combo-level rows."""
    # Group rows by combo
    combo_rows: dict[str, list[dict]] = {}
    for row in rows:
        combo = row.get("combo", "").strip()
        combo_rows.setdefault(combo, []).append(row)

    combos = []
    for combo, c_rows in combo_rows.items():
        first = c_rows[0]
        equity_raw = first.get("equity", "").strip()
        ev_raw = first.get("ev_chips", "").strip()
        entry = RawComboEntry(
            combo=combo,
            equity=float(equity_raw) if equity_raw else None,
            ev_chips=float(ev_raw) if ev_raw else None,
        )
        entry.actions = _build_actions(c_rows)
        combos.append(entry)
    return combos


def _aggregate_actions_from_combos(combos: list[RawComboEntry]) -> list[RawAction]:
    """
    Aggregate combo-level action frequencies to node-level estimates.

    Simple average across all combos (uniform combo weight).
    This is an approximation — real weighting requires range weight data.
    """
    if not combos:
        return []

    action_totals: dict[str, float] = {}
    for combo in combos:
        for action in combo.actions:
            action_totals[action.action_name] = (
                action_totals.get(action.action_name, 0.0) + action.frequency
            )

    n = len(combos)
    return [
        RawAction(action_name=name, frequency=total / n)
        for name, total in action_totals.items()
    ]
