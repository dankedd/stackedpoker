"""
TexasSolver output parser — converts solver JSON output to RawSolverNode.

parse_texassolver_output(path, config) → list[RawSolverNode]

TexasSolver v0.2.0 outputs a nested game tree JSON where the root is the
first decision node (OOP, player=1). Each action_node has:
  - player: 0 (IP) or 1 (OOP)
  - actions: ["CHECK", "BET 96.000000"]
  - strategy: { "actions": [...], "strategy": { "AhKs": [freq_a, freq_b], ... } }
  - childrens: { "CHECK": { ... }, "BET 96.000000": { ... } }

This parser walks the game tree and extracts root-level decision nodes
for both IP and OOP, converting them into RawSolverNode format used by
the import pipeline.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.solver_import.models import RawAction, RawComboEntry, RawSolverNode

from .config import SolverConfig

logger = logging.getLogger(__name__)


def _normalize_action_name(
    raw_action: str,
    pot_size: float = 0.0,
    effective_stack: float = 0.0,
) -> str:
    """
    Normalize TexasSolver action names to human-readable format.

    TexasSolver v0.2.0 outputs bet/raise sizes in CHIPS (BB), not pot %.
    We convert to pot-relative percentages for display:
      "BET 2.000000" with pot=6.5 → bet is 2/6.5 = 31% pot → "bet_33pct"
      "BET 96.000000" with stack=96.8 → near all-in → "bet_allin"
      "RAISE 8.000000" with pot=6.5 → raise to 8 BB → "raise_Xpct"

    When pot_size is not available, falls back to raw chip labels.
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
        size_str = raw.split(" ", 1)[1].strip()
        try:
            chips = float(size_str)
            # Detect all-in: if bet >= 90% of effective stack
            if effective_stack > 0 and chips >= effective_stack * 0.90:
                return "bet_allin"
            # Convert to pot percentage
            if pot_size > 0:
                pct = int(round(chips / pot_size * 100))
                return f"bet_{pct}pct"
            return f"bet_{int(round(chips))}bb"
        except ValueError:
            return f"bet_{size_str}"

    if raw.startswith("RAISE "):
        size_str = raw.split(" ", 1)[1].strip()
        try:
            chips = float(size_str)
            if effective_stack > 0 and chips >= effective_stack * 0.90:
                return "raise_allin"
            if pot_size > 0:
                pct = int(round(chips / pot_size * 100))
                return f"raise_{pct}pct"
            return f"raise_{int(round(chips))}bb"
        except ValueError:
            return f"raise_{size_str}"

    return raw.lower().replace(" ", "_")


