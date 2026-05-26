"""
Structured metrics for solve worker monitoring.

Tracks:
  - Solve duration (histogram)
  - Queue depth (gauge)
  - Job outcomes (counter by status)
  - Import throughput (counter)
  - Memory usage per solve (gauge)
  - Exploitability convergence (histogram)

Design:
  Metrics are stored in Redis as simple counters/gauges. A separate
  Prometheus exporter (or /metrics endpoint) reads and exposes them.
  This avoids pulling in the full prometheus_client library as a hard dep.

Future: swap to prometheus_client when deploying Grafana dashboards.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from datetime import datetime, timezone

import redis.asyncio as aioredis

from .settings import WorkerSettings

logger = logging.getLogger(__name__)


class SolveMetrics:
    """
    Lightweight metrics collector backed by Redis.

    All metric keys live under solver:metrics:* namespace.
    """

    def __init__(self, redis: aioredis.Redis, settings: WorkerSettings) -> None:
        self._redis = redis
        self._prefix = settings.redis_metrics_prefix

    def _key(self, name: str) -> str:
        return f"{self._prefix}{name}"

    # ── Counters ──────────────────────────────────────────────────────────

    async def inc_jobs_submitted(self, count: int = 1) -> None:
        await self._redis.incrby(self._key("jobs_submitted"), count)

    async def inc_jobs_completed(self, count: int = 1) -> None:
        await self._redis.incrby(self._key("jobs_completed"), count)

    async def inc_jobs_failed(self, count: int = 1) -> None:
        await self._redis.incrby(self._key("jobs_failed"), count)

    async def inc_jobs_timeout(self, count: int = 1) -> None:
        await self._redis.incrby(self._key("jobs_timeout"), count)

    async def inc_jobs_retried(self, count: int = 1) -> None:
        await self._redis.incrby(self._key("jobs_retried"), count)

    async def inc_nodes_imported(self, count: int = 1) -> None:
        await self._redis.incrby(self._key("nodes_imported"), count)

    # ── Gauges ────────────────────────────────────────────────────────────

    async def set_queue_depth(self, depth: int) -> None:
        await self._redis.set(self._key("queue_depth"), str(depth))

    async def set_active_workers(self, count: int) -> None:
        await self._redis.set(self._key("active_workers"), str(count))

    async def set_active_solves(self, count: int) -> None:
        await self._redis.set(self._key("active_solves"), str(count))

    # ── Histograms (stored as sorted lists, aggregated on read) ───────────

    async def record_solve_duration(self, seconds: float) -> None:
        """Record a solve duration sample."""
        await self._redis.lpush(self._key("solve_durations"), f"{seconds:.2f}")
        await self._redis.ltrim(self._key("solve_durations"), 0, 999)  # Keep last 1000

    async def record_peak_memory_mb(self, mb: float) -> None:
        await self._redis.lpush(self._key("peak_memory_mb"), f"{mb:.1f}")
        await self._redis.ltrim(self._key("peak_memory_mb"), 0, 999)

    # ── Snapshot (for /metrics endpoint) ──────────────────────────────────

    async def snapshot(self) -> dict:
        """Read all metrics for dashboard / API consumption."""
        keys = [
            "jobs_submitted", "jobs_completed", "jobs_failed",
            "jobs_timeout", "jobs_retried", "nodes_imported",
            "queue_depth", "active_workers", "active_solves",
        ]
        result = {}
        for k in keys:
            val = await self._redis.get(self._key(k))
            result[k] = int(val) if val else 0

        # Solve duration stats
        durations_raw = await self._redis.lrange(self._key("solve_durations"), 0, 999)
        if durations_raw:
            durations = [float(d) for d in durations_raw]
            result["solve_duration_avg_s"] = round(sum(durations) / len(durations), 2)
            result["solve_duration_p50_s"] = round(sorted(durations)[len(durations) // 2], 2)
            result["solve_duration_p95_s"] = round(
                sorted(durations)[int(len(durations) * 0.95)], 2,
            )
            result["solve_duration_max_s"] = round(max(durations), 2)
            result["total_solve_samples"] = len(durations)

        # Memory stats
        mem_raw = await self._redis.lrange(self._key("peak_memory_mb"), 0, 999)
        if mem_raw:
            mems = [float(m) for m in mem_raw]
            result["peak_memory_avg_mb"] = round(sum(mems) / len(mems), 1)
            result["peak_memory_max_mb"] = round(max(mems), 1)

        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        return result

    async def reset(self) -> None:
        """Reset all metrics (for testing)."""
        pattern = f"{self._prefix}*"
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await self._redis.delete(*keys)
            if cursor == 0:
                break
