"""
Adapter — connects TexasSolver parser output to the existing import pipeline.

import_texassolver_solve(config, solve_result, ...) → ImportResult

This module bridges the TexasSolver output into the same pipeline used by
GTO+ imports:

  RawSolverNode → normalize → map → compress → StrategyNode → store

The only difference vs GTO+ imports:
  1. Source is "texassolver" instead of "gto_plus"
  2. Nodes come from parser.parse_texassolver_output() instead of CSV

ALL existing normalization, mapping, compression, and storage logic is reused.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.solver_import.compressor import compress_solver_node
from app.solver_import.mapper import map_solver_node
from app.solver_import.models import ImportResult, RawSolverNode
from app.solver_import.normalizer import normalize
from app.strategy_db.models import StrategyNode
from app.strategy_db.storage import StrategyStore

from .config import SolverConfig
from .parser import parse_texassolver_output
from .runner import SolveResult

logger = logging.getLogger(__name__)

_TEXASSOLVER_SOURCE = "texassolver"
_TEXASSOLVER_VERSION = "3.0"  # higher than gto_plus (2.0) and handcrafted (1.0)

# Module-level store singleton
_store: StrategyStore | None = None


def _get_store() -> StrategyStore:
    global _store
    if _store is None:
        _store = StrategyStore(seed_on_init=True)
    return _store


def _patch_source(node: StrategyNode) -> StrategyNode:
    """Override source and version to identify TexasSolver origin."""
    node.source = _TEXASSOLVER_SOURCE
    node.version = _TEXASSOLVER_VERSION
    # Update rationale to reflect source
    node.rationale = node.rationale.replace("GTO+ solve", "TexasSolver solve")
    return node


def import_texassolver_solve(
    config: SolverConfig,
    solve_result: SolveResult,
    *,
    dry_run: bool = False,
    store: StrategyStore | None = None,
) -> ImportResult:
    """
    Import a completed TexasSolver solve into the strategy database.

    Uses the existing import pipeline (normalize → map → compress → store)
    with TexasSolver-specific source tagging.

    Args:
        config:       SolverConfig that produced this solve.
        solve_result: SolveResult from run_texassolver().
        dry_run:      If True, parse and validate without writing to DB.
        store:        Optional StrategyStore (defaults to module singleton).

    Returns:
        ImportResult with counts and errors.
    """
    source_file = solve_result.output_path or ""
    result = ImportResult(source_file=source_file, dry_run=dry_run)

    # Must have successful solve with output
    if not solve_result.success:
        result.errors.append((
            "__solve__",
            f"Solve not successful: {solve_result.error or 'unknown error'}",
        ))
        return result

    if not solve_result.output_path:
        result.errors.append(("__solve__", "No output file from solve"))
        return result

    # Step 1: Parse TexasSolver output → RawSolverNode list
    try:
        raw_nodes = parse_texassolver_output(solve_result.output_path, config)
    except FileNotFoundError as exc:
        result.errors.append(("__file__", str(exc)))
        return result
    except ValueError as exc:
        result.errors.append(("__parse__", str(exc)))
        return result

    result.parsed = len(raw_nodes)

    if not raw_nodes:
        result.errors.append(("__parse__", "No valid nodes parsed from output"))
        return result

    # Step 2: Normalize (reuse existing normalizer)
    valid_nodes, norm_errors = normalize(raw_nodes)
    result.valid = len(valid_nodes)
    result.errors.extend(norm_errors)
    result.skipped = result.parsed - result.valid - len(norm_errors)

    # Step 3-5: Map → Compress → Store (reuse existing pipeline)
    target_store = store if store is not None else _get_store()

    for node in valid_nodes:
        # Map to node key
        mapping = map_solver_node(node)
        if mapping is None:
            result.errors.append((
                node.node_id,
                "mapping failed — unknown position or board classification",
            ))
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

        # Patch source to texassolver
        strategy_node = _patch_source(strategy_node)

        # Write to store
        if not dry_run:
            target_store.register_strategy(strategy_node)

        result.stored += 1

    logger.info(
        "[adapter] import complete: %s (board=%s)",
        result.summary(), config.board_string(),
    )
    return result


def import_from_raw_nodes(
    raw_nodes: list[RawSolverNode],
    *,
    dry_run: bool = False,
    store: StrategyStore | None = None,
    source_label: str = "texassolver",
) -> ImportResult:
    """
    Import pre-parsed RawSolverNodes into the strategy database.

    This is the lower-level entry point for when you already have
    RawSolverNode objects (e.g. from fixture data or synthetic generation).

    Reuses the full existing pipeline: normalize → map → compress → store.
    """
    result = ImportResult(source_file=source_label, dry_run=dry_run)
    result.parsed = len(raw_nodes)

    valid_nodes, norm_errors = normalize(raw_nodes)
    result.valid = len(valid_nodes)
    result.errors.extend(norm_errors)
    result.skipped = result.parsed - result.valid - len(norm_errors)

    target_store = store if store is not None else _get_store()

    for node in valid_nodes:
        mapping = map_solver_node(node)
        if mapping is None:
            result.errors.append((node.node_id, "mapping failed"))
            result.skipped += 1
            continue

        node_key_str, is_ip = mapping
        result.mapped += 1

        try:
            strategy_node = compress_solver_node(node, node_key_str, is_ip)
        except Exception as exc:
            result.errors.append((node.node_id, f"compression error: {exc}"))
            continue

        strategy_node = _patch_source(strategy_node)

        if not dry_run:
            target_store.register_strategy(strategy_node)

        result.stored += 1

    return result