def _extract_node_from_v020(
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
    Extract a RawSolverNode from a TexasSolver v0.2.0 action_node.

    v0.2.0 strategy structure:
    {
        "actions": ["CHECK", "BET 96.000000"],
        "strategy": {
            "actions": ["CHECK", "BET 96.000000"],
            "strategy": {
                "AhKs": [0.55, 0.45],
                "QdQc": [0.90, 0.10],
                ...
            }
        }
    }

    Per-combo frequencies are in strategy.strategy — a dict of
    hand_string → list[float] where each float corresponds to the action
    at the same index in strategy.actions.

    We compute aggregate action frequencies by averaging across all combos.
    """
    if not node_data or node_data.get("node_type") != "action_node":
        return None

    strategy_block = node_data.get("strategy")
    if not isinstance(strategy_block, dict):
        return None

    action_names = strategy_block.get("actions", [])
    combo_strategies = strategy_block.get("strategy", {})

    if not action_names or not combo_strategies:
        return None

    num_actions = len(action_names)

    # Compute aggregate frequencies by averaging across all combos
    freq_sums = [0.0] * num_actions
    combo_count = 0

    combos: list[RawComboEntry] = []

    for combo_str, freq_list in combo_strategies.items():
        if not isinstance(freq_list, list) or len(freq_list) != num_actions:
            continue

        combo_count += 1
        for i, freq in enumerate(freq_list):
            freq_sums[i] += float(freq)

        # Build per-combo action list
        combo_actions = []
        for i, name in enumerate(action_names):
            combo_actions.append(RawAction(
                action_name=_normalize_action_name(name, pot_chips, stack_chips),
                frequency=float(freq_list[i]),
            ))

        combos.append(RawComboEntry(
            combo=combo_str,
            actions=combo_actions,
            equity=None,
            ev_chips=None,
        ))

    if combo_count == 0:
        return None

    # Compute average frequencies
    avg_freqs = [s / combo_count for s in freq_sums]

    # Build aggregate RawAction list
    actions: list[RawAction] = []
    for name, freq in zip(action_names, avg_freqs):
        actions.append(RawAction(
            action_name=_normalize_action_name(name, pot_chips, stack_chips),
            frequency=freq,
            ev_chips=None,
        ))

    logger.debug(
        "[parser] extracted node %s: %d combos, actions=%s, freqs=%s",
        node_id, combo_count,
        [a.action_name for a in actions],
        [f"{a.frequency:.3f}" for a in actions],
    )

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


def _walk_game_tree(
    node_data: dict,
    target_player: int,
    path_prefix: str = "root",
) -> dict | None:
    """
    Walk the v0.2.0 game tree to find the primary action_node for target_player.

    The root is typically player 1 (OOP). To find the IP root decision,
    we prefer the node reached through CHECK (IP's main decision when
    checked to) over the node after BET (IP facing a bet = just CALL/FOLD).

    Returns the node dict for the best action_node matching target_player,
    or None if not found.
    """
    if not isinstance(node_data, dict):
        return None

    if node_data.get("node_type") == "action_node":
        if node_data.get("player") == target_player:
            return node_data

        # Recurse into children — prefer CHECK path over BET/RAISE paths
        # so we find the main decision node, not the facing-a-bet node.
        childrens = node_data.get("childrens", {})
        sorted_actions = sorted(
            childrens.keys(),
            key=lambda a: (0 if a.upper() == "CHECK" else 1),
        )
        for action_name in sorted_actions:
            child = childrens[action_name]
            result = _walk_game_tree(child, target_player, f"{path_prefix}/{action_name}")
            if result is not None:
                return result

    return None


def parse_texassolver_output(
    path: str | Path,
    config: SolverConfig,
) -> list[RawSolverNode]:
    """
    Parse TexasSolver JSON output into RawSolverNode list.

    Handles TexasSolver v0.2.0 game tree format:
    - Root is an action_node for the first player to act (usually OOP, player=1)
    - IP nodes are found by walking into the children
    - Strategy data is per-combo in strategy.strategy dict

    Args:
        path:   Path to the TexasSolver JSON output file.
        config: SolverConfig used for the solve (for metadata).

    Returns:
        List of RawSolverNode — typically 2 nodes (OOP root + IP root).
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

    # Detect output format
    root_keys = list(data.keys())
    logger.info(
        "[parser] schema detection: root_keys=%s (file=%s)",
        root_keys, path.name,
    )

    # ── v0.2.0 game tree format ──────────────────────────────────────────
    # Root is an action_node with player, actions, strategy, childrens
    if "node_type" in data and data.get("node_type") == "action_node":
        logger.info("[parser] detected TexasSolver v0.2.0 game tree format")

        # Extract OOP node (player=1, first to act in SRP)
        oop_data = _walk_game_tree(data, target_player=1)
        if oop_data:
            oop_node = _extract_node_from_v020(
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
                    "[parser] OOP node: %d combos, %d actions, freqs=%s",
                    len(oop_node.combos), len(oop_node.actions),
                    {a.action_name: f"{a.frequency:.3f}" for a in oop_node.actions},
                )
        else:
            logger.warning("[parser] no OOP node (player=1) found in game tree")

        # Extract IP node (player=0)
        ip_data = _walk_game_tree(data, target_player=0)
        if ip_data:
            ip_node = _extract_node_from_v020(
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
                logger.info(
                    "[parser] IP node: %d combos, %d actions, freqs=%s",
                    len(ip_node.combos), len(ip_node.actions),
                    {a.action_name: f"{a.frequency:.3f}" for a in ip_node.actions},
                )
        else:
            logger.warning("[parser] no IP node (player=0) found in game tree")

    # ── Legacy flat format (ip_strategy / oop_strategy) ──────────────────
    elif "ip_strategy" in data or "oop_strategy" in data:
        logger.info("[parser] detected legacy flat format (ip_strategy/oop_strategy)")
        ip_data = data.get("ip_strategy") or (data.get("root", {}).get("ip"))
        oop_data = data.get("oop_strategy") or (data.get("root", {}).get("oop"))

        if ip_data:
            ip_node = _extract_legacy_node(
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
            oop_node = _extract_legacy_node(
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

    else:
        logger.warning(
            "[parser] unrecognized output format: root_keys=%s", root_keys,
        )

    logger.info(
        "[parser] parsed %d nodes from %s (board=%s, schema=%s)",
        len(nodes), path.name, board,
        "v0.2.0_tree" if "node_type" in data else "legacy",
    )
    return nodes


def _extract_legacy_node(
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
    """Parse a node from the legacy ip_strategy/oop_strategy format."""
    if not node_data:
        return None

    action_names = node_data.get("actions", [])
    strategy = node_data.get("strategy", [])

    if not action_names or not strategy:
        return None

    if isinstance(strategy, list) and len(action_names) != len(strategy):
        return None

    actions: list[RawAction] = []
    if isinstance(strategy, list):
        for name, freq in zip(action_names, strategy):
            actions.append(RawAction(
                action_name=_normalize_action_name(name, pot_chips, stack_chips),
                frequency=float(freq),
            ))
    elif isinstance(strategy, dict):
        # Handle dict-based strategy (same as v0.2.0 combo format)
        return _extract_node_from_v020(
            {"node_type": "action_node", "strategy": node_data},
            node_id=node_id, board=board, position=position,
            pot_chips=pot_chips, stack_chips=stack_chips,
            street=street, spot_type=spot_type, source_file=source_file,
        )

    combos: list[RawComboEntry] = []
    combo_data = node_data.get("combos", {})
    if isinstance(combo_data, dict):
        for combo_str, combo_info in combo_data.items():
            if not isinstance(combo_info, dict):
                continue
            combo_actions = []
            for name, freq in zip(action_names, combo_info.get("actions", [])):
                combo_actions.append(RawAction(
                    action_name=_normalize_action_name(name, pot_chips, stack_chips),
                    frequency=float(freq),
                ))
            combos.append(RawComboEntry(
                combo=combo_str,
                actions=combo_actions,
                equity=combo_info.get("equity"),
                ev_chips=combo_info.get("ev"),
            ))

    return RawSolverNode(
        node_id=node_id, board=board, position=position,
        pot_chips=pot_chips, stack_chips=stack_chips,
        street=street, spot_type=spot_type,
        actions=actions, combos=combos, source_file=source_file,
    )
