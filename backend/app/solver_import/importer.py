"""
GTO+ Solver Import Pipeline — top-level orchestrator.

import_gto_solve(path, *, dry_run=False) → ImportResult

Full pipeline:
  1. parse_gto_export(path)    → list[RawSolverNode]
  2. normalize(nodes)          → (valid, errors)
  3. map_solver_node(node)     → (node_key_str, is_ip)
  4. compress_solver_node(...) → StrategyNode
  5. StrategyStore.register_strategy(strategy_node)

Usage:
    from app.solver_import.importer import import_gto_solve

    result = import_gto_solve("exports/btn_bb_flop.csv")
    print(result.summary())

    # Dry run (parse + validate without writing to DB):
    result = import_gto_solve("exports/btn_bb_flop.csv", dry_run=True)
"""

from __future__ import annotations

from pathlib import Path

from .models import ImportResult
from .parser import parse_gto_export
from .normalizer import normalize
from .mapper import map_solver_node
from .compressor import compress_solver_node

from app.strategy_db.storage import StrategyStore

# Module-level store singleton (shared with strategy_db.retrieval)
_store: StrategyStore | None = None


def _get_store() -> StrategyStore:
    """Return the shared StrategyStore, initializing with seeds if needed."""
    global _store
    if _store is None:
        _store = StrategyStore(seed_on_init=True)
    return _store


def import_gto_solve(
    path: str | Path,
    *,
    dry_run: bool = False,
    store: StrategyStore | None = None,
) -> ImportResult:
    """
    Import a GTO+ solver export CSV into the strategy database.

    Args:
        path:    Path to the GTO+ export CSV file.
        dry_run: If True, parse and validate without writing to the DB.
        store:   Optional StrategyStore to use (defaults to module singleton).

    Returns:
        ImportResult with counts and any errors.
    """
    path = Path(path)
    result = ImportResult(source_file=str(path), dry_run=dry_run)

    # ── Step 1: Parse ─────────────────────────────────────────────────────────
    try:
        raw_nodes = parse_gto_export(path)
    except FileNotFoundError as e:
        result.errors.append(("__file__", str(e)))
        return result
    except ValueError as e:
        result.errors.append(("__parse__", str(e)))
        return result

    result.parsed = len(raw_nodes)

    # ── Step 2: Normalize + scope filter ──────────────────────────────────────
    valid_nodes, norm_errors = normalize(raw_nodes)
    result.valid  = len(valid_nodes)
    result.errors.extend(norm_errors)
    result.skipped = result.parsed - result.valid - len(norm_errors)

    # ── Step 3–5: Map → Compress → Store ─────────────────────────────────────
    target_store = store if store is not None else _get_store()

    for node in valid_nodes:
        # Map to node key
        mapping = map_solver_node(node)
        if mapping is None:
            result.errors.append((node.node_id, "mapping failed — unknown position or board"))
            result.skipped += 1
            continue

        node_key_str, is_ip = mapping
        result.mapped += 1

        # Compress to StrategyNode
        try:
            strategy_node = compress_solver_node(node, node_key_str, is_ip)
        except Exception as exc:
            result.errors.append((node.node_id, f"compression error: {exc}"))
            continue

        # Write to store (unless dry run)
        if not dry_run:
            target_store.register_strategy(strategy_node)

        result.stored += 1

    return result


def import_stats(store: StrategyStore | None = None) -> dict:
    """
    Return import-related statistics from the store.

    Useful for health checks and debug endpoints.
    """
    target_store = store if store is not None else _get_store()
    stats = target_store.index_stats()
    by_source = {}
    for key in target_store.all_keys():
        # We don't have a direct source index, but we can check by extended key
        node = target_store._nodes.get(key)  # noqa: SLF001
        if node:
            src = node.source
            by_source[src] = by_source.get(src, 0) + 1
    stats["by_source"] = by_source
    return stats
