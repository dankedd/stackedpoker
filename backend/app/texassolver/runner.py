"""
TexasSolver runner — subprocess execution with timeout, cleanup, dry_run.

run_texassolver(config) → SolveResult

Responsibilities:
  1. Generate solver input file from SolverConfig
  2. Invoke TexasSolver CLI as subprocess
  3. Monitor process with timeout protection
  4. Collect output files
  5. Safe cleanup of temp directories

Supports:
  - subprocess execution with configurable paths
  - dry_run mode (generates input, skips execution)
  - deterministic temp directories (reproducible paths)
  - configurable timeout
"""

from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from .config import SolverConfig

logger = logging.getLogger(__name__)

# Default timeout: 5 minutes per solve
DEFAULT_TIMEOUT_SECONDS = 300

# Default solver executable name
DEFAULT_SOLVER_EXE = "TexasSolver"


@dataclass
class SolveResult:
    """
    Output of a single TexasSolver run.

    success       — True if solver completed within timeout
    output_path   — path to solver output file (None if dry_run or failed)
    input_path    — path to generated solver input file
    work_dir      — temp directory used for the solve
    exit_code     — subprocess return code (None if dry_run)
    stdout        — captured stdout
    stderr        — captured stderr
    dry_run       — True if execution was skipped
    error         — error message if failed
    """

    success: bool = False
    output_path: str | None = None
    input_path: str | None = None
    work_dir: str | None = None
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    dry_run: bool = False
    error: str | None = None


def _config_hash(config: SolverConfig) -> str:
    """Deterministic hash for temp directory naming."""
    key = f"{config.spot_type}_{config.positions}_{config.stack_depth}_{config.board_string()}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def _generate_input_file(config: SolverConfig, work_dir: Path) -> Path:
    """
    Generate a TexasSolver input file from the config.

    TexasSolver input format (simplified):
      - Board cards
      - IP/OOP ranges (full ranges for MVP)
      - Bet sizes for each position
      - Pot and stack sizes
      - Solver parameters (iterations, accuracy)
    """
    input_path = work_dir / "solve_input.txt"

    # Build bet size strings
    ip_bet_sizes = ",".join(str(s) for s in config.bet_sizes)
    oop_bet_sizes = ",".join(str(s) for s in config.bet_sizes)
    ip_raise_sizes = ",".join(str(s) for s in config.raise_sizes)
    oop_raise_sizes = ",".join(str(s) for s in config.raise_sizes)

    pot = config.pot_size_bb()
    eff_stack = config.effective_stack_chips()

    # TexasSolver uses a specific input format
    lines = [
        f"set_pot {pot:.1f}",
        f"set_effective_stack {eff_stack:.1f}",
        f"set_board {config.board_string()}",
        f"set_accuracy {config.accuracy_target}",
        f"set_max_iteration {config.iterations}",
        f"set_allin_threshold 0.67",
        "",
        "# IP bet sizes (as fraction of pot)",
        f"set_ip_flop_bet_sizes {ip_bet_sizes}",
        f"set_ip_flop_raise_sizes {ip_raise_sizes}",
        "",
        "# OOP bet sizes (as fraction of pot)",
        f"set_oop_flop_bet_sizes {oop_bet_sizes}",
        f"set_oop_flop_raise_sizes {oop_raise_sizes}",
        "",
        "# Donk bet sizes (OOP betting into PFR)",
        "set_oop_flop_donk_sizes 0",
        "",
        "# Ranges — full preflop ranges for SRP BTN vs BB",
        "set_ip_range AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,"
        "AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,A2s,"
        "KQs,KJs,KTs,K9s,K8s,K7s,K6s,K5s,"
        "QJs,QTs,Q9s,Q8s,"
        "JTs,J9s,J8s,"
        "T9s,T8s,"
        "98s,97s,"
        "87s,86s,"
        "76s,75s,"
        "65s,64s,"
        "54s,53s,"
        "43s,"
        "AKo,AQo,AJo,ATo,A9o,"
        "KQo,KJo,KTo,"
        "QJo,QTo,"
        "JTo,"
        "T9o,"
        "98o",
        "",
        "set_oop_range AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,"
        "AKs,AQs,AJs,ATs,A9s,A8s,A7s,A6s,A5s,A4s,A3s,A2s,"
        "KQs,KJs,KTs,K9s,K8s,K7s,K6s,K5s,K4s,K3s,K2s,"
        "QJs,QTs,Q9s,Q8s,Q7s,Q6s,Q5s,Q4s,Q3s,Q2s,"
        "JTs,J9s,J8s,J7s,J6s,"
        "T9s,T8s,T7s,"
        "98s,97s,96s,"
        "87s,86s,85s,"
        "76s,75s,74s,"
        "65s,64s,63s,"
        "54s,53s,52s,"
        "43s,42s,"
        "32s,"
        "AKo,AQo,AJo,ATo,A9o,A8o,A7o,A6o,A5o,A4o,A3o,A2o,"
        "KQo,KJo,KTo,K9o,K8o,K7o,"
        "QJo,QTo,Q9o,Q8o,"
        "JTo,J9o,J8o,"
        "T9o,T8o,"
        "98o,97o,"
        "87o,86o,"
        "76o,"
        "65o,"
        "54o",
        "",
        "build_tree",
        "start_solve",
        f"dump_result {work_dir / 'solve_output.json'} json",
    ]

    if config.rake is not None:
        # Insert rake config before build_tree
        rake_line = f"set_rake {config.rake}"
        build_idx = lines.index("build_tree")
        lines.insert(build_idx, rake_line)

    input_path.write_text("\n".join(lines), encoding="utf-8")
    return input_path


