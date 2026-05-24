"""
Exporter — end-to-end solve + import orchestrator.

solve_and_import(config, ...) → (SolveResult, ImportResult)

Combines runner + parser + adapter into a single call:
  1. Run TexasSolver → SolveResult
  2. Parse output → RawSolverNode list
  3. Import via existing pipeline → StrategyNode DB

Also provides synthetic solve generation for testing and development
when TexasSolver is not available.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.solver_import.models import ImportResult
from app.strategy_db.storage import StrategyStore

from .adapter import import_texassolver_solve
from .config import SolverConfig
from .runner import SolveResult, run_texassolver

logger = logging.getLogger(__name__)


def solve_and_import(
    config: SolverConfig,
    *,
    dry_run: bool = False,
    store: StrategyStore | None = None,
    timeout: int = 300,
    cleanup: bool = True,
) -> tuple[SolveResult, ImportResult]:
    """
    Run a solve and import the results in one call.

    Args:
        config:   SolverConfig for the spot to solve.
        dry_run:  If True, generate input but skip execution and import.
        store:    Optional StrategyStore.
        timeout:  Solver timeout in seconds.
        cleanup:  Clean up temp files after completion.

    Returns:
        (SolveResult, ImportResult) — solve_result may show failure even
        if import_result is empty (no output to import).
    """
    # Step 1: Run solver
    solve_result = run_texassolver(
        config, dry_run=dry_run, timeout=timeout, cleanup=cleanup,
    )

    # Step 2: Import if solve succeeded
    if solve_result.success and solve_result.output_path and not dry_run:
        import_result = import_texassolver_solve(
            config, solve_result, dry_run=False, store=store,
        )
    else:
        import_result = ImportResult(
            source_file=solve_result.output_path or "",
            dry_run=dry_run,
        )
        if not solve_result.success:
            import_result.errors.append((
                "__solve__",
                solve_result.error or "Solve did not complete successfully",
            ))

    return solve_result, import_result


def generate_synthetic_output(
    config: SolverConfig,
    output_path: str | Path,
) -> Path:
    """
    Generate a synthetic TexasSolver output file for testing.

    Creates a realistic JSON output structure without actually running
    the solver. Useful for:
      - Testing the parser and import pipeline
      - Development without TexasSolver installed
      - Fixture generation

    The synthetic output produces reasonable frequencies based on
    board texture heuristics — NOT random noise.
    """
    from app.solver.board_classifier import BoardClassifier

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Classify board to generate appropriate frequencies
    classifier = BoardClassifier()
    try:
        features = classifier.classify_flop(config.board)
        board_class = features.board_class.value
    except Exception:
        board_class = "NEUTRAL"

    # Heuristic-based synthetic frequencies
    ip_bet_freq, ip_check_freq = _synthetic_frequencies(board_class, is_ip=True)
    oop_bet_freq, oop_check_freq = _synthetic_frequencies(board_class, is_ip=False)

    # Build sizing distribution from config bet sizes
    ip_actions, ip_strategy = _build_action_distribution(
        config.bet_sizes, ip_bet_freq, ip_check_freq,
    )
    oop_actions, oop_strategy = _build_action_distribution(
        config.bet_sizes, oop_bet_freq, oop_check_freq,
    )

    output = {
        "ip_strategy": {
            "actions": ip_actions,
            "strategy": ip_strategy,
        },
        "oop_strategy": {
            "actions": oop_actions,
            "strategy": oop_strategy,
        },
        "meta": {
            "iterations": config.iterations,
            "exploitability": config.accuracy_target * 0.8,
            "board": config.board_string(),
            "pot": config.pot_size_bb(),
            "stack": config.effective_stack_chips(),
            "solver": "texassolver_synthetic",
        },
    }

    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2)

    logger.info("[exporter] synthetic output written: %s", output_path)
    return output_path


def _synthetic_frequencies(board_class: str, *, is_ip: bool) -> tuple[float, float]:
    """
    Generate realistic bet/check frequencies based on board class and position.

    These approximate real solver outputs — not random, not perfectly accurate.
    """
    # Base frequencies by board class (IP perspective)
    _BASE: dict[str, tuple[float, float]] = {
        "A_HIGH_DRY":       (0.70, 0.30),
        "A_HIGH_WET":       (0.62, 0.38),
        "K_HIGH_DRY":       (0.65, 0.35),
        "K_HIGH_WET":       (0.55, 0.45),
        "LOW_CONNECTED":    (0.40, 0.60),
        "LOW_DYNAMIC":      (0.35, 0.65),
        "MIDDLE_CONNECTED": (0.50, 0.50),
        "DOUBLE_BROADWAY":  (0.58, 0.42),
        "TRIPLE_BROADWAY":  (0.60, 0.40),
        "PAIRED_LOW":       (0.55, 0.45),
        "PAIRED_HIGH":      (0.65, 0.35),
        "MONOTONE":         (0.30, 0.70),
        "RAINBOW_STATIC":   (0.55, 0.45),
        "RAINBOW_DYNAMIC":  (0.48, 0.52),
        "NEUTRAL":          (0.50, 0.50),
    }

    bet_freq, check_freq = _BASE.get(board_class, (0.50, 0.50))

    # OOP bets less than IP
    if not is_ip:
        bet_freq *= 0.75
        check_freq = 1.0 - bet_freq

    return round(bet_freq, 4), round(check_freq, 4)


def _build_action_distribution(
    bet_sizes: list[float],
    bet_freq: float,
    check_freq: float,
) -> tuple[list[str], list[float]]:
    """
    Distribute bet frequency across available bet sizes.

    Returns (action_names, frequencies) — always sums to ~1.0.
    """
    actions = ["CHECK"]
    strategy = [check_freq]

    if not bet_sizes:
        return actions, strategy

    # Distribute bet freq across sizes with a preference for smaller sizes
    weights = [1.0 / (i + 1) for i in range(len(bet_sizes))]
    total_weight = sum(weights)

    for size, weight in zip(bet_sizes, weights):
        pct = int(size * 100)
        actions.append(f"BET {pct}")
        strategy.append(round(bet_freq * weight / total_weight, 4))

    # Normalize to sum to 1.0
    total = sum(strategy)
    if total > 0:
        strategy = [round(s / total, 4) for s in strategy]
        # Fix rounding to exactly 1.0
        diff = 1.0 - sum(strategy)
        strategy[0] = round(strategy[0] + diff, 4)

    return actions, strategy
