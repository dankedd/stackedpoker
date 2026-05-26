"""
FastAPI routes for solve job management.

Endpoints:
  POST /api/solver/jobs          — submit a single solve job
  POST /api/solver/jobs/batch    — submit a batch of solve jobs
  GET  /api/solver/jobs          — list jobs (filterable by status)
  GET  /api/solver/jobs/{id}     — get job details
  GET  /api/solver/jobs/{id}/result — get solve result
  POST /api/solver/jobs/{id}/cancel — cancel a job
  GET  /api/solver/queue/stats   — queue health metrics
  GET  /api/solver/metrics       — solver metrics snapshot
  POST /api/solver/schedule/coverage — trigger coverage batch generation
  GET  /api/solver/schedule/estimate — estimate batch size
  GET  /api/solver/health        — worker health check
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.solver_worker.models import (
    BatchSolveRequest,
    BatchSolveResponse,
    SolveJob,
    SolveJobConfig,
    SolveJobPriority,
    SolveJobResult,
    SolveJobStatus,
    SolveJobSummary,
)
from app.solver_worker.queue import SolveQueue
from app.solver_worker.scheduler import SolveScheduler
from app.solver_worker.settings import WorkerSettings
from app.solver_worker.health import HealthChecker, HealthStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/solver", tags=["solver"])

# ── Dependency injection ──────────────────────────────────────────────────

_queue: SolveQueue | None = None
_settings: WorkerSettings | None = None


def _get_settings() -> WorkerSettings:
    global _settings
    if _settings is None:
        _settings = WorkerSettings.from_env()
    return _settings


async def _get_queue() -> SolveQueue:
    """Lazy-init queue connection. Shared across requests."""
    global _queue
    if _queue is None:
        settings = _get_settings()
        _queue = SolveQueue(settings)
        await _queue.connect()
    return _queue


# ── Request/Response models ───────────────────────────────────────────────

class SubmitJobRequest(BaseModel):
    config: SolveJobConfig
    priority: SolveJobPriority = SolveJobPriority.NORMAL
    deduplicate: bool = True


class SubmitJobResponse(BaseModel):
    job_id: str | None
    status: str
    message: str


class CoverageRequest(BaseModel):
    spot_types: list[str] = ["SRP"]
    stack_depths: list[int] = [100]
    positions: list[str] | None = None
    board_classes: list[str] | None = None
    priority: SolveJobPriority = SolveJobPriority.NORMAL
    max_jobs: int = 200


class CoverageResponse(BaseModel):
    jobs_created: int
    job_ids: list[str]


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/jobs", response_model=SubmitJobResponse)
async def submit_job(
    request: SubmitJobRequest,
    queue: SolveQueue = Depends(_get_queue),
) -> SubmitJobResponse:
    """Submit a single solve job to the queue."""
    job = await queue.enqueue(
        request.config,
        priority=request.priority,
        deduplicate=request.deduplicate,
    )
    if job is None:
        return SubmitJobResponse(
            job_id=None,
            status="deduplicated",
            message="An identical solve is already queued or completed",
        )
    return SubmitJobResponse(
        job_id=job.job_id,
        status=job.status.value,
        message="Job submitted successfully",
    )


@router.post("/jobs/batch", response_model=BatchSolveResponse)
async def submit_batch(
    request: BatchSolveRequest,
    queue: SolveQueue = Depends(_get_queue),
) -> BatchSolveResponse:
    """Submit a batch of solve jobs."""
    jobs = await queue.enqueue_batch(
        request.configs,
        priority=request.priority,
        deduplicate=request.deduplicate,
    )
    return BatchSolveResponse(
        total_submitted=len(request.configs),
        jobs_created=len(jobs),
        jobs_deduplicated=len(request.configs) - len(jobs),
        job_ids=[j.job_id for j in jobs],
    )


@router.get("/jobs", response_model=list[SolveJobSummary])
async def list_jobs(
    status: SolveJobStatus | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    queue: SolveQueue = Depends(_get_queue),
) -> list[SolveJobSummary]:
    """List solve jobs, optionally filtered by status."""
    jobs = await queue.list_jobs(status=status, limit=limit, offset=offset)
    return [SolveJobSummary.from_job(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=SolveJob)
async def get_job(
    job_id: str,
    queue: SolveQueue = Depends(_get_queue),
) -> SolveJob:
    """Get full details for a specific job."""
    job = await queue.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.get("/jobs/{job_id}/result", response_model=SolveJobResult)
async def get_job_result(
    job_id: str,
    queue: SolveQueue = Depends(_get_queue),
) -> SolveJobResult:
    """Get the solve result for a completed job."""
    result = await queue.get_result(job_id)
    if result is None:
        # Check if job exists but isn't completed yet
        job = await queue.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} is {job.status.value}, result not available yet",
        )
    return result


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    queue: SolveQueue = Depends(_get_queue),
) -> dict:
    """Cancel a queued or running job."""
    job = await queue.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return {"job_id": job_id, "status": job.status.value}


@router.get("/queue/stats")
async def queue_stats(
    queue: SolveQueue = Depends(_get_queue),
) -> dict:
    """Get queue health statistics."""
    return await queue.queue_stats()


@router.get("/metrics")
async def solver_metrics(
    queue: SolveQueue = Depends(_get_queue),
) -> dict:
    """Get solver metrics snapshot."""
    from app.solver_worker.metrics import SolveMetrics
    settings = _get_settings()
    metrics = SolveMetrics(queue.redis, settings)
    return await metrics.snapshot()


@router.post("/schedule/coverage", response_model=CoverageResponse)
async def schedule_coverage(
    request: CoverageRequest,
    queue: SolveQueue = Depends(_get_queue),
) -> CoverageResponse:
    """Generate and enqueue a batch of coverage solve jobs."""
    scheduler = SolveScheduler(queue)
    job_ids = await scheduler.generate_coverage_batch(
        spot_types=request.spot_types,
        positions=request.positions,
        stack_depths=request.stack_depths,
        board_classes=request.board_classes,
        priority=request.priority,
        max_jobs=request.max_jobs,
    )
    return CoverageResponse(jobs_created=len(job_ids), job_ids=job_ids)


@router.get("/schedule/estimate")
async def estimate_coverage(
    spot_types: str = Query(default="SRP,3BET"),
    stack_depths: str = Query(default="100"),
) -> dict:
    """Estimate the size of a coverage batch without enqueuing."""
    queue = await _get_queue()
    scheduler = SolveScheduler(queue)
    return await scheduler.estimate_batch_size(
        spot_types=spot_types.split(","),
        stack_depths=[int(s) for s in stack_depths.split(",")],
    )


@router.get("/health", response_model=dict)
async def solver_health() -> dict:
    """Worker system health check."""
    settings = _get_settings()
    queue = await _get_queue()
    checker = HealthChecker(settings, queue.redis)
    status = await checker.check_all()
    return status.to_dict()