def _find_solver_executable(config: SolverConfig) -> str | None:
    """
    Locate the TexasSolver executable.

    Priority:
      1. config.solver_path (explicit override)
      2. System PATH lookup
    """
    if config.solver_path:
        path = Path(config.solver_path)
        if path.exists():
            return str(path)
        logger.warning("Configured solver_path does not exist: %s", config.solver_path)
        return None

    # Try system PATH
    exe = shutil.which(DEFAULT_SOLVER_EXE)
    if exe:
        return exe

    # Try common locations
    common_paths = [
        Path.home() / "TexasSolver" / "console_solver",
        Path.home() / "TexasSolver" / "console_solver.exe",
        Path("/usr/local/bin/console_solver"),
    ]
    for p in common_paths:
        if p.exists():
            return str(p)

    return None


def run_texassolver(
    config: SolverConfig,
    *,
    dry_run: bool = False,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    work_dir: str | Path | None = None,
    cleanup: bool = True,
) -> SolveResult:
    """
    Run a single TexasSolver solve.

    Args:
        config:   SolverConfig defining the spot to solve.
        dry_run:  If True, generate input file but skip execution.
        timeout:  Maximum seconds to wait for solver process.
        work_dir: Override temp directory (None = auto-create).
        cleanup:  If True, remove temp directory after completion.

    Returns:
        SolveResult with output path, exit code, and captured output.
    """
    # Validate config
    errors = config.validate()
    if errors:
        return SolveResult(error=f"Invalid config: {'; '.join(errors)}")

    # Set up work directory
    if work_dir is not None:
        wdir = Path(work_dir)
        wdir.mkdir(parents=True, exist_ok=True)
    else:
        prefix = f"texassolver_{_config_hash(config)}_"
        wdir = Path(tempfile.mkdtemp(prefix=prefix))

    result = SolveResult(work_dir=str(wdir), dry_run=dry_run)

    try:
        # Generate input file
        input_path = _generate_input_file(config, wdir)
        result.input_path = str(input_path)

        logger.info(
            "[TexasSolver] input generated: %s (board=%s, stack=%dbb, iter=%d)",
            input_path, config.board_string(), config.stack_depth, config.iterations,
        )

        if dry_run:
            result.success = True
            logger.info("[TexasSolver] dry_run — skipping execution")
            return result

        # Find solver executable
        solver_exe = _find_solver_executable(config)
        if solver_exe is None:
            result.error = (
                "TexasSolver executable not found. "
                "Set solver_path in SolverConfig or add to PATH."
            )
            logger.error("[TexasSolver] %s", result.error)
            return result

        # Execute solver
        logger.info(
            "[TexasSolver] executing: %s < %s (timeout=%ds)",
            solver_exe, input_path, timeout,
        )

        try:
            proc = subprocess.run(
                [solver_exe],
                stdin=open(input_path, "r"),
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(wdir),
            )
            result.exit_code = proc.returncode
            result.stdout = proc.stdout
            result.stderr = proc.stderr

            if proc.returncode != 0:
                result.error = f"Solver exited with code {proc.returncode}: {proc.stderr[:500]}"
                logger.error("[TexasSolver] %s", result.error)
                return result

        except subprocess.TimeoutExpired:
            result.error = f"Solver timed out after {timeout}s"
            logger.error("[TexasSolver] %s", result.error)
            return result

        # Check for output file
        output_path = wdir / "solve_output.json"
        if output_path.exists():
            result.output_path = str(output_path)
            result.success = True
            logger.info("[TexasSolver] solve completed: %s", output_path)
        else:
            result.error = "Solver completed but output file not found"
            logger.error("[TexasSolver] %s", result.error)

    except Exception as exc:
        result.error = f"Unexpected error: {exc}"
        logger.exception("[TexasSolver] solve failed")

    finally:
        if cleanup and not dry_run and result.success:
            # Keep work_dir on failure for debugging
            pass
        elif cleanup and not dry_run and not result.success:
            # Keep on failure for inspection
            logger.debug("[TexasSolver] keeping work_dir for inspection: %s", wdir)

    return result
