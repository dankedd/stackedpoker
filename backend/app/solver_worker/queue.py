"""
Redis queue management — job submission, status tracking, dead-letter handling.

Queue topology:
  solver:jobs              — main priority queue (sorted set, score = priority)
  solver:status:{job_id}   — job state hash (JSON-serialized SolveJob)
  solver:result:{job_id}   — completed result (JSON-serialized SolveJobResult)
  solver:dead_letter       — failed jobs that exceeded max retries
  solver:metrics:*         — counters and gauges for monitoring

Priority model:
  Redis sorted set with score = priority * 1e9 + timestamp_ns.
  Lower score = higher priority. Equal priority → FIFO by creation time.

Deduplication:
  Before enqueuing, check if an identical solve config (same board + positions +
  stack + bet sizes) already has a COMPLETED or RUNNING job. If so, skip.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis

from .models import (
    SolveJob,
    SolveJobConfig,
    SolveJobPriority,
    SolveJobResult,
    SolveJobStatus,
)
from .settings import WorkerSettings

logger = logging.getLogger(__name__)


def _config_fingerprint(config: SolveJobConfig) -> str:
    """
    Deterministic hash of a solve config for deduplication.

    Includes all parameters that affect solver output — if any of these
    differ, the solve must be re-run.
    """
    key_parts = [
        config.spot_type,
        config.positions,
        str(config.stack_depth),
        config.board_string(),
        ",".join(f"{s:.2f}" for s in sorted(config.bet_sizes)),
        ",".join(f"{s:.2f}" for s in sorted(config.raise_sizes)),
        str(config.max_iterations),
        f"{config.accuracy_target:.4f}",
        str(config.use_isomorphism),
    ]
    raw = "|".join(key_parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class SolveQueue:
    """
    Async Redis queue manager for solve jobs.

    Usage:
        settings = WorkerSettings.from_env()
        queue = SolveQueue(settings)
        await queue.connect()

        job = await queue.enqueue(config)
        status = await queue.get_status(job.job_id)
        await queue.close()
    """

    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        self._redis: aioredis.Redis | None = None

    async def connect(self) -> None:
        self._redis = aioredis.from_url(
            self._settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
        # Verify connectivity
        await self._redis.ping()
        logger.info("[SolveQueue] connected to Redis at %s", self._settings.redis_url)

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    @property
    def redis(self) -> aioredis.Redis:
        if self._redis is None:
            raise RuntimeError("SolveQueue not connected — call connect() first")
        return self._redis

    # ── Job submission ────────────────────────────────────────────────────

    async def enqueue(
        self,
        config: SolveJobConfig,
        *,
        priority: SolveJobPriority = SolveJobPriority.NORMAL,
        deduplicate: bool = True,
    ) -> SolveJob | None:
        """
        Create and enqueue a solve job.

        Returns None if deduplicate=True and an identical solve already exists
        in a non-terminal, non-failed state.
        """
        if deduplicate:
            fingerprint = _config_fingerprint(config)
            existing = await self._find_by_fingerprint(fingerprint)
            if existing:
                logger.info(
                    "[SolveQueue] deduplicated: %s (existing job %s, status=%s)",
                    fingerprint, existing.job_id, existing.status.value,
                )
                return None

        job = SolveJob(
            config=config,
            priority=priority,
            status=SolveJobStatus.QUEUED,
            queued_at=datetime.now(timezone.utc),
            max_retries=self._settings.max_retries,
        )

        # Store job state
        await self._save_job(job)

        # Add to priority queue (sorted set)
        # Score = priority * 1e12 + epoch_microseconds → lower = dequeue first
        score = (
            job.priority.value * 1_000_000_000_000
            + int(job.created_at.timestamp() * 1_000_000)
        )
        await self.redis.zadd(self._settings.redis_queue_name, {job.job_id: score})

        # Store config fingerprint for deduplication lookups
        fingerprint = _config_fingerprint(config)
        fp_key = f"solver:fingerprint:{fingerprint}"
        await self.redis.set(fp_key, job.job_id, ex=self._settings.job_status_ttl)

        logger.info(
            "[SolveQueue] enqueued job %s (priority=%s, board=%s, positions=%s)",
            job.job_id, priority.name, config.board_string(), config.positions,
        )
        return job

    async def enqueue_batch(
        self,
        configs: list[SolveJobConfig],
        *,
        priority: SolveJobPriority = SolveJobPriority.NORMAL,
        deduplicate: bool = True,
    ) -> list[SolveJob]:
        """Enqueue multiple jobs. Returns only the jobs that were actually created."""
        jobs = []
        for config in configs:
            job = await self.enqueue(config, priority=priority, deduplicate=deduplicate)
            if job is not None:
                jobs.append(job)
        return jobs

    # ── Job consumption (called by worker) ────────────────────────────────

    async def dequeue(self, worker_id: str) -> SolveJob | None:
        """
        Pop the highest-priority job from the queue.

        Atomically removes from sorted set and marks as RUNNING.
        Returns None if queue is empty.
        """
        # ZPOPMIN returns the member with lowest score (highest priority)
        result = await self.redis.zpopmin(self._settings.redis_queue_name, count=1)
        if not result:
            return None

        job_id, _score = result[0]
        job = await self.get_job(job_id)
        if job is None:
            logger.warning("[SolveQueue] dequeued orphan job_id: %s", job_id)
            return None

        # Mark as running
        job.status = SolveJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        job.worker_id = worker_id
        job.attempt += 1
        await self._save_job(job)

        logger.info(
            "[SolveQueue] dequeued job %s → worker %s (attempt %d/%d)",
            job.job_id, worker_id, job.attempt, job.max_retries,
        )
        return job

    # ── Job completion ────────────────────────────────────────────────────

    async def complete(self, job_id: str, result: SolveJobResult) -> SolveJob | None:
        """Mark job as completed with result."""
        job = await self.get_job(job_id)
        if job is None:
            return None

        job.status = SolveJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        job.result = result
        job.error = None
        await self._save_job(job)

        # Store result separately for fast lookup
        result_key = f"{self._settings.redis_result_prefix}{job_id}"
        await self.redis.set(
            result_key,
            result.model_dump_json(),
            ex=self._settings.job_result_ttl,
        )

        logger.info(
            "[SolveQueue] completed job %s (%.1fs, %d nodes imported)",
            job_id, result.solve_time_seconds, result.nodes_imported,
        )
        return job

    async def fail(self, job_id: str, error: str) -> SolveJob | None:
        """
        Mark job as failed. If retryable, schedule retry; otherwise dead-letter.
        """
        job = await self.get_job(job_id)
        if job is None:
            return None

        job.error = error
        job.error_history.append(
            f"attempt {job.attempt}: {error}"
        )
        job.completed_at = datetime.now(timezone.utc)

        if job.can_retry():
            job.status = SolveJobStatus.RETRY
            await self._save_job(job)
            await self._schedule_retry(job)
            logger.warning(
                "[SolveQueue] job %s failed (attempt %d/%d), scheduling retry: %s",
                job_id, job.attempt, job.max_retries, error,
            )
        else:
            job.status = SolveJobStatus.DEAD_LETTER
            await self._save_job(job)
            await self.redis.lpush(self._settings.redis_dead_letter_queue, job_id)
            logger.error(
                "[SolveQueue] job %s dead-lettered after %d attempts: %s",
                job_id, job.attempt, error,
            )

        return job

    async def timeout(self, job_id: str) -> SolveJob | None:
        """Mark job as timed out — same retry logic as fail."""
        return await self.fail(job_id, "Solve exceeded timeout limit")

    async def cancel(self, job_id: str) -> SolveJob | None:
        """Cancel a job. Removes from queue if still queued."""
        job = await self.get_job(job_id)
        if job is None:
            return None

        if job.is_terminal():
            return job  # Already done, nothing to cancel

        # Remove from queue if still there
        await self.redis.zrem(self._settings.redis_queue_name, job_id)

        job.status = SolveJobStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)
        await self._save_job(job)

        logger.info("[SolveQueue] cancelled job %s", job_id)
        return job

    # ── Status queries ────────────────────────────────────────────────────

    async def get_job(self, job_id: str) -> SolveJob | None:
        """Load full job state from Redis."""
        key = f"{self._settings.redis_status_prefix}{job_id}"
        raw = await self.redis.get(key)
        if raw is None:
            return None
        return SolveJob.model_validate_json(raw)

    async def get_result(self, job_id: str) -> SolveJobResult | None:
        """Load just the result (faster than full job for completed solves)."""
        key = f"{self._settings.redis_result_prefix}{job_id}"
        raw = await self.redis.get(key)
        if raw is None:
            return None
        return SolveJobResult.model_validate_json(raw)

    async def queue_depth(self) -> int:
        """Number of jobs waiting in the queue."""
        return await self.redis.zcard(self._settings.redis_queue_name)

    async def queue_stats(self) -> dict:
        """Queue health metrics for monitoring."""
        depth = await self.redis.zcard(self._settings.redis_queue_name)
        dlq_depth = await self.redis.llen(self._settings.redis_dead_letter_queue)
        return {
            "queue_depth": depth,
            "dead_letter_depth": dlq_depth,
        }

    async def list_jobs(
        self,
        status: SolveJobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SolveJob]:
        """
        List jobs, optionally filtered by status.

        Note: This scans Redis keys — fine for moderate job counts (<10k).
        For larger scale, move job metadata to PostgreSQL.
        """
        pattern = f"{self._settings.redis_status_prefix}*"
        jobs = []
        cursor = 0
        seen = 0

        while True:
            cursor, keys = await self.redis.scan(
                cursor=cursor, match=pattern, count=200,
            )
            for key in keys:
                raw = await self.redis.get(key)
                if raw is None:
                    continue
                job = SolveJob.model_validate_json(raw)
                if status is not None and job.status != status:
                    continue
                seen += 1
                if seen > offset:
                    jobs.append(job)
                if len(jobs) >= limit:
                    return jobs
            if cursor == 0:
                break

        return jobs

    # ── Internal helpers ──────────────────────────────────────────────────

    async def _save_job(self, job: SolveJob) -> None:
        """Persist full job state to Redis."""
        key = f"{self._settings.redis_status_prefix}{job.job_id}"
        await self.redis.set(
            key,
            job.model_dump_json(),
            ex=self._settings.job_status_ttl,
        )

    async def _schedule_retry(self, job: SolveJob) -> None:
        """Re-enqueue a job for retry with backoff delay."""
        delays = self._settings.retry_delay_seconds
        delay_idx = min(job.attempt - 1, len(delays) - 1)
        delay = delays[delay_idx]

        # Score pushes it into the future: current_priority + delay offset
        future_score = (
            job.priority.value * 1_000_000_000_000
            + int((datetime.now(timezone.utc).timestamp() + delay) * 1_000_000)
        )
        job.status = SolveJobStatus.QUEUED
        job.queued_at = datetime.now(timezone.utc)
        job.started_at = None
        job.worker_id = None
        await self._save_job(job)
        await self.redis.zadd(self._settings.redis_queue_name, {job.job_id: future_score})

        logger.info(
            "[SolveQueue] retry scheduled for job %s in %ds", job.job_id, delay,
        )

    async def _find_by_fingerprint(self, fingerprint: str) -> SolveJob | None:
        """Check if a solve with this fingerprint is already in progress or completed."""
        fp_key = f"solver:fingerprint:{fingerprint}"
        job_id = await self.redis.get(fp_key)
        if job_id is None:
            return None

        job = await self.get_job(job_id)
        if job is None:
            # Stale fingerprint — clean up
            await self.redis.delete(fp_key)
            return None

        # Only deduplicate against active or completed jobs
        if job.status in {
            SolveJobStatus.QUEUED,
            SolveJobStatus.RUNNING,
            SolveJobStatus.COMPLETED,
        }:
            return job

        # Failed/cancelled/dead-lettered — allow re-solve
        await self.redis.delete(fp_key)
        return None
