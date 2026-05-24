"""
TexasSolver output parser — converts solver JSON output to RawSolverNode.

parse_texassolver_output(path, config) → list[RawSolverNode]

TexasSolver outputs a JSON tree with strategy data per node.
This parser extracts the root IP and OOP decision nodes and converts
them into the existing RawSolverNode format used by the import pipeline.

The parser handles:
  - JSON output from TexasSolver's dump_result command
  - Both IP and OOP strategy extraction
  - Action frequency normalization
  - Combo-level data extraction when available
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.solver_import.models import RawAction, RawComboEntry, RawSolverNode

from .config import SolverConfig

logger = logging.getLogger(__name__)


def _normalize_action_name(raw_action: str) -> str:
    """
    Normalize TexasSolver action names to match existing pipeline format.

    TexasSolver uses:
      "CHECK"           → "check"
      "CALL"            → "call"
      "FOLD"            → "fold"
      "BET 33"          → "bet_33pct"
      "BET 50"          → "bet_50pct"
      "BET 75"          → "bet_75pct"
      "BET 100"         → "bet_100pct"
      "RAISE 50"        → "raise_50pct"
      "RAISE 75"        → "raise_75pct"
      "ALLIN"           → "bet_allin"
    """
    raw = raw_action.strip().upper()

    if raw == "CHECK":
        return "check"
    if raw == "CALL":
        return "call"
    if raw == "FOLD":
        return "fold"
    if raw == "ALLIN":
        return "bet_allin"

    if raw.startswith("BET "):
        size = raw.split(" ", 1)[1].strip()
        return f"bet_{size}pct"

    if raw.startswith("RAISE "):
        size = raw.split(" ", 1)[1].strip()
        return f"raise_{size}pct"

    # Fallback: lowercase
    return raw.lower().replace(" ", "_")


def _parse_strategy_node(
    node_data: dict,
    *,
    node_id: str,
    board: str,
    position: str,
    pot_chips: float,
    stack_chips: float,
    street: str,
    spot_type: str,
    source_file: str,
) -> RawSolverNode | None:
    """
    Parse a single strategy node from TexasSolver JSON output.

    node_data format (TexasSolver):
    {
        "actions": ["CHECK", "BET 33", "BET 75"],
        "strategy": [0.45, 0.35, 0.20],
        "childrens": [...],
        "combos": {
            "AhKs": {"actions": [0.2, 0.5, 0.3], "equity": 0.72, "ev": 3.5},
            ...
        }
    }
    """
    if not node_data:
        return None

    action_names = node_data.get("actions", [])
    strategy = node_data.get("strategy", [])

    if not action_names or not strategy:
        return None

    if len(action_names) != len(strategy):
        logger.warning(
            "[parser] action/strategy length mismatch in node %s: %d vs %d",
            node_id, len(action_names), len(strategy),
        )
        return None

    # Build RawAction list
    actions: list[RawAction] = []
    for name, freq in zip(action_names, strategy):
        normalized = _normalize_action_name(name)
        actions.append(RawAction(
            action_name=normalized,
            frequency=float(freq),
            ev_chips=None,
        ))

    # Build combo entries if available
    combos: list[RawComboEntry] = []
    combo_data = node_data.get("combos", {})
    if isinstance(combo_data, dict):
        for combo_str, combo_info in combo_data.items():
            if not isinstance(combo_info, dict):
                continue
            combo_actions_freq = combo_info.get("actions", [])
            combo_equity = combo_info.get("equity")
            combo_ev = combo_info.get("ev")

            combo_actions = []
            for name, freq in zip(action_names, combo_actions_freq):
                normalized = _normalize_action_name(name)
                combo_actions.append(RawAction(
                    action_name=normalized,
                    frequency=float(freq),
                ))

            combos.append(RawComboEntry(
                combo=combo_str,
                actions=combo_actions,
                equity=float(combo_equity) if combo_equity is not None else None,
                ev_chips=float(combo_ev) if combo_ev is not None else None,
            ))

    return RawSolverNode(
        node_id=node_id,
        board=board,
        position=position,
        pot_chips=pot_chips,
        stack_chips=stack_chips,
        street=street,
        spot_type=spot_type,
        actions=actions,
        combos=combos,
        source_file=source_file,
    )


def parse_texassolver_output(
    path: str | Path,
    config: SolverConfig,
) -> list[RawSolverNode]:
    """
    Parse TexasSolver JSON output into RawSolverNode list.

    Extracts both IP and OOP root decision nodes from the solver output.

    Args:
        path:   Path to the TexasSolver JSON output file.
        config: SolverConfig used for the solve (for metadata).

    Returns:
        List of RawSolverNode — typically 2 nodes (IP root + OOP root).

    Raises:
        FileNotFoundError: If the output file doesn't exist.
        ValueError: If the output format is invalid.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Solver output not found: {path}")

    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in solver output: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object at root, got {type(data).__name__}")

    board = config.board_string()
    pot_chips = config.pot_size_bb()
    stack_chips = config.effective_stack_chips()
    street = "flop" if len(config.board) == 3 else "turn" if len(config.board) == 4 else "river"
    source_file = str(path)

    nodes: list[RawSolverNode] = []

    # TexasSolver output structure:
    # {
    #   "ip_strategy": { ... root IP node ... },
    #   "oop_strategy": { ... root OOP node ... },
    #   "meta": { "iterations": ..., "exploitability": ... }
    # }
    #
    # Alternative flat structure:
    # {
    #   "root": {
    #     "ip": { ... },
    #     "oop": { ... }
    #   }
    # }

    ip_data = data.get("ip_strategy") or (data.get("root", {}).get("ip"))
    oop_data = data.get("oop_strategy") or (data.get("root", {}).get("oop"))

    if ip_data:
        ip_node = _parse_strategy_node(
            ip_data,
            node_id=f"texassolver_ip_{config.positions}",
            board=board,
            position=config.ip_position(),
            pot_chips=pot_chips,
            stack_chips=stack_chips,
            street=street,
            spot_type=config.spot_type,
            source_file=source_file,
        )
        if ip_node:
            nodes.append(ip_node)

    if oop_data:
        oop_node = _parse_strategy_node(
            oop_data,
            node_id=f"texassolver_oop_{config.positions}",
            board=board,
            position=config.oop_position(),
            pot_chips=pot_chips,
            stack_chips=stack_chips,
            street=street,
            spot_type=config.spot_type,
            source_file=source_file,
        )
        if oop_node:
            nodes.append(oop_node)

    logger.info(
        "[parser] parsed %d nodes from %s (board=%s)",
        len(nodes), path, board,
    )
    return nodes
