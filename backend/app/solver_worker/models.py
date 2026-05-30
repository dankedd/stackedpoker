"""
Solve job models — Pydantic schemas for the entire job lifecycle.

Lifecycle:
  PENDING → QUEUED → RUNNING → (COMPLETED | FAILED | TIMEOUT | CANCELLED)
                              → RETRY → QUEUED (re-enqueue)
                              → DEAD_LETTER (max retries exceeded)

Design decisions:
  - Pydantic v2 for validation + serialization to Redis/JSON
  - job_id is a UUID4 string — globally unique, no collisions across workers
  - SolveJobConfig is a strict superset of SolverConfig — adds queue metadata
  - SolveJobResult captures everything needed for post-mortem and import
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SolveJobStatus(str, Enum):
    """Job lifecycle states — stored in Redis as the canonical source of truth."""
    PENDING = "pending"             # Created, not yet queued
    QUEUED = "queued"               # In Redis queue, waiting for worker
    RUNNING = "running"             # Worker picked it up, solver executing
    COMPLETED = "completed"         # Solve finished, results parsed and stored
    FAILED = "failed"               # Unrecoverable error (bad config, parse failure)
    TIMEOUT = "timeout"             # Solver exceeded time limit
    CANCELLED = "cancelled"         # Manually cancelled via API
    RETRY = "retry"                 # Scheduled for retry after transient failure
    DEAD_LETTER = "dead_letter"     # Max retries exceeded, moved to DLQ


class SolveJobPriority(int, Enum):
    """Queue priority — lower number = higher priority."""
    CRITICAL = 0    # Live analysis fallback (should rarely queue)
    HIGH = 10       # User-requested solve
    NORMAL = 50     # Scheduled batch solve
    LOW = 90        # Background coverage expansion
    BACKFILL = 100  # Historical gap-filling


class SolveJobConfig(BaseModel):
    """
    Complete solve specification — everything needed to reproduce a solve.

    Extends SolverConfig with queue metadata (priority, tags, ranges).
    This is the payload that travels through the queue.
    """

    # ── Spot definition ───────────────────────────────────────────────────
    spot_type: str = "SRP"
    positions: str = "BTN_vs_BB"
    stack_depth: int = 100
    board: list[str] = Field(min_length=3, max_length=5)

    # ── Ranges (full range strings for IP and OOP) ────────────────────────
    range_ip: str = ""    # Empty = use default for position
    range_oop: str = ""

    # ── Sizing options ────────────────────────────────────────────────────
    # 1 bet size per street for performance: 1 size ≈ 3 min, 2 sizes ≈ 12 min.
    # Turn/river default to 75% — larger bets are GTO-standard on later streets.
    bet_sizes: list[float] = Field(default_factory=lambda: [0.33])
    raise_sizes: list[float] = Field(default_factory=lambda: [0.6])
    turn_bet_sizes: list[float] = Field(default_factory=lambda: [0.75])
    turn_raise_sizes: list[float] = Field(default_factory=lambda: [0.6])
    river_bet_sizes: list[float] = Field(default_factory=lambda: [0.75])
    river_raise_sizes: list[float] = Field(default_factory=lambda: [0.6])
    donk_sizes: list[float] = Field(default_factory=list)
    rake: float | None = None

    # ── Solver parameters ─────────────────────────────────────────────────
    max_iterations: int = Field(default=500, ge=10, le=10000)
    accuracy_target: float = Field(default=0.3, gt=0, le=10.0)
    use_isomorphism: bool = True
    thread_count: int = Field(default=4, ge=1, le=32)

    # ── Queue metadata ────────────────────────────────────────────────────
    priority: SolveJobPriority = SolveJobPriority.NORMAL
    tags: list[str] = Field(default_factory=list)

    # ── Abstraction tags (for NodeKey mapping) ────────────────────────────
    board_class: str | None = None       # Pre-classified if known
    spr_bucket: str | None = None
    stack_depth_bucket: str | None = None

    def street(self) -> str:
        """Derive street from board card count."""
        n = len(self.board)
        if n == 3:
            return "flop"
        if n == 4:
            return "turn"
        return "river"

    def board_string(self) -> str:
        return ",".join(self.board)

    def to_solver_config(self) -> dict:
        """Convert to SolverConfig-compatible dict for runner.py."""
        return {
            "spot_type": self.spot_type,
            "positions": self.positions,
            "stack_depth": self.stack_depth,
            "board": self.board,
            "bet_sizes": self.bet_sizes,
            "raise_sizes": self.raise_sizes,
            "turn_bet_sizes": self.turn_bet_sizes,
            "turn_raise_sizes": self.turn_raise_sizes,
            "river_bet_sizes": self.river_bet_sizes,
            "river_raise_sizes": self.river_raise_sizes,
            "rake": self.rake,
            "iterations": self.max_iterations,
            "accuracy_target": self.accuracy_target,
        }


class SolveJob(BaseModel):
    """
    Complete solve job — the unit of work that flows through the system.

    Created by the scheduler or API, serialized to Redis, consumed by workers.
    """

    # ── Identity ──────────────────────────────────────────────────────────
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # ── Configuration ─────────────────────────────────────────────────────
    config: SolveJobConfig

    # ── Lifecycle ─────────────────────────────────────────────────────────
    status: SolveJobStatus = SolveJobStatus.PENDING
    priority: SolveJobPriority = SolveJobPriority.NORMAL

    # ── Execution tracking ────────────────────────────────────────────────
    attempt: int = 0
    max_retries: int = 3
    queued_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    worker_id: str | None = None

    # ── Result (populated after completion) ───────────────────────────────
    result: SolveJobResult | None = None

    # ── Error tracking ────────────────────────────────────────────────────
    error: str | None = None
    error_history: list[str] = Field(default_factory=list)

    def is_terminal(self) -> bool:
        """True if job is in a final state (no more transitions)."""
        return self.status in {
            SolveJobStatus.COMPLETED,
            SolveJobStatus.FAILED,
            SolveJobStatus.CANCELLED,
            SolveJobStatus.DEAD_LETTER,
        }

    def can_retry(self) -> bool:
        return self.attempt < self.max_retries and not self.is_terminal()

    def duration_seconds(self) -> float | None:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def wait_seconds(self) -> float | None:
        if self.queued_at and self.started_at:
            return (self.started_at - self.queued_at).total_seconds()
        return None


class SolveJobResult(BaseModel):
    """
    Solve result metadata — stored alongside the job after completion.

    The actual JSON output lives on disk (solve_output_path); this model
    captures metrics and import results for monitoring and retrieval.
    """

    # ── Solver output ─────────────────────────────────────────────────────
    iterations_completed: int = 0
    exploitability: float | None = None
    solve_time_seconds: float = 0.0
    peak_memory_mb: float | None = None

    # ── Output files ──────────────────────────────────────────────────────
    solve_output_path: str | None = None     # Raw JSON from solver
    solve_input_path: str | None = None      # Generated input file
    compressed_output_path: str | None = None  # gzip'd JSON

    # ── Import results ────────────────────────────────────────────────────
    nodes_parsed: int = 0          # RawSolverNodes extracted by strategy parser
    nodes_imported: int = 0        # StrategyNodes written to strategy DB
    nodes_skipped: int = 0
    import_errors: list[str] = Field(default_factory=list)
    tree_nodes_imported: int = 0   # Game-tree nodes imported into SolveTreeStore

    # ── Node keys produced ────────────────────────────────────────────────
    node_keys: list[str] = Field(default_factory=list)

    # ── Parsed strategy (serialized for cross-container retrieval) ──────
    # Populated by the worker after parsing. The API reads this from Redis
    # instead of re-reading the output file (which lives on the worker's
    # local filesystem and isn't accessible from the API container).
    strategy_data: dict | None = None

    # ── Solver stdout/stderr (truncated for debugging) ────────────────────
    stdout_tail: str = ""
    stderr_tail: str = ""


class SolveJobSummary(BaseModel):
    """Lightweight view for API list endpoints — no full result payload."""
    job_id: str
    status: SolveJobStatus
    priority: SolveJobPriority
    spot_type: str
    positions: str
    board: str
    street: str
    attempt: int
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None
    error: str | None = None
    nodes_imported: int = 0

    @classmethod
    def from_job(cls, job: SolveJob) -> SolveJobSummary:
        return cls(
            job_id=job.job_id,
            status=job.status,
            priority=job.priority,
            spot_type=job.config.spot_type,
            positions=job.config.positions,
            board=job.config.board_string(),
            street=job.config.street(),
            attempt=job.attempt,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            duration_seconds=job.duration_seconds(),
            error=job.error,
            nodes_imported=job.result.nodes_imported if job.result else 0,
        )


class BatchSolveRequest(BaseModel):
    """API request to enqueue a batch of solves."""
    configs: list[SolveJobConfig]
    priority: SolveJobPriority = SolveJobPriority.NORMAL
    deduplicate: bool = True   # Skip if identical solve already completed


class BatchSolveResponse(BaseModel):
    """API response after batch enqueue."""
    total_submitted: int
    jobs_created: int
    jobs_deduplicated: int
    job_ids: list[str]
