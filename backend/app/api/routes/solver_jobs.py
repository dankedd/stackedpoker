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


_redis_available = True


async def _get_queue() -> SolveQueue | None:
    """Lazy-init queue connection. Returns None if Redis unavailable."""
    global _queue, _redis_available
    if not _redis_available:
        return None
    if _queue is None:
        try:
            settings = _get_settings()
            _queue = SolveQueue(settings)
            await _queue.connect()
            print("[Redis] Connected to solver queue")
        except Exception as exc:
            _redis_available = False
            print(f"[Redis] Connection failed — solver queue disabled: {exc}")
            return None
    return _queue


async def _require_queue() -> SolveQueue:
    """FastAPI dependency: get queue or raise 503."""
    q = await _get_queue()
    if q is None:
        raise HTTPException(503, "Redis unavailable — solver queue offline. Solver job features require Redis.")
    return q


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
    queue: SolveQueue = Depends(_require_queue),
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
    queue: SolveQueue = Depends(_require_queue),
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
    queue: SolveQueue = Depends(_require_queue),
) -> list[SolveJobSummary]:
    """List solve jobs, optionally filtered by status."""
    jobs = await queue.list_jobs(status=status, limit=limit, offset=offset)
    return [SolveJobSummary.from_job(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=SolveJob)
async def get_job(
    job_id: str,
    queue: SolveQueue = Depends(_require_queue),
) -> SolveJob:
    """Get full details for a specific job."""
    job = await queue.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.get("/jobs/{job_id}/result", response_model=SolveJobResult)
async def get_job_result(
    job_id: str,
    queue: SolveQueue = Depends(_require_queue),
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
    queue: SolveQueue = Depends(_require_queue),
) -> dict:
    """Cancel a queued or running job."""
    job = await queue.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return {"job_id": job_id, "status": job.status.value}


@router.get("/queue/stats")
async def queue_stats(
    queue: SolveQueue = Depends(_require_queue),
) -> dict:
    """Get queue health statistics."""
    return await queue.queue_stats()


@router.get("/metrics")
async def solver_metrics(
    queue: SolveQueue = Depends(_require_queue),
) -> dict:
    """Get solver metrics snapshot."""
    from app.solver_worker.metrics import SolveMetrics
    settings = _get_settings()
    metrics = SolveMetrics(queue.redis, settings)
    return await metrics.snapshot()


@router.post("/schedule/coverage", response_model=CoverageResponse)
async def schedule_coverage(
    request: CoverageRequest,
    queue: SolveQueue = Depends(_require_queue),
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
    queue = await _require_queue()
    scheduler = SolveScheduler(queue)
    return await scheduler.estimate_batch_size(
        spot_types=spot_types.split(","),
        stack_depths=[int(s) for s in stack_depths.split(",")],
    )


@router.get("/health", response_model=dict)
async def solver_health() -> dict:
    """Worker system health check."""
    queue = await _get_queue()
    if queue is None:
        return {"healthy": False, "checks": {"redis": False}, "details": {"error": "Redis unavailable"}}
    settings = _get_settings()
    checker = HealthChecker(settings, queue.redis)
    status = await checker.check_all()
    return status.to_dict()


@router.get("/health/deep", response_model=dict)
async def solver_health_deep() -> dict:
    """
    Deep solver health check — verifies binary, resources, runtime,
    strategy DB, and Redis connectivity end-to-end.

    Returns:
      - solver binary found, executable permissions, resolved path
      - detected OS / platform
      - redis connected, worker running
      - install instructions if binary missing
    """
    import os
    from pathlib import Path

    from app.solver_worker.solver_path import (
        detect_platform,
        resolve_solver_path,
        solver_binary_exists,
        solver_binary_executable,
        docker_solver_available,
        get_install_instructions,
    )

    checks: dict[str, bool] = {}
    details: dict[str, str] = {}

    # 1. Platform detection
    plat = detect_platform()
    import platform as _platform
    details["detected_platform"] = plat
    details["os"] = _platform.system()
    details["arch"] = _platform.machine()
    details["python"] = _platform.python_version()

    # 2. Feature flag
    enabled = os.getenv("ENABLE_SOLVER_ENGINE", "true").lower() == "true"
    checks["solver_enabled"] = enabled
    details["enable_solver_engine"] = str(enabled)

    # 3. Binary resolution (platform-aware)
    env_bin = os.getenv("TEXASSOLVER_BIN", "")
    resolved = resolve_solver_path(explicit_path=env_bin or None)
    details["texassolver_bin_env"] = env_bin or "(not set)"
    details["resolved_path"] = resolved or "(not found)"

    checks["binary_configured"] = bool(env_bin or resolved)
    checks["binary_exists"] = solver_binary_exists(resolved)
    checks["binary_executable"] = solver_binary_executable(resolved)

    # 3b. Docker fallback
    docker_ok = docker_solver_available()
    checks["docker_fallback"] = docker_ok
    details["docker_image"] = "texassolver:local"
    details["solver_mode"] = (
        "native" if checks["binary_exists"]
        else "docker" if docker_ok
        else "unavailable"
    )

    # 4. Resources
    settings = _get_settings()
    res_dir = settings.solver_resource_dir
    compairer = Path(res_dir) / "compairer"
    checks["resources_available"] = compairer.exists() and any(compairer.iterdir()) if compairer.exists() else False
    details["resource_dir"] = res_dir

    # 5. Strategy DB
    try:
        from app.strategy_db.storage import StrategyStore
        store = StrategyStore(seed_on_init=True)
        node_count = store.count()
        checks["strategy_db_populated"] = node_count > 0
        details["strategy_node_count"] = str(node_count)
    except Exception as exc:
        checks["strategy_db_populated"] = False
        details["strategy_db_error"] = str(exc)

    # 6. Redis
    queue = await _get_queue()
    if queue is not None:
        try:
            await queue.redis.ping()
            checks["redis_connected"] = True
            depth = await queue.queue_depth()
            details["queue_depth"] = str(depth)
        except Exception as exc:
            checks["redis_connected"] = False
            details["redis_error"] = str(exc)
    else:
        checks["redis_connected"] = False
        details["redis_error"] = "Redis unavailable"

    # 7. Overall health — solver is available if native binary OR Docker works
    solver_available = checks["binary_exists"] or checks["docker_fallback"]
    # Don't count binary_exists/binary_executable/binary_configured as failures
    # if Docker fallback is available
    health_checks = {k: v for k, v in checks.items() if k not in (
        "binary_exists", "binary_executable", "binary_configured",
    )}
    health_checks["solver_available"] = solver_available
    all_ok = all(health_checks.values())

    result = {
        "healthy": all_ok,
        "checks": checks,
        "details": details,
        "summary": (
            "All solver systems operational" if all_ok
            else "Some solver systems unavailable — check details"
        ),
    }

    # 8. Include install instructions if solver is completely unavailable
    if not solver_available:
        result["install_instructions"] = get_install_instructions()

    return result


@router.get("/test-binary", response_model=dict)
async def test_solver_binary() -> dict:
    """
    Execute the solver binary directly and return full runtime diagnostics.

    Tests: file existence, permissions, shared libraries, actual execution.
    Cross-platform: works on Windows, Linux, and Railway.
    """
    import os
    import subprocess
    import platform
    from pathlib import Path

    from app.solver_worker.solver_path import (
        detect_platform,
        resolve_solver_path,
        solver_binary_executable,
        get_install_instructions,
        PLATFORM_WINDOWS,
    )

    plat = detect_platform()
    result: dict = {
        "detected_platform": plat,
        "os": platform.system(),
        "arch": platform.machine(),
        "python_platform": platform.platform(),
    }

    # Find binary using platform-aware resolution
    resolved = resolve_solver_path()
    result["texassolver_bin_env"] = os.getenv("TEXASSOLVER_BIN", "(not set)")
    result["resolved_path"] = resolved or "(not found)"
    result["binary_exists"] = bool(resolved) and Path(resolved).exists()

    if not resolved or not Path(resolved).exists():
        result["error"] = "Binary not found"
        result["install_instructions"] = get_install_instructions()
        return result

    result["binary_executable"] = solver_binary_executable(resolved)

    # File type (Linux/macOS only — `file` command not available on Windows)
    if plat != PLATFORM_WINDOWS:
        try:
            ft = subprocess.run(["file", resolved], capture_output=True, text=True, timeout=5)
            result["file_type"] = ft.stdout.strip()
        except Exception as e:
            result["file_type"] = f"error: {e}"
    else:
        result["file_type"] = f"Windows executable ({Path(resolved).suffix})"

    # Shared libraries (Linux only)
    if plat != PLATFORM_WINDOWS:
        try:
            ldd = subprocess.run(["ldd", resolved], capture_output=True, text=True, timeout=5)
            lines = ldd.stdout.strip().splitlines()
            missing = [ln.strip() for ln in lines if "not found" in ln]
            result["shared_libs_total"] = len(lines)
            result["shared_libs_missing"] = missing
            result["ldd_exit_code"] = ldd.returncode
            if ldd.stderr:
                result["ldd_stderr"] = ldd.stderr[:300]
        except Exception as e:
            result["ldd_error"] = str(e)

    # Resources
    settings = _get_settings()
    res_dir = settings.solver_resource_dir
    compairer = Path(res_dir) / "compairer"
    result["resource_dir"] = res_dir
    result["resources_exist"] = compairer.exists()
    if compairer.exists():
        try:
            result["resource_files"] = len(list(compairer.iterdir()))
        except Exception:
            result["resource_files"] = 0

    # EXECUTE binary
    try:
        proc = subprocess.run(
            [resolved, "--help"],
            capture_output=True, text=True, timeout=10,
        )
        result["exec_exit_code"] = proc.returncode
        result["exec_stdout"] = proc.stdout[:500] if proc.stdout else ""
        result["exec_stderr"] = proc.stderr[:500] if proc.stderr else ""
        result["exec_success"] = proc.returncode == 0 or bool(proc.stdout)
    except FileNotFoundError:
        result["exec_error"] = "FileNotFoundError"
        result["exec_success"] = False
    except PermissionError:
        result["exec_error"] = "PermissionError"
        result["exec_success"] = False
    except subprocess.TimeoutExpired:
        result["exec_error"] = "TimeoutExpired (>10s)"
        result["exec_success"] = False
    except OSError as e:
        result["exec_error"] = f"OSError: {e.strerror} (errno={e.errno})"
        result["exec_success"] = False
    except Exception as e:
        result["exec_error"] = f"{type(e).__name__}: {e}"
        result["exec_success"] = False

    return result


# ── Strategy endpoints ──────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/strategy", response_model=dict)
async def get_job_strategy(
    job_id: str,
    queue: SolveQueue = Depends(_require_queue),
) -> dict:
    """
    Get parsed solver strategy for a completed job.

    Returns frontend-friendly format matching SolverLiveResult interface:
    - frequencies (aggregate action probabilities)
    - per-combo breakdowns
    - IP and OOP strategies
    - metadata (iterations, solve time, node description)
    """
    from pathlib import Path

    # Get job and result
    job = await queue.get_job(job_id)
    if job is None:
        raise HTTPException(404, f"Job {job_id} not found")

    res = await queue.get_result(job_id)
    if res is None:
        if job.status.value in ("queued", "running"):
            return {
                "status": "solving",
                "mode": "live",
                "job_status": job.status.value,
                "message": f"Job is {job.status.value}",
            }
        raise HTTPException(409, f"Job {job_id} is {job.status.value}, no result")

    # Read the raw solver output JSON
    output_path = res.solve_output_path
    if not output_path or not Path(output_path).exists():
        raise HTTPException(404, "Solve output file not found")

    # Parse the output using our parser
    from app.texassolver.config import SolverConfig
    from app.texassolver.parser import parse_texassolver_output

    config = SolverConfig(
        spot_type=job.config.spot_type,
        positions=job.config.positions,
        stack_depth=job.config.stack_depth,
        board=job.config.board,
    )
    nodes = parse_texassolver_output(output_path, config)

    # Build frontend-friendly response
    strategies = {}
    for node in nodes:
        player = "ip" if "ip" in node.node_id else "oop"

        freq_dict = {a.action_name: round(a.frequency, 4) for a in node.actions}
        preferred = max(node.actions, key=lambda a: a.frequency).action_name if node.actions else ""

        combos = []
        for combo in node.combos[:200]:  # Limit for response size
            combos.append({
                "hand": combo.combo,
                "actions": {a.action_name: round(a.frequency, 4) for a in combo.actions},
                "equity": combo.equity,
                "ev": combo.ev_chips,
            })

        strategies[player] = {
            "position": node.position,
            "actions": [a.action_name for a in node.actions],
            "frequencies": freq_dict,
            "preferred_action": preferred,
            "combo_count": len(node.combos),
            "combos": combos,
        }

    # Use OOP as the primary display (first to act in most spots)
    primary = strategies.get("oop", strategies.get("ip", {}))

    return {
        "status": "ready",
        "mode": "live",
        "source": "texassolver",
        "job_id": job_id,
        "frequencies": primary.get("frequencies", {}),
        "ev": {},
        "preferred_action": primary.get("preferred_action", ""),
        "hero_action_ev_loss": 0.0,
        "iterations": job.config.max_iterations,
        "exploitability": 0.0,
        "solve_time_ms": round(res.solve_time_seconds * 1000, 1),
        "cache_hit": False,
        "node_key": f"{config.spot_type}::{config.positions}::{config.stack_depth}bb",
        "node_description": (
            f"{config.ip_position()} vs {config.oop_position()} | "
            f"{'Flop' if len(config.board) == 3 else 'Turn' if len(config.board) == 4 else 'River'} "
            f"[{' '.join(config.board)}] | "
            f"Pot {config.pot_size_bb():.0f}bb"
        ),
        "street_supported": True,
        "error": None,
        "fallback_reason": None,
        "strategies": strategies,
        "board": config.board,
        "spot_type": config.spot_type,
        "positions": config.positions,
        "nodes_parsed": res.nodes_parsed,
        "nodes_imported": res.nodes_imported,
    }
