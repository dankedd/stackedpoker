"""
CLI command — solve generation entry point.

Usage:
    python -m app.texassolver.generate --spot srp_btn_bb --board Ah7d2c --stack 100 --iterations 1000
    python -m app.texassolver.generate --seed                  # generate all seed solves
    python -m app.texassolver.generate --seed --dry-run        # preview without executing
    python -m app.texassolver.generate --synthetic --seed      # generate seed solves using synthetic output

Pipeline:
    1. Run solve (TexasSolver or synthetic)
    2. Parse output → RawSolverNode
    3. Compress strategy
    4. Store in Strategy DB
"""

from __future__ import annotations

import argparse
import logging
import sys

from .config import SolverConfig
from .exporter import generate_synthetic_output, solve_and_import
from .runner import SolveResult
from .seeds import SEED_BOARDS, generate_seed_solves

logger = logging.getLogger(__name__)


def _parse_board(board_str: str) -> list[str]:
    """
    Parse a board string into card list.

    Accepts:
      "Ah7d2c"      → ["Ah", "7d", "2c"]
      "Ah 7d 2c"    → ["Ah", "7d", "2c"]
      "Ah,7d,2c"    → ["Ah", "7d", "2c"]
    """
    board_str = board_str.strip()

    # Space-separated
    if " " in board_str:
        return board_str.split()

    # Comma-separated
    if "," in board_str:
        return [c.strip() for c in board_str.split(",")]

    # Concatenated: every 2 chars is a card
    cards = []
    i = 0
    while i < len(board_str):
        if i + 1 < len(board_str):
            cards.append(board_str[i:i + 2])
            i += 2
        else:
            break
    return cards


def _run_single(args: argparse.Namespace) -> int:
    """Run a single solve from CLI arguments."""
    board = _parse_board(args.board)

    config = SolverConfig(
        spot_type=args.spot.upper().split("_")[0] if "_" in args.spot else args.spot.upper(),
        positions=_parse_positions(args.spot),
        stack_depth=args.stack,
        board=board,
        iterations=args.iterations,
        accuracy_target=args.accuracy,
        solver_path=args.solver_path,
    )

    errors = config.validate()
    if errors:
        print(f"Config validation failed: {'; '.join(errors)}", file=sys.stderr)
        return 1

    print(f"Solving: {config.spot_type} {config.positions} on {config.board_string()}")
    print(f"  stack={config.stack_depth}bb  iter={config.iterations}  accuracy={config.accuracy_target}")

    if args.synthetic:
        return _run_synthetic_single(config, args)

    solve_result, import_result = solve_and_import(
        config, dry_run=args.dry_run, timeout=args.timeout,
    )

    print(f"\nSolve: {'SUCCESS' if solve_result.success else 'FAILED'}")
    if solve_result.error:
        print(f"  Error: {solve_result.error}")
    print(f"Import: {import_result.summary()}")

    return 0 if solve_result.success else 1


def _run_synthetic_single(config: SolverConfig, args: argparse.Namespace) -> int:
    """Run a single synthetic solve (no actual solver needed)."""
    import tempfile
    from pathlib import Path

    from .adapter import import_texassolver_solve

    work_dir = Path(tempfile.mkdtemp(prefix="texassolver_synthetic_"))
    output_path = work_dir / "solve_output.json"

    generate_synthetic_output(config, output_path)

    # Create a synthetic SolveResult
    solve_result = SolveResult(
        success=True,
        output_path=str(output_path),
        work_dir=str(work_dir),
        dry_run=False,
    )

    import_result = import_texassolver_solve(
        config, solve_result, dry_run=args.dry_run,
    )

    print(f"\nSynthetic solve: SUCCESS")
    print(f"Import: {import_result.summary()}")

    return 0


def _parse_positions(spot_str: str) -> str:
    """Parse position string from spot identifier."""
    spot_lower = spot_str.lower()
    if "btn_bb" in spot_lower or "btn_vs_bb" in spot_lower:
        return "BTN_vs_BB"
    if "co_bb" in spot_lower or "co_vs_bb" in spot_lower:
        return "CO_vs_BB"
    # Default: BTN vs BB
    return "BTN_vs_BB"


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="texassolver.generate",
        description="Generate solver solutions and import into Strategy DB",
    )
    parser.add_argument(
        "--spot", default="srp_btn_bb",
        help="Spot identifier (e.g. srp_btn_bb, 3bet_btn_bb)",
    )
    parser.add_argument(
        "--board", default="Ah7d2c",
        help="Board cards (e.g. Ah7d2c, 'Ah 7d 2c')",
    )
    parser.add_argument(
        "--stack", type=int, default=100,
        help="Effective stack depth in BB (default: 100)",
    )
    parser.add_argument(
        "--iterations", type=int, default=1000,
        help="Maximum solver iterations (default: 1000)",
    )
    parser.add_argument(
        "--accuracy", type=float, default=0.5,
        help="Target exploitability in %% of pot (default: 0.5)",
    )
    parser.add_argument(
        "--timeout", type=int, default=300,
        help="Solver timeout in seconds (default: 300)",
    )
    parser.add_argument(
        "--solver-path", default=None,
        help="Path to TexasSolver executable",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Generate input only, skip solve execution",
    )
    parser.add_argument(
        "--synthetic", action="store_true",
        help="Use synthetic output instead of real solver",
    )
    parser.add_argument(
        "--seed", action="store_true",
        help="Generate all seed solves (6 board classes × 2 positions)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    # Configure logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    if args.seed:
        return _run_seed(args)
    return _run_single(args)


def _run_seed(args: argparse.Namespace) -> int:
    """Generate all seed solves."""
    print(f"Generating seed solves ({len(SEED_BOARDS)} boards)...")
    print(f"  Mode: {'synthetic' if args.synthetic else 'real solver'}")
    print(f"  Dry run: {args.dry_run}")
    print()

    results = generate_seed_solves(
        synthetic=args.synthetic,
        dry_run=args.dry_run,
        solver_path=args.solver_path,
        iterations=args.iterations,
    )

    total_stored = 0
    total_errors = 0

    for board_label, import_result in results:
        status = "OK" if import_result.stored > 0 else "SKIP"
        print(f"  [{status}] {board_label}: {import_result.summary()}")
        total_stored += import_result.stored
        total_errors += len(import_result.errors)

    print(f"\nTotal: {total_stored} nodes stored, {total_errors} errors")
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
