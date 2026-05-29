"""
ARQ worker — consumes solve jobs from Redis and executes TexasSolver.

Responsibilities:
  1. Poll Redis queue for highest-priority job
  2. Build SolverConfig from SolveJobConfig
  3. Execute TexasSolver subprocess with timeout enforcement
  4. Monitor memory usage during solve
  5. Parse output and import into strategy database
  6. Report results back to queue
  7. Handle graceful shutdown on SIGTERM/SIGINT

Design:
  - Uses asyncio event loop with subprocess in thread pool
  - Each worker runs max_concurrent_solves jobs simultaneously
  - OMP_NUM_THREADS is set per-solve to avoid thread oversubscription
  - Memory watchdog runs alongside each solve to detect OOM early
"""

from __future__ import annotations

import asyncio
import gzip
import logging
import os
import platform
import signal
import shutil
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from .models import (
    SolveJob,
    SolveJobConfig,
    SolveJobResult,
    SolveJobStatus,
)
from .queue import SolveQueue
from .settings import WorkerSettings
from .storage import SolveStorage

logger = logging.getLogger(__name__)


class SolveWorker:
    """
    Background worker that consumes and executes solve jobs.

    Lifecycle:
        worker = SolveWorker(settings)
        await worker.start()   # runs until shutdown signal
        await worker.stop()    # graceful shutdown
    """

    def __init__(self, settings: WorkerSettings | None = None) -> None:
        self._settings = settings or WorkerSettings.from_env()
        self._worker_id = f"worker-{platform.node()}-{uuid.uuid4().hex[:8]}"
        self._queue: SolveQueue | None = None
        self._storage: SolveStorage | None = None
        self._executor = ThreadPoolExecutor(
            max_workers=self._settings.max_concurrent_solves,
            thread_name_prefix="solver",
        )
        self._running = False
        self._active_jobs: dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()

    @property
    def worker_id(self) -> str:
        return self._worker_id

    async def start(self) -> None:
        """Start the worker loop. Blocks until shutdown signal."""
        from .solver_path import log_solver_status, solver_binary_exists

        logger.info(
            "[Worker %s] starting (concurrency=%d, threads/solve=%d, timeout=%ds)",
            self._worker_id,
            self._settings.max_concurrent_solves,
            self._settings.max_worker_threads,
            self._settings.solve_timeout_seconds,
        )

        # Log solver binary status at startup
        solver_status = log_solver_status()
        if not solver_status["binary_exists"] and not solver_status.get("docker_available"):
            logger.warning(
                "[Worker %s] solver NOT available — no native binary, no Docker image. "
                "Jobs will fail. See GET /api/solver/health/deep for install instructions.",
                self._worker_id,
            )
        elif not solver_status["binary_exists"] and solver_status.get("docker_available"):
            logger.info(
                "[Worker %s] using Docker fallback (texassolver:local) for solver execution.",
                self._worker_id,
            )

        # Set OpenMP thread count for solver subprocesses
        os.environ["OMP_NUM_THREADS"] = str(self._settings.max_worker_threads)

        self._queue = SolveQueue(self._settings)
        await self._queue.connect()

        self._storage = SolveStorage(self._settings)
        self._storage.ensure_dirs()

        self._running = True
        self._install_signal_handlers()

        try:
            await self._poll_loop()
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Graceful shutdown — wait for active jobs, then cleanup."""
        if not self._running:
            return

        self._running = False
        logger.info(
            "[Worker %s] shutting down (%d active jobs)...",
            self._worker_id, len(self._active_jobs),
        )

        # Wait for active jobs to finish (with timeout)
        if self._active_jobs:
            logger.info("[Worker %s] waiting for active jobs to complete...", self._worker_id)
            tasks = list(self._active_jobs.values())
            done, pending = await asyncio.wait(tasks, timeout=30)
            for task in pending:
                task.cancel()

        self._executor.shutdown(wait=False)

        if self._queue:
            await self._queue.close()

        logger.info("[Worker %s] shutdown complete", self._worker_id)

    # ── Main loop ─────────────────────────────────────────────────────────

    async def _poll_loop(self) -> None:
        """
        Main polling loop.

        Checks queue every 2 seconds when at capacity, every 0.5s when idle.
        Backs off to 5s if queue is empty for 10 consecutive polls.
        """
        empty_polls = 0

        while self._running:
            # Check shutdown
            if self._shutdown_event.is_set():
                break

            # Clean up finished tasks
            finished = [
                jid for jid, task in self._active_jobs.items() if task.done()
            ]
            for jid in finished:
                task = self._active_jobs.pop(jid)
                # Surface any unexpected exceptions
                if task.exception():
                    logger.error(
                        "[Worker %s] task for job %s raised: %s",
                        self._worker_id, jid, task.exception(),
                    )

            # Check capacity
            if len(self._active_jobs) >= self._settings.max_concurrent_solves:
                await asyncio.sleep(2.0)
                continue

            # Try to dequeue
            job = await self._queue.dequeue(self._worker_id)
            if job is None:
                empty_polls += 1
                delay = min(0.5 + (empty_polls * 0.5), 5.0)
                await asyncio.sleep(delay)
                continue

            empty_polls = 0

            # Execute in background task
            task = asyncio.create_task(
                self._execute_job(job),
                name=f"solve-{job.job_id[:8]}",
            )
            self._active_jobs[job.job_id] = task

    # ── Job execution ─────────────────────────────────────────────────────

    async def _execute_job(self, job: SolveJob) -> None:
        """
        Execute a single solve job end-to-end.

        Steps:
          1. Convert SolveJobConfig → SolverConfig
          2. Run solver subprocess (in thread pool)
          3. Parse and import results
          4. Store raw output
          5. Report completion/failure to queue
        """
        job_id = job.job_id
        config = job.config
        start_time = time.monotonic()

        logger.info(
            "[Worker %s] executing job %s (board=%s, positions=%s, attempt=%d)",
            self._worker_id, job_id, config.board_string(),
            config.positions, job.attempt,
        )

        try:
            # Import here to avoid circular deps at module level
            from app.texassolver.config import SolverConfig
            from app.texassolver.runner import run_texassolver, SolveResult
            from app.texassolver.adapter import import_texassolver_solve

            # Check solver availability and log execution mode
            from app.solver_worker.solver_path import (
                resolve_solver_path, docker_solver_available,
            )
            native_bin = resolve_solver_path(
                explicit_path=self._settings.solver_binary,
            )
            if native_bin:
                logger.info(
                    "[Worker %s] job %s — execution mode: NATIVE (%s)",
                    self._worker_id, job_id, native_bin,
                )
            elif docker_solver_available():
                logger.info(
                    "[Worker %s] job %s — execution mode: DOCKER (texassolver:local)",
                    self._worker_id, job_id,
                )
            else:
                error_msg = (
                    "No solver available: native binary not found, "
                    "Docker image texassolver:local not found. "
                    "Run: docker build -f docker/texassolver/Dockerfile.build "
                    "-t texassolver:local ."
                )
                logger.error("[Worker %s] job %s — %s", self._worker_id, job_id, error_msg)
                await self._queue.fail(job_id, error_msg)
                return

            # Build SolverConfig from job config
            solver_config = SolverConfig(
                spot_type=config.spot_type,
                positions=config.positions,
                stack_depth=config.stack_depth,
                board=config.board,
                bet_sizes=config.bet_sizes,
                raise_sizes=config.raise_sizes,
                rake=config.rake,
                iterations=config.max_iterations,
                accuracy_target=config.accuracy_target,
                solver_path=self._settings.solver_binary,
            )

            # Validate config before execution
            errors = solver_config.validate()
            if errors:
                await self._queue.fail(job_id, f"Config validation: {'; '.join(errors)}")
                return

            # Create persistent work directory
            work_dir = self._storage.job_dir(job_id)

            # Run solver in thread pool (blocking subprocess)
            loop = asyncio.get_event_loop()
            solve_result: SolveResult = await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    lambda: run_texassolver(
                        solver_config,
                        timeout=self._settings.solve_timeout_seconds,
                        work_dir=str(work_dir),
                        cleanup=False,  # We manage cleanup
                    ),
                ),
                timeout=self._settings.solve_timeout_seconds + 30,  # Extra buffer
            )

            elapsed = time.monotonic() - start_time

            if not solve_result.success:
                error_msg = solve_result.error or "Unknown solver error"
                if "timed out" in error_msg.lower():
                    await self._queue.timeout(job_id)
                else:
                    await self._queue.fail(job_id, error_msg)
                return

            # Import results into strategy database
            import_result = import_texassolver_solve(
                solver_config,
                solve_result,
                dry_run=False,
            )

            # Parse strategy data for cross-container retrieval via Redis.
            # The API container can't read the worker's local filesystem,
            # so we serialize the parsed strategy into the job result.
            strategy_data = None
            if solve_result.output_path:
                try:
                    from app.texassolver.parser import parse_texassolver_output
                    nodes = parse_texassolver_output(solve_result.output_path, solver_config)
                    strategies = {}
                    for node in nodes:
                        player = "ip" if "ip" in node.node_id else "oop"
                        freq_dict = {a.action_name: round(a.frequency, 4) for a in node.actions}
                        preferred = max(node.actions, key=lambda a: a.frequency).action_name if node.actions else ""
                        combos = []
                        for combo in node.combos[:200]:
                            combos.append({
                                "hand": combo.combo,
                                "actions": {a.action_name: round(a.frequency, 4) for a in combo.actions},
                            })
                        strategies[player] = {
                            "position": node.position,
                            "actions": [a.action_name for a in node.actions],
                            "frequencies": freq_dict,
                            "preferred_action": preferred,
                            "combo_count": len(node.combos),
                            "combos": combos,
                        }
                    primary = strategies.get("oop", strategies.get("ip", {}))
                    strategy_data = {
                        "status": "ready",
                        "mode": "live",
                        "source": "texassolver",
                        "frequencies": primary.get("frequencies", {}),
                        "ev": {},
                        "preferred_action": primary.get("preferred_action", ""),
                        "hero_action_ev_loss": 0.0,
                        "iterations": config.max_iterations,
                        "exploitability": 0.0,
                        "solve_time_ms": round(elapsed * 1000, 1),
                        "cache_hit": False,
                        "node_key": f"{solver_config.spot_type}::{solver_config.positions}::{solver_config.stack_depth}bb",
                        "node_description": (
                            f"{solver_config.ip_position()} vs {solver_config.oop_position()} | "
                            f"{'Flop' if len(solver_config.board) == 3 else 'Turn' if len(solver_config.board) == 4 else 'River'} "
                            f"[{' '.join(solver_config.board)}] | "
                            f"Pot {solver_config.pot_size_bb():.0f}bb"
                        ),
                        "street_supported": True,
                        "strategies": strategies,
                        "board": solver_config.board,
                        "spot_type": solver_config.spot_type,
                        "positions": solver_config.positions,
                    }
                    logger.info(
                        "[Worker %s] strategy_data serialized: %d strategies, primary=%s",
                        self._worker_id, len(strategies), list(primary.get("frequencies", {}).keys()),
                    )
                except Exception as exc:
                    logger.warning("[Worker %s] strategy serialization failed: %s", self._worker_id, exc)

            # Import full game tree into persistent per-node storage
            tree_node_count = 0
            if solve_result.output_path:
                try:
                    import json as _json
                    from app.solver_tree.importer import import_solve_tree
                    from app.solver_tree.store import SolveTreeStore

                    with open(solve_result.output_path, "r", encoding="utf-8") as _f:
                        raw_tree = _json.load(_f)

                    tree_result = import_solve_tree(
                        data=raw_tree,
                        solve_id=job_id,
                        board=config.board,
                        pot_size=solver_config.pot_size_bb(),
                        effective_stack=solver_config.effective_stack_chips(),
                    )
                    tree_node_count = tree_result.total

                    # Persist to Redis (cross-container) if queue has redis
                    tree_store = SolveTreeStore(redis=self._queue.redis)
                    await tree_store.save_tree(
                        solve_id=job_id,
                        nodes=tree_result.nodes,
                        root_id=tree_result.root_id,
                        meta={
                            "board": config.board,
                            "spot_type": config.spot_type,
                            "positions": config.positions,
                            "stack_depth": config.stack_depth,
                            "iterations": config.max_iterations,
                            "solve_time_seconds": elapsed,
                            "action_nodes": tree_result.action_nodes,
                            "chance_nodes": tree_result.chance_nodes,
                            "max_depth": tree_result.max_depth,
                        },
                    )
                    logger.info(
                        "[Worker %s] tree imported: %s",
                        self._worker_id, tree_result.summary(),
                    )
                except Exception as exc:
                    logger.warning(
                        "[Worker %s] tree import failed (non-fatal): %s",
                        self._worker_id, exc,
                    )

            # Compress and archive raw output
            compressed_path = None
            if solve_result.output_path and self._settings.compress_output:
                compressed_path = await loop.run_in_executor(
                    None,
                    self._storage.compress_output,
                    solve_result.output_path,
                    job_id,
                )

            # Build result
            result = SolveJobResult(
                iterations_completed=config.max_iterations,  # Best estimate
                solve_time_seconds=elapsed,
                solve_output_path=solve_result.output_path,
                solve_input_path=solve_result.input_path,
                compressed_output_path=compressed_path,
                nodes_parsed=import_result.parsed,
                nodes_imported=import_result.stored,
                nodes_skipped=import_result.skipped,
                import_errors=[
                    f"{nid}: {err}" for nid, err in import_result.errors
                ],
                node_keys=[],
                strategy_data=strategy_data,
                stdout_tail=(solve_result.stdout or "")[-500:],
                stderr_tail=(solve_result.stderr or "")[-500:],
            )

            await self._queue.complete(job_id, result)

            logger.info(
                "[Worker %s] job %s completed in %.1fs "
                "(parsed=%d, imported=%d, tree_nodes=%d, errors=%d)",
                self._worker_id, job_id, elapsed,
                result.nodes_parsed, result.nodes_imported,
                tree_node_count, len(result.import_errors),
            )

        except asyncio.TimeoutError:
            await self._queue.timeout(job_id)
            logger.error("[Worker %s] job %s hard timeout", self._worker_id, job_id)

        except Exception as exc:
            elapsed = time.monotonic() - start_time
            await self._queue.fail(job_id, f"Worker exception: {exc}")
            logger.exception(
                "[Worker %s] job %s failed after %.1fs",
                self._worker_id, job_id, elapsed,
            )

    # ── Signal handling ───────────────────────────────────────────────────

    def _install_signal_handlers(self) -> None:
        """Install SIGTERM/SIGINT handlers for graceful shutdown."""
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                loop.add_signal_handler(sig, self._handle_signal, sig)
            except NotImplementedError:
                # Windows doesn't support add_signal_handler
                pass

    def _handle_signal(self, sig: signal.Signals) -> None:
        logger.info("[Worker %s] received signal %s, initiating shutdown", self._worker_id, sig)
        self._shutdown_event.set()
        self._running = False


async def run_worker(settings: WorkerSettings | None = None) -> None:
    """Entry point for running a worker process."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    worker = SolveWorker(settings)
    await worker.start()
