"""
Health checks, watchdog, and liveness probes for solve workers.

Provides:
  - Worker liveness check (is the event loop alive?)
  - Redis connectivity check
  - Solver binary availability check
  - Memory usage monitoring
  - Stale job detection (jobs stuck in RUNNING too long)
"""

from __future__ import annotations

import logging
import os
import shutil
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import redis.asyncio as aioredis

from .settings import WorkerSettings

logger = logging.getLogger(__name__)


@dataclass
class HealthStatus:
    """Aggregate health check result."""
    healthy: bool = True
    checks: dict[str, bool] = field(default_factory=dict)
    details: dict[str, str] = field(default_factory=dict)
    timestamp: str = ""

    def to_dict(self) -> dict:
        return {
            "healthy": self.healthy,
            "checks": self.checks,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class HealthChecker:
    """
    Runs health checks for the worker system.

    Usage from FastAPI:
        checker = HealthChecker(settings, redis)
        status = await checker.check_all()
    """

    def __init__(
        self,
        settings: WorkerSettings,
        redis: aioredis.Redis | None = None,
    ) -> None:
        self._settings = settings
        self._redis = redis

    async def check_all(self) -> HealthStatus:
        """Run all health checks and return aggregate status."""
        status = HealthStatus(
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        # 1. Redis connectivity
        redis_ok = await self._check_redis()
        status.checks["redis"] = redis_ok
        if not redis_ok:
            status.details["redis"] = "Cannot connect to Redis"
            status.healthy = False

        # 2. Solver binary
        solver_ok = self._check_solver_binary()
        status.checks["solver_binary"] = solver_ok
        if not solver_ok:
            status.details["solver_binary"] = (
                f"Solver not found at {self._settings.solver_binary}"
            )
            status.healthy = False

        # 3. Resource files
        resources_ok = self._check_resources()
        status.checks["solver_resources"] = resources_ok
        if not resources_ok:
            status.details["solver_resources"] = (
                f"Resources not found at {self._settings.solver_resource_dir}"
            )
            status.healthy = False

        # 4. Storage directories
        storage_ok = self._check_storage()
        status.checks["storage"] = storage_ok
        if not storage_ok:
            status.details["storage"] = "Storage directories not writable"
            status.healthy = False

        # 5. Memory usage
        mem_ok, mem_pct = self._check_memory()
        status.checks["memory"] = mem_ok
        status.details["memory_usage_pct"] = f"{mem_pct:.1f}%"
        if not mem_ok:
            status.healthy = False

        return status

    async def _check_redis(self) -> bool:
        if self._redis is None:
            return False
        try:
            await self._redis.ping()
            return True
        except Exception:
            return False

    def _check_solver_binary(self) -> bool:
        from .solver_path import solver_binary_executable
        return solver_binary_executable(self._settings.solver_binary)

    def _check_resources(self) -> bool:
        res_dir = Path(self._settings.solver_resource_dir)
        if not res_dir.exists():
            return False
        # Check for the critical hand ranking dictionary
        compairer_dir = res_dir / "compairer"
        return compairer_dir.exists() and any(compairer_dir.iterdir())

    def _check_storage(self) -> bool:
        for dir_path in [
            self._settings.solve_output_dir,
            self._settings.solve_archive_dir,
        ]:
            p = Path(dir_path)
            if not p.exists():
                try:
                    p.mkdir(parents=True, exist_ok=True)
                except OSError:
                    return False
            if not os.access(str(p), os.W_OK):
                return False
        return True

    def _check_memory(self) -> tuple[bool, float]:
        """Check system memory usage. Returns (ok, percent_used)."""
        try:
            import psutil
            mem = psutil.virtual_memory()
            pct = mem.percent
            # Warn at 85%, fail at 95%
            ok = pct < 95.0
            return ok, pct
        except ImportError:
            # psutil not available — skip check
            return True, 0.0


async def check_stale_jobs(
    redis: aioredis.Redis,
    settings: WorkerSettings,
    max_running_seconds: int = 900,
) -> list[str]:
    """
    Find jobs stuck in RUNNING state beyond max_running_seconds.

    Returns list of stale job_ids that may need intervention.
    """
    from .models import SolveJob, SolveJobStatus

    stale_ids = []
    pattern = f"{settings.redis_status_prefix}*"
    cursor = 0
    now = datetime.now(timezone.utc)

    while True:
        cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=100)
        for key in keys:
            raw = await redis.get(key)
            if raw is None:
                continue
            try:
                job = SolveJob.model_validate_json(raw)
            except Exception:
                continue

            if job.status == SolveJobStatus.RUNNING and job.started_at:
                elapsed = (now - job.started_at).total_seconds()
                if elapsed > max_running_seconds:
                    stale_ids.append(job.job_id)
                    logger.warning(
                        "[HealthCheck] stale job %s running for %.0fs (worker=%s)",
                        job.job_id, elapsed, job.worker_id,
                    )
        if cursor == 0:
            break

    return stale_ids
