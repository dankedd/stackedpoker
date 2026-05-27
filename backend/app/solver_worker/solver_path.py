"""
Platform-aware TexasSolver binary resolution.

Detects the runtime environment (Windows dev, Linux/Docker, Railway)
and resolves the correct solver executable path automatically.

Priority:
  1. TEXASSOLVER_BIN environment variable (explicit override)
  2. Platform-specific default paths
  3. System PATH lookup
  4. Common installation locations
"""

from __future__ import annotations

import logging
import os
import platform
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Platform detection ───────────────────────────────────────────────────

PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"
PLATFORM_RAILWAY = "railway"
PLATFORM_MACOS = "macos"


def detect_platform() -> str:
    """
    Detect the runtime platform.

    Returns one of: "windows", "linux", "railway", "macos"
    Railway is detected by the RAILWAY_ENVIRONMENT env var.
    """
    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_SERVICE_ID"):
        return PLATFORM_RAILWAY
    system = platform.system().lower()
    if system == "windows":
        return PLATFORM_WINDOWS
    if system == "darwin":
        return PLATFORM_MACOS
    return PLATFORM_LINUX


def _project_root() -> Path:
    """Walk up from this file to find the backend/ directory root."""
    # This file: backend/app/solver_worker/solver_path.py
    # Project root: backend/
    return Path(__file__).resolve().parent.parent.parent


# ── Candidate paths per platform ─────────────────────────────────────────

def _windows_candidates() -> list[Path]:
    """Candidate paths for Windows development."""
    root = _project_root()
    home = Path.home()
    return [
        # Project-local vendor directory
        root / "vendor" / "texassolver" / "console_solver.exe",
        root / "vendor" / "texassolver" / "TexasSolver.exe",
        # App vendor
        root / "app" / "vendor" / "texassolver" / "console_solver.exe",
        # Home directory builds
        home / "TexasSolver" / "console_solver.exe",
        home / "TexasSolver" / "TexasSolver.exe",
        home / "TexasSolver" / "build" / "console_solver.exe",
        home / "TexasSolver" / "build" / "Release" / "console_solver.exe",
        # Scoop / Chocolatey / manual install
        Path("C:/TexasSolver/console_solver.exe"),
        Path("C:/Program Files/TexasSolver/console_solver.exe"),
    ]


def _linux_candidates() -> list[Path]:
    """Candidate paths for Linux / generic Docker."""
    root = _project_root()
    home = Path.home()
    return [
        # Docker standard location
        Path("/opt/texassolver/bin/console_solver"),
        # Local builds
        home / "TexasSolver" / "console_solver",
        home / "TexasSolver" / "build" / "console_solver",
        # System-wide
        Path("/usr/local/bin/console_solver"),
        # Project vendor
        root / "vendor" / "texassolver" / "console_solver",
    ]


def _railway_candidates() -> list[Path]:
    """Candidate paths for Railway container deployment."""
    return [
        Path("/opt/texassolver/bin/console_solver"),
        Path("/usr/local/bin/console_solver"),
        Path("/app/vendor/texassolver/console_solver"),
    ]


_CANDIDATES = {
    PLATFORM_WINDOWS: _windows_candidates,
    PLATFORM_LINUX: _linux_candidates,
    PLATFORM_RAILWAY: _railway_candidates,
    PLATFORM_MACOS: _linux_candidates,  # macOS uses same layout as Linux
}

# ── Default paths per platform (used when no env var is set) ─────────────

_DEFAULTS = {
    PLATFORM_WINDOWS: "vendor/texassolver/console_solver.exe",
    PLATFORM_LINUX: "/opt/texassolver/bin/console_solver",
    PLATFORM_RAILWAY: "/opt/texassolver/bin/console_solver",
    PLATFORM_MACOS: "/opt/texassolver/bin/console_solver",
}


# ── Main resolver ────────────────────────────────────────────────────────

def resolve_solver_path(explicit_path: str | None = None) -> str | None:
    """
    Resolve the TexasSolver binary path for the current platform.

    Args:
        explicit_path: Override path (e.g. from TEXASSOLVER_BIN env var).

    Returns:
        Absolute path to the solver binary, or None if not found.
    """
    plat = detect_platform()

    # 1. Explicit override
    if explicit_path:
        p = Path(explicit_path)
        if p.exists():
            logger.info("[SolverPath] using explicit path: %s", p)
            return str(p.resolve())
        logger.warning(
            "[SolverPath] explicit path does not exist: %s (platform=%s)",
            explicit_path, plat,
        )
        # Don't return None yet — fall through to auto-detect

    # 2. Environment variable
    env_path = os.getenv("TEXASSOLVER_BIN")
    if env_path and env_path != explicit_path:
        p = Path(env_path)
        if p.exists():
            logger.info("[SolverPath] using TEXASSOLVER_BIN: %s", p)
            return str(p.resolve())
        logger.warning("[SolverPath] TEXASSOLVER_BIN does not exist: %s", env_path)

    # 3. System PATH lookup
    exe_name = "console_solver.exe" if plat == PLATFORM_WINDOWS else "console_solver"
    found = shutil.which(exe_name) or shutil.which("TexasSolver")
    if found:
        logger.info("[SolverPath] found in PATH: %s", found)
        return found

    # 4. Platform-specific candidate paths
    candidates_fn = _CANDIDATES.get(plat, _linux_candidates)
    for candidate in candidates_fn():
        if candidate.exists():
            logger.info("[SolverPath] found at candidate path: %s", candidate)
            return str(candidate.resolve())

    logger.warning(
        "[SolverPath] binary NOT FOUND (platform=%s, explicit=%s, env=%s)",
        plat, explicit_path, env_path,
    )
    return None


