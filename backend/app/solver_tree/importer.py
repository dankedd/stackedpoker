"""
Recursive DFS tree importer — walks TexasSolver game tree JSON and
produces a flat list of normalized SolverNode objects.

import_solve_tree(data, solve_id, config) → list[SolverNode]

Design:
  - Iterative DFS with explicit stack (no Python recursion limit issues)
  - Deterministic node IDs from (solve_id, board, action_path)
  - Parent/child references wired after all nodes created
  - Duplicate detection via seen-set on node IDs
  - Max depth guard (configurable, default 50)
  - Solver-agnostic: only reads generic tree structure
  - Chance nodes correctly handled as non-terminal with street transitions
  - Board state updates when chance nodes deal new cards
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .models import (
    SolverNode,
    encode_action,
    make_human_path,
    make_node_id,
)

logger = logging.getLogger(__name__)

# Safety limits
MAX_TREE_DEPTH = 50
MAX_NODES = 100_000


@dataclass
class TreeImportResult:
    """Summary of a tree import operation."""
    nodes: list[SolverNode]
    root_id: str
    action_nodes: int = 0
    chance_nodes: int = 0
    terminal_nodes: int = 0
    max_depth: int = 0
    duplicates_skipped: int = 0

    @property
    def total(self) -> int:
        return len(self.nodes)

    def summary(self) -> str:
        return (
            f"TreeImport: {self.total} nodes "
            f"(action={self.action_nodes} chance={self.chance_nodes} "
            f"terminal={self.terminal_nodes}) "
            f"depth={self.max_depth} dupes={self.duplicates_skipped}"
        )


def _detect_street(board: list[str]) -> str:
    """Determine street from board card count."""
    n = len(board)
    if n <= 0:
        return "preflop"
    if n <= 3:
        return "flop"
    if n == 4:
        return "turn"
    return "river"


def _next_street(current: str) -> str:
    """Return the street that follows `current`."""
    order = {"preflop": "flop", "flop": "turn", "turn": "river"}
    return order.get(current, "river")


def _player_to_actor(player: int | None) -> str | None:
    """Convert TexasSolver player number to actor label."""
    if player == 0:
        return "ip"
    if player == 1:
        return "oop"
    return None


def _extract_strategy(
    raw_node: dict,
    pot_size: float = 0.0,
    effective_stack: float = 0.0,
) -> tuple[dict[str, list[float]], list[str], int]:
    """
    Extract per-combo strategy and action list from a v0.2.0 node.

    Returns:
      (strategy_dict, action_names, combo_count)

    strategy_dict: {combo_str: [freq_a0, freq_a1, ...]}
    action_names:  ["x", "b33"] (encoded with pot-relative labels)
    combo_count:   number of combos
    """
    strat_block = raw_node.get("strategy")
    if not isinstance(strat_block, dict):
        return {}, [], 0

    raw_actions = strat_block.get("actions", [])
    combo_data = strat_block.get("strategy", {})

    if not raw_actions or not isinstance(combo_data, dict):
        return {}, [], 0

    encoded_actions = [encode_action(a, pot_size, effective_stack) for a in raw_actions]

    strategy: dict[str, list[float]] = {}
    for combo_str, freq_list in combo_data.items():
        if isinstance(freq_list, list) and len(freq_list) == len(raw_actions):
            strategy[combo_str] = [round(f, 6) for f in freq_list]

    return strategy, encoded_actions, len(strategy)


def _compute_aggregate(
    strategy: dict[str, list[float]],
    action_names: list[str],
) -> dict[str, float]:
    """Average per-combo frequencies to get aggregate action frequencies."""
    if not strategy or not action_names:
        return {}
    n = len(strategy)
    sums = [0.0] * len(action_names)
    for freq_list in strategy.values():
        for i, f in enumerate(freq_list):
            sums[i] += f
    return {
        action_names[i]: round(sums[i] / n, 6)
        for i in range(len(action_names))
    }


# ── DFS stack entry ─────────────────────────────────────────────────────────
# (raw_node_dict, parent_id, action_tokens, current_board, current_street)
_StackEntry = tuple[dict, str | None, list[str], list[str], str]


def import_solve_tree(
    data: dict,
    solve_id: str,
    board: list[str],
    pot_size: float = 0.0,
    effective_stack: float = 0.0,
    *,
    max_depth: int = MAX_TREE_DEPTH,
    max_nodes: int = MAX_NODES,
) -> TreeImportResult:
    """
    Walk the entire TexasSolver game tree via iterative DFS and produce
    normalized SolverNode objects.

    Args:
        data:      Raw JSON dict from TexasSolver solve_output.json.
        solve_id:  Unique identifier for this solve (e.g. job_id).
        board:     Board cards, e.g. ["Jh", "9c", "4d"].
        pot_size:  Starting pot in BB.
        max_depth: Safety limit on tree depth.
        max_nodes: Safety limit on total nodes.

    Returns:
        TreeImportResult with all nodes and summary stats.
    """
    board_str = " ".join(board)
    street = _detect_street(board)

    nodes: list[SolverNode] = []
    seen_ids: set[str] = set()
    stats = {"action": 0, "chance": 0, "terminal": 0, "max_depth": 0, "dupes": 0}

    # ── Iterative DFS stack ──────────────────────────────────────────────
    stack: list[_StackEntry] = [
        (data, None, [], list(board), street),
    ]

    while stack:
        if len(nodes) >= max_nodes:
            logger.warning(
                "[TreeImporter] hit max_nodes=%d, stopping traversal", max_nodes,
            )
            break

        raw_node, parent_id, action_tokens, cur_board, cur_street = stack.pop()

        if not isinstance(raw_node, dict):
            continue

        depth = len(action_tokens)
        if depth > max_depth:
            logger.warning("[TreeImporter] depth %d exceeds max_depth=%d", depth, max_depth)
            continue

        stats["max_depth"] = max(stats["max_depth"], depth)

        # ── Determine node type ──────────────────────────────────────────
        raw_type = raw_node.get("node_type", "")
        is_action = raw_type == "action_node"
        is_chance = raw_type == "chance_node"
        is_terminal = not is_action and not is_chance

        if is_action:
            stats["action"] += 1
        elif is_chance:
            stats["chance"] += 1
        else:
            stats["terminal"] += 1

        # ── Build action path ────────────────────────────────────────────
        action_path = "-".join(action_tokens) if action_tokens else ""

        # ── Board string for ID — uses current board state ───────────────
        cur_board_str = " ".join(cur_board)

        # ── Generate deterministic ID ────────────────────────────────────
        node_id = make_node_id(solve_id, cur_board_str, action_path)

        if node_id in seen_ids:
            stats["dupes"] += 1
            continue
        seen_ids.add(node_id)

        # ── Extract strategy data ────────────────────────────────────────
        strategy, encoded_actions, combo_count = ({}, [], 0)
        if is_action:
            strategy, encoded_actions, combo_count = _extract_strategy(
                raw_node, pot_size, effective_stack,
            )

        aggregate = _compute_aggregate(strategy, encoded_actions)

        # ── Determine available actions from childrens ───────────────────
        childrens = raw_node.get("childrens", {})
        if is_action:
            available_actions = [encode_action(a, pot_size, effective_stack) for a in childrens.keys()]
        elif is_chance:
            # Chance node children are keyed by dealt card
            available_actions = list(childrens.keys())
        else:
            available_actions = []

        # ── Build human-readable path ────────────────────────────────────
        human_path = make_human_path(cur_board_str, action_tokens)

        # ── Create SolverNode ────────────────────────────────────────────
        node = SolverNode(
            id=node_id,
            solve_id=solve_id,
            human_path=human_path,
            parent_id=parent_id,
            children_ids=[],  # wired in second pass
            action_history=list(action_tokens),
            action_path=action_path,
            depth=depth,
            street=cur_street,
            board=list(cur_board),
            pot_size=pot_size,
            actor=_player_to_actor(raw_node.get("player")),
            available_actions=available_actions,
            is_terminal=is_terminal,
            strategy=strategy,
            aggregate_freqs=aggregate,
            combo_count=combo_count,
            node_type="action" if is_action else "chance" if is_chance else "terminal",
            raw_player=raw_node.get("player"),
        )
        nodes.append(node)

        # ── Push children onto stack (reversed for correct DFS order) ────
        if is_chance:
            # Chance node children represent dealt cards → advance street
            child_street = _next_street(cur_street)
            child_items = list(childrens.items())
            for card_key, child_data in reversed(child_items):
                child_board = cur_board + [card_key]
                child_tokens = action_tokens + [card_key.lower()]
                stack.append((child_data, node_id, child_tokens, child_board, child_street))
        else:
            child_items = list(childrens.items())
            for action_name, child_data in reversed(child_items):
                child_tokens = action_tokens + [encode_action(action_name, pot_size, effective_stack)]
                stack.append((child_data, node_id, child_tokens, cur_board, cur_street))

    # ── Second pass: wire children_ids ───────────────────────────────────
    id_to_node = {n.id: n for n in nodes}
    for node in nodes:
        if node.parent_id and node.parent_id in id_to_node:
            parent = id_to_node[node.parent_id]
            if node.id not in parent.children_ids:
                parent.children_ids.append(node.id)

    root_id = nodes[0].id if nodes else ""

    result = TreeImportResult(
        nodes=nodes,
        root_id=root_id,
        action_nodes=stats["action"],
        chance_nodes=stats["chance"],
        terminal_nodes=stats["terminal"],
        max_depth=stats["max_depth"],
        duplicates_skipped=stats["dupes"],
    )

    logger.info("[TreeImporter] %s (solve=%s, board=%s)", result.summary(), solve_id, board_str)
    return result
