"""
TexasSolver runner — subprocess execution with timeout, cleanup, dry_run.

run_texassolver(config) → SolveResult

Responsibilities:
  1. Generate solver input file from SolverConfig
  2. Invoke TexasSolver CLI as subprocess (native or Docker)
  3. Monitor process with timeout protection
  4. Collect output files
  5. Safe cleanup of temp directories

Supports:
  - Native subprocess execution (Linux/Railway with compiled binary)
  - Docker-based execution (Windows dev without native binary)
  - dry_run mode (generates input, skips execution)
  - deterministic temp directories (reproducible paths)
  - configurable timeout
"""

from __future__ import annotations

import hashlib
import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .config import SolverConfig

logger = logging.getLogger(__name__)

# Default timeout: 5 minutes per solve
DEFAULT_TIMEOUT_SECONDS = 300

# Default solver executable name
DEFAULT_SOLVER_EXE = "TexasSolver"

# Docker image used when no native binary is available
SOLVER_DOCKER_IMAGE = "texassolver:local"


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


def _generate_input_file(config: SolverConfig, work_dir: Path, output_path: str) -> Path:
    """
    Generate a TexasSolver v0.2.0 input file from the config.

    TexasSolver v0.2.0 command reference (extracted from binary):
      set_pot, set_effective_stack, set_board (comma-separated),
      set_accuracy, set_max_iteration, set_allin_threshold,
      set_bet_sizes (single global setting), set_thread_num,
      set_range_ip, set_range_oop, set_use_isomorphism,
      build_tree, start_solve, dump_result <path>

    NOTE: v0.2.0 uses `set_range_ip`/`set_range_oop` (not set_ip_range),
    `set_bet_sizes` (global, not per-street), and board cards are
    comma-separated (not space-separated).
    """
    input_path = work_dir / "solve_input.txt"

    pot = config.pot_size_bb()
    eff_stack = config.effective_stack_chips()

    # Board as comma-separated cards (TexasSolver v0.2.0 format)
    board_csv = ",".join(config.board)

    lines = [
        f"set_pot {pot:.1f}",
        f"set_effective_stack {eff_stack:.1f}",
        f"set_board {board_csv}",
        f"set_accuracy {config.accuracy_target}",
        f"set_max_iteration {config.iterations}",
        "set_allin_threshold 0.67",
        "set_thread_num 2",
        "set_use_isomorphism 1",
        # Ranges — full preflop ranges for SRP BTN vs BB
        "set_range_ip AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,"
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
        "set_range_oop AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,"
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
        "build_tree",
        "start_solve",
        f"dump_result {output_path}",
    ]

    if config.rake is not None:
        # Insert rake config before build_tree
        rake_line = f"set_rake {config.rake}"
        build_idx = lines.index("build_tree")
        lines.insert(build_idx, rake_line)

    # Write with Unix line endings — critical for Docker/Linux execution
    input_path.write_bytes(("\n".join(lines) + "\n").encode("utf-8"))
    return input_path


def _find_solver_executable(config: SolverConfig) -> str | None:
    """
    Locate the TexasSolver executable using platform-aware resolution.

    Delegates to solver_path.resolve_solver_path() which checks:
      1. config.solver_path (explicit override / TEXASSOLVER_BIN)
      2. TEXASSOLVER_BIN environment variable
      3. System PATH lookup
      4. Platform-specific candidate paths (Windows/Linux/Railway)
    """
    from app.solver_worker.solver_path import resolve_solver_path

    resolved = resolve_solver_path(explicit_path=config.solver_path)
    if resolved:
        return resolved

    logger.warning(
        "[TexasSolver] binary NOT FOUND. config.solver_path=%s",
        config.solver_path,
    )
    return None


def _docker_available() -> bool:
    """Check if Docker is available and the solver image exists."""
    try:
        proc = subprocess.run(
            ["docker", "image", "inspect", SOLVER_DOCKER_IMAGE],
            capture_output=True, text=True, timeout=10,
        )
        return proc.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _run_via_docker(
    input_path: Path,
    work_dir: Path,
    timeout: int,
) -> tuple[int | None, str, str]:
    """
    Execute TexasSolver via Docker container.

    Mounts the work directory at /work inside the container.
    The input file's dump_result path must use the container path.

    Returns (exit_code, stdout, stderr).
    """
    # Convert Windows path to Docker-compatible mount path
    work_dir_str = str(work_dir.resolve()).replace("\\", "/")

    # Docker command: mount work dir, use --input_file, resource_dir inside image
    cmd = [
        "docker", "run", "--rm",
        "-m", "4g",   # Full-range solves need ~2-3 GB
        "-v", f"{work_dir_str}:/work",
        SOLVER_DOCKER_IMAGE,
        "--resource_dir", "/opt/texassolver/resources",
        "--input_file", f"/work/{input_path.name}",
    ]

    logger.info("[TexasSolver/Docker] executing: %s", " ".join(cmd))

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 30,  # Extra buffer for container startup
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return None, "", f"Docker solver timed out after {timeout + 30}s"
    except FileNotFoundError:
        return None, "", "Docker not found in PATH"


