"""
Worker-specific configuration — separate from the main FastAPI settings.

Workers run in their own containers and need:
  - Redis connection for queue consumption
  - PostgreSQL connection for solve metadata persistence
  - Filesystem paths for raw solve output storage
  - TexasSolver binary location and resource paths
  - Tuning knobs for concurrency, timeouts, memory limits
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from .solver_path import detect_platform, PLATFORM_WINDOWS


@dataclass(frozen=True)
class WorkerSettings:
    """Immutable worker configuration — loaded once at startup."""

    # ── Redis ─────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_queue_name: str = "solver:jobs"
    redis_result_prefix: str = "solver:result:"
    redis_status_prefix: str = "solver:status:"
    redis_metrics_prefix: str = "solver:metrics:"
    redis_dead_letter_queue: str = "solver:dead_letter"

    # Job TTLs (seconds)
    job_result_ttl: int = 86400 * 7       # 7 days
    job_status_ttl: int = 86400 * 30      # 30 days

    # ── TexasSolver ───────────────────────────────────────────────────────
    # Defaults are platform-aware — set at class level as fallbacks,
    # overridden by from_env() which uses detect_platform().
    solver_binary: str = "/opt/texassolver/bin/console_solver"
    solver_resource_dir: str = "/opt/texassolver/resources"

    # Execution limits
    solve_timeout_seconds: int = 600      # 10 minutes hard timeout
    solve_soft_timeout_seconds: int = 540  # 9 minutes — warn and prepare cleanup
    max_memory_mb: int = 4096             # 4 GB OOM threshold

    # ── Worker concurrency ────────────────────────────────────────────────
    max_concurrent_solves: int = 1        # per worker container — 1 solve gets full CPU
    max_worker_threads: int = 4           # threads per solve (OpenMP)

    # ── Retry policy ──────────────────────────────────────────────────────
    max_retries: int = 3
    retry_delay_seconds: list[int] = field(
        default_factory=lambda: [30, 120, 600],  # 30s, 2min, 10min
    )

    # ── Storage ───────────────────────────────────────────────────────────
    solve_output_dir: str = "/data/solves/output"
    solve_archive_dir: str = "/data/solves/archive"
    compress_output: bool = True

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:password@db:5432/stacked_poker"

    # ── Monitoring ────────────────────────────────────────────────────────
    prometheus_port: int = 9090
    health_check_interval_seconds: int = 30
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> WorkerSettings:
        """Build settings from environment variables with sensible defaults."""
        from .solver_path import default_solver_path, resolve_solver_path

        # Resolve solver binary: env var → auto-detect → platform default
        env_bin = os.getenv("TEXASSOLVER_BIN")
        resolved = resolve_solver_path(explicit_path=env_bin)
        solver_bin = resolved or env_bin or default_solver_path()

        # Resolve resource dir with platform-aware default
        plat = detect_platform()
        default_res = (
            str(Path(__file__).resolve().parent.parent.parent / "vendor" / "texassolver" / "resources")
            if plat == PLATFORM_WINDOWS
            else cls.solver_resource_dir
        )

        return cls(
            redis_url=os.getenv("REDIS_URL", cls.redis_url),
            solver_binary=solver_bin,
            solver_resource_dir=os.getenv(
                "TEXASSOLVER_RESOURCE_DIR", default_res,
            ),
            solve_timeout_seconds=int(
                os.getenv("SOLVE_TIMEOUT", str(cls.solve_timeout_seconds)),
            ),
            max_concurrent_solves=int(
                os.getenv("MAX_CONCURRENT_SOLVES", str(cls.max_concurrent_solves)),
            ),
            max_worker_threads=int(
                os.getenv("SOLVER_THREADS", str(cls.max_worker_threads)),
            ),
            max_memory_mb=int(
                os.getenv("MAX_MEMORY_MB", str(cls.max_memory_mb)),
            ),
            solve_output_dir=os.getenv("SOLVE_OUTPUT_DIR", cls.solve_output_dir),
            database_url=os.getenv("DATABASE_URL", cls.database_url),
            log_level=os.getenv("LOG_LEVEL", cls.log_level),
        )