def default_solver_path() -> str:
    """
    Return the platform-appropriate default path string.

    Used as the default value in WorkerSettings before resolution.
    On Windows, returns a relative vendor path.
    On Linux/Railway, returns the Docker standard path.
    """
    plat = detect_platform()
    default = _DEFAULTS.get(plat, _DEFAULTS[PLATFORM_LINUX])

    # For Windows, make the vendor path relative to project root
    if plat == PLATFORM_WINDOWS:
        root = _project_root()
        return str(root / default)

    return default


def solver_binary_exists(path: str | None = None) -> bool:
    """Check whether the solver binary exists at the given or resolved path."""
    target = path or resolve_solver_path()
    if not target:
        return False
    p = Path(target)
    return p.exists() and p.is_file()


def solver_binary_executable(path: str | None = None) -> bool:
    """Check whether the solver binary exists and is executable."""
    target = path or resolve_solver_path()
    if not target:
        return False
    p = Path(target)
    if not p.exists():
        return False
    # On Windows, .exe files are always "executable"
    if detect_platform() == PLATFORM_WINDOWS:
        return p.suffix.lower() == ".exe" or os.access(str(p), os.X_OK)
    return os.access(str(p), os.X_OK)


def docker_solver_available() -> bool:
    """Check if the TexasSolver Docker image is available as a fallback."""
    import subprocess as _sp
    try:
        proc = _sp.run(
            ["docker", "image", "inspect", "texassolver:local"],
            capture_output=True, text=True, timeout=10,
        )
        return proc.returncode == 0
    except (FileNotFoundError, _sp.TimeoutExpired):
        return False


# ── Build / download instructions ────────────────────────────────────────

_WINDOWS_INSTRUCTIONS = """\
TexasSolver binary not found for Windows.

Option 1 — Docker (recommended, one command):
  docker build -f docker/texassolver/Dockerfile.build -t texassolver:local .
  # The runner automatically uses Docker when no native binary is found.

Option 2 — Build from source (requires CMake + MSVC/MinGW):
  git clone https://github.com/bupticybee/TexasSolver.git
  cd TexasSolver
  mkdir build && cd build
  cmake .. -DCMAKE_BUILD_TYPE=Release
  cmake --build . --config Release
  # Copy build/Release/console_solver.exe to:
  #   {vendor_path}

Option 3 — Download a pre-built release (if available):
  Check https://github.com/bupticybee/TexasSolver/releases

Expected native binary location:
  {vendor_path}
"""

_LINUX_INSTRUCTIONS = """\
TexasSolver binary not found.

To get the solver binary:

Option 1 — Use Docker (recommended):
  docker compose up solver-worker
  # The Dockerfile compiles the solver from source automatically.

Option 2 — Build from source:
  git clone https://github.com/bupticybee/TexasSolver.git
  cd TexasSolver
  # Apply GCC11 patches if needed:
  bash vendor/texassolver/patch-gcc11.sh
  qmake && make -j$(nproc)
  sudo cp console_solver /opt/texassolver/bin/console_solver

Option 3 — Copy from Docker image:
  docker create --name ts-extract texassolver:latest
  docker cp ts-extract:/opt/texassolver/bin/console_solver ./console_solver
  docker rm ts-extract

Expected binary location:
  /opt/texassolver/bin/console_solver

Or set the TEXASSOLVER_BIN environment variable.
"""


def get_install_instructions() -> str:
    """Return platform-appropriate build/download instructions."""
    plat = detect_platform()
    if plat == PLATFORM_WINDOWS:
        root = _project_root()
        vendor_path = root / "vendor" / "texassolver" / "console_solver.exe"
        return _WINDOWS_INSTRUCTIONS.format(vendor_path=vendor_path)
    return _LINUX_INSTRUCTIONS


def log_solver_status() -> dict:
    """
    Log and return a summary of solver binary status.

    Called at startup to provide clear diagnostics.
    """
    plat = detect_platform()
    env_bin = os.getenv("TEXASSOLVER_BIN", "(not set)")
    resolved = resolve_solver_path()
    exists = solver_binary_exists(resolved) if resolved else False
    executable = solver_binary_executable(resolved) if resolved else False

    docker_ok = docker_solver_available()

    status = {
        "platform": plat,
        "os": platform.system(),
        "arch": platform.machine(),
        "python": platform.python_version(),
        "TEXASSOLVER_BIN": env_bin,
        "resolved_path": resolved or "(not found)",
        "binary_exists": exists,
        "binary_executable": executable,
        "docker_available": docker_ok,
    }

    logger.info("=" * 60)
    logger.info("[SolverPath] Platform detection and binary resolution")
    logger.info("  OS:                %s (%s)", platform.system(), platform.machine())
    logger.info("  Detected platform: %s", plat)
    logger.info("  TEXASSOLVER_BIN:   %s", env_bin)
    logger.info("  Resolved path:     %s", resolved or "(not found)")
    logger.info("  Binary exists:     %s", exists)
    logger.info("  Binary executable: %s", executable)
    logger.info("  Docker fallback:   %s", docker_ok)

    if exists:
        logger.info("[SolverPath] Solver binary ready (native).")
    elif docker_ok:
        logger.info("[SolverPath] No native binary — Docker fallback available (texassolver:local).")
    else:
        logger.warning("[SolverPath] Solver NOT available — no native binary, no Docker image.")
        logger.info("[SolverPath] Run GET /api/solver/health/deep for install instructions.")

    logger.info("=" * 60)

    return status