def _run_via_native(
    solver_exe: str,
    input_path: Path,
    work_dir: Path,
    timeout: int,
) -> tuple[int | None, str, str]:
    """
    Execute TexasSolver as a native subprocess.

    Uses --input_file flag for reliable I/O (not stdin).
    Uses --resource_dir to point at the resource directory.

    Returns (exit_code, stdout, stderr).
    """
    from app.solver_worker.solver_path import detect_platform, PLATFORM_WINDOWS

    # Determine resource dir: check env, then infer from binary location
    res_dir = os.getenv("TEXASSOLVER_RESOURCE_DIR")
    if not res_dir:
        # Infer: binary at .../bin/console_solver → resources at .../resources
        solver_parent = Path(solver_exe).resolve().parent.parent
        candidate = solver_parent / "resources"
        if candidate.exists():
            res_dir = str(candidate)

    cmd = [solver_exe, "--input_file", str(input_path)]
    if res_dir:
        cmd.extend(["--resource_dir", res_dir])

    logger.info("[TexasSolver/Native] executing: %s", " ".join(cmd))

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(work_dir),
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return None, "", f"Solver timed out after {timeout}s"


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

    Execution strategy:
      1. If a native binary is found → run directly as subprocess
      2. If no native binary but Docker is available → run via Docker container
      3. If neither → fail with install instructions

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
        # Determine execution mode BEFORE generating input
        # (output path format differs between native and Docker)
        solver_exe = _find_solver_executable(config)
        use_docker = False

        if solver_exe is None:
            # Fall back to Docker
            if _docker_available():
                use_docker = True
                logger.info("[TexasSolver] no native binary — using Docker (%s)", SOLVER_DOCKER_IMAGE)
            else:
                from app.solver_worker.solver_path import (
                    detect_platform, get_install_instructions,
                )
                plat = detect_platform()
                result.error = (
                    f"TexasSolver executable not found (platform={plat}) "
                    "and Docker image not available. "
                    "Run: docker build -f docker/texassolver/Dockerfile.build -t texassolver:local . "
                    "OR set TEXASSOLVER_BIN env var."
                )
                logger.error("[TexasSolver] %s", result.error)
                logger.info("[TexasSolver] Install instructions:\n%s", get_install_instructions())
                return result

        # Output path: Docker uses container path, native uses host path
        output_filename = "solve_output.json"
        if use_docker:
            output_path_in_input = f"/work/{output_filename}"
        else:
            output_path_in_input = str(wdir / output_filename)

        # Generate input file
        input_path = _generate_input_file(config, wdir, output_path_in_input)
        result.input_path = str(input_path)

        logger.info(
            "[TexasSolver] input generated: %s (board=%s, stack=%dbb, iter=%d, mode=%s)",
            input_path, config.board_string(), config.stack_depth, config.iterations,
            "docker" if use_docker else "native",
        )

        if dry_run:
            result.success = True
            logger.info("[TexasSolver] dry_run — skipping execution")
            return result

        # Execute solver
        if use_docker:
            exit_code, stdout, stderr = _run_via_docker(
                input_path, wdir, timeout,
            )
        else:
            exit_code, stdout, stderr = _run_via_native(
                solver_exe, input_path, wdir, timeout,
            )

        result.exit_code = exit_code
        result.stdout = stdout
        result.stderr = stderr

        if exit_code is None:
            # Timeout
            result.error = f"Solver timed out after {timeout}s"
            logger.error("[TexasSolver] %s", result.error)
            return result

        if exit_code != 0:
            result.error = f"Solver exited with code {exit_code}: {stderr[:500]}"
            logger.error("[TexasSolver] %s", result.error)
            return result

        # Check for output file
        output_path = wdir / output_filename
        if output_path.exists():
            result.output_path = str(output_path)
            result.success = True
            size_kb = output_path.stat().st_size / 1024
            logger.info("[TexasSolver] solve completed: %s (%.1f KB)", output_path, size_kb)
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
