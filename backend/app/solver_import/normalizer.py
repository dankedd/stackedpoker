"""
Normalizer for raw solver nodes.

normalize(nodes) → (valid: list[RawSolverNode], errors: list[tuple[str, str]])

Responsibilities:
  1. Validate required fields are non-empty and in expected ranges.
  2. Normalize action names to a canonical form (e.g. "Bet 33%" → "bet_33pct").
  3. Validate frequency sums (with tolerance).
  4. Scope-filter: only BTN vs BB, SRP, 100bb, flop (MVP scope).
  5. De-duplicate nodes (same node_id appears twice → keep last).

MVP scope filter — nodes are skipped (not errored) if:
  - spot_type != "SRP"
  - street != "flop"
  - position not in {"BTN", "BB"}
"""

from __future__ import annotations

import re

from .models import RawSolverNode, RawAction

# ── Constants ─────────────────────────────────────────────────────────────────

# MVP scope: only these values are accepted
_MVP_SPOT_TYPES   = {"SRP"}
_MVP_STREETS      = {"flop"}
_MVP_POSITIONS    = {"BTN", "BB"}

_FREQ_TOLERANCE   = 0.02   # frequencies may not sum exactly to 1.0
_MIN_POT          = 0.1    # chips
_MIN_STACK        = 0.1    # chips

# ── Action name normalization ─────────────────────────────────────────────────
# Maps raw solver action strings to canonical sizing labels used in StrategyNode.

_BET_PCT_PATTERN   = re.compile(r"[Bb]et\s+(\d+)%")
_RAISE_X_PATTERN   = re.compile(r"[Rr]aise\s+([\d.]+)x")
_BET_CHIPS_PATTERN = re.compile(r"[Bb]et\s+([\d.]+)")

def normalize_action_name(raw: str) -> str:
    """
    Normalize a GTO+ action label to a canonical sizing string.

    Examples:
      "Bet 33%"    → "bet_33pct"
      "Bet 50%"    → "bet_50pct"
      "Bet 75%"    → "bet_75pct"
      "Bet 100%"   → "bet_100pct"
      "Check"      → "check"
      "Raise 2.5x" → "raise_2.5x"
      "Fold"       → "fold"
      "Call"       → "call"
    """
    s = raw.strip()

    m = _BET_PCT_PATTERN.match(s)
    if m:
        return f"bet_{m.group(1)}pct"

    m = _RAISE_X_PATTERN.match(s)
    if m:
        return f"raise_{m.group(1)}x"

    m = _BET_CHIPS_PATTERN.match(s)
    if m:
        return f"bet_{m.group(1)}chips"

    return s.lower().replace(" ", "_")


def _primary_sizing_from_actions(actions: list[RawAction]) -> str | None:
    """
    Derive a primary sizing label from the highest-frequency bet/raise action.

    Returns None if no bet/raise action exists.
    """
    bet_actions = [
        a for a in actions
        if a.action_name.startswith("bet_") or a.action_name.startswith("raise_")
    ]
    if not bet_actions:
        return None
    return max(bet_actions, key=lambda a: a.frequency).action_name


# ── Validation helpers ────────────────────────────────────────────────────────

def _validate_node(node: RawSolverNode) -> str | None:
    """
    Validate a single node.  Returns an error string or None if valid.
    """
    if not node.board.strip():
        return "empty board"
    if not node.position.strip():
        return "empty position"
    if node.pot_chips < _MIN_POT:
        return f"pot_chips too small: {node.pot_chips}"
    if node.stack_chips < _MIN_STACK:
        return f"stack_chips too small: {node.stack_chips}"
    if not node.actions:
        return "no actions"
    total = node.total_frequency
    if abs(total - 1.0) > _FREQ_TOLERANCE:
        return f"action frequencies sum to {total:.4f} (expected ~1.0)"
    return None


def _in_mvp_scope(node: RawSolverNode) -> bool:
    """Return True if the node falls within MVP import scope."""
    if node.spot_type not in _MVP_SPOT_TYPES:
        return False
    if node.street not in _MVP_STREETS:
        return False
    if node.position not in _MVP_POSITIONS:
        return False
    return True


# ── Public API ────────────────────────────────────────────────────────────────

def normalize(
    nodes: list[RawSolverNode],
) -> tuple[list[RawSolverNode], list[tuple[str, str]]]:
    """
    Normalize and validate a list of raw solver nodes.

    Returns:
        (valid_nodes, errors)
        valid_nodes — de-duplicated, scope-filtered, normalized nodes
        errors      — list of (node_id, error_message) for invalid nodes
    """
    errors: list[tuple[str, str]] = []
    seen_ids: dict[str, RawSolverNode] = {}
    out: list[RawSolverNode] = []

    for node in nodes:
        # Scope filter — skip silently (not an error)
        if not _in_mvp_scope(node):
            continue

        # Normalize action names in-place
        for action in node.actions:
            action.action_name = normalize_action_name(action.action_name)
        for combo in node.combos:
            for action in combo.actions:
                action.action_name = normalize_action_name(action.action_name)

        # Validate after normalization
        err = _validate_node(node)
        if err:
            errors.append((node.node_id, err))
            continue

        # De-duplicate by node_id (last wins)
        seen_ids[node.node_id] = node

    out = list(seen_ids.values())
    return out, errors
