"""
Seed solve generator — batch generation of initial solver-backed strategies.

generate_seed_solves() → list[(board_label, ImportResult)]

Initial targets (MVP scope):
  - BTN vs BB, SRP, 100bb, flop-only
  - 6 representative board textures:
    1. A_HIGH_DRY   → Ah 7d 2c
    2. A_HIGH_WET   → Ah 9h 8d
    3. LOW_CONNECTED → 8c 7d 6s
    4. MONOTONE     → Jh 8h 4h
    5. PAIRED        → Ks Kd 5c
    6. DOUBLE_BROADWAY → Qd Js 4c

Goal: populate Strategy DB with real-solver-backed data for the most
common board textures, replacing handcrafted seeds where overlap exists.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from app.solver_import.models import ImportResult
from app.strategy_db.storage import StrategyStore

from .adapter import import_texassolver_solve
from .config import SolverConfig
from .exporter import generate_synthetic_output
from .runner import SolveResult, run_texassolver

logger = logging.getLogger(__name__)

# ── Seed board definitions ───────────────────────────────────────────────────

SEED_BOARDS: list[tuple[str, list[str]]] = [
    ("A_HIGH_DRY",       ["Ah", "7d", "2c"]),
    ("A_HIGH_WET",       ["Ah", "9h", "8d"]),
    ("LOW_CONNECTED",    ["8c", "7d", "6s"]),
    ("MONOTONE",         ["Jh", "8h", "4h"]),
    ("PAIRED",           ["Ks", "Kd", "5c"]),
    ("DOUBLE_BROADWAY",  ["Qd", "Js", "4c"]),
]


def generate_seed_solves(
    *,
    synthetic: bool = False,
    dry_run: bool = False,
    solver_path: str | None = None,
    iterations: int = 1000,
    accuracy: float = 0.5,
    store: StrategyStore | None = None,
) -> list[tuple[str, ImportResult]]:
    """
    Generate seed solves for all target board textures.

    Args:
        synthetic:   Use synthetic output (no real solver needed).
        dry_run:     Parse and validate without storing.
        solver_path: Path to TexasSolver executable.
        iterations:  Max solver iterations per solve.
        accuracy:    Target exploitability (% of pot).
        store:       Optional StrategyStore.

    Returns:
        List of (board_label, ImportResult) for each seed board.
    """
    results: list[tuple[str, ImportResult]] = []

    for board_label, board_cards in SEED_BOARDS:
        config = SolverConfig(
            spot_type="SRP",
            positions="BTN_vs_BB",
            stack_depth=100,
            board=board_cards,
            iterations=iterations,
            accuracy_target=accuracy,
            solver_path=solver_path,
        )

        logger.info(
            "[seeds] generating %s: %s",
            board_label, config.board_string(),
        )

        if synthetic:
            import_result = _run_synthetic_seed(config, dry_run=dry_run, store=store)
        else:
            import_result = _run_real_seed(config, dry_run=dry_run, store=store)

        results.append((board_label, import_result))

    total_stored = sum(r.stored for _, r in results)
    logger.info("[seeds] complete: %d boards, %d nodes stored", len(results), total_stored)

    return results


def _run_real_seed(
    config: SolverConfig,
    *,
    dry_run: bool = False,
    store: StrategyStore | None = None,
) -> ImportResult:
    """Run a real solver seed and import results."""
    solve_result = run_texassolver(config, dry_run=dry_run)

    if not solve_result.success:
        result = ImportResult(dry_run=dry_run)
        result.errors.append((
            "__solve__",
            f"Solve failed: {solve_result.error or 'unknown'}",
        ))
        return result

    return import_texassolver_solve(
        config, solve_result, dry_run=dry_run, store=store,
    )


def _run_synthetic_seed(
    config: SolverConfig,
    *,
    dry_run: bool = False,
    store: StrategyStore | None = None,
) -> ImportResult:
    """Generate a synthetic solve output and import it."""
    work_dir = Path(tempfile.mkdtemp(prefix="texassolver_seed_"))
    output_path = work_dir / "solve_output.json"

    generate_synthetic_output(config, output_path)

    solve_result = SolveResult(
        success=True,
        output_path=str(output_path),
        work_dir=str(work_dir),
    )

    return import_texassolver_solve(
        config, solve_result, dry_run=dry_run, store=store,
    )
