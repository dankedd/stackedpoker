"""
Batch scheduler — systematic solve job generation for coverage expansion.

Strategy:
  The solver can't pre-solve every possible board (2.6M flop combos), so we
  solve representative boards per board_class and aggregate via the existing
  similarity/retrieval system.

Solve matrix dimensions:
  spot_type      × {SRP, 3BET}                           = 2
  positions      × {BTN_vs_BB, CO_vs_BB, SB_vs_BB, ...}  = ~8 (high-value)
  stack_depth    × {40, 60, 100}                          = 3
  board_class    × {A_HIGH_DRY, K_HIGH_WET, ...}         = ~18
  street         × {flop}                                 = 1 (MVP)
  bet_sizes      × {[0.33,0.75], [0.5,1.0]}              = 2 tree configs

  Total Phase 2 MVP: ~2 × 8 × 3 × 18 × 2 = 1,728 solves
  At ~3min/solve avg: ~86 worker-hours ≈ 3.6 days on 1 worker, <1 day on 4 workers

Prioritization:
  1. SRP BTN_vs_BB 100bb (most common spot in real play)
  2. SRP other positions 100bb
  3. 3BET matchups 100bb
  4. Different stack depths
  5. Alternative bet size trees
"""

from __future__ import annotations

import itertools
import logging
import random
from typing import Sequence

from .models import SolveJobConfig, SolveJobPriority
from .queue import SolveQueue

logger = logging.getLogger(__name__)


# ── Representative boards per board class ─────────────────────────────────
# Each board class gets 2-3 representative boards for solve diversity.

REPRESENTATIVE_BOARDS: dict[str, list[list[str]]] = {
    "A_HIGH_DRY": [
        ["Ah", "7d", "2c"],
        ["As", "9c", "3h"],
    ],
    "A_HIGH_WET": [
        ["Ah", "Kh", "Jc"],
        ["Ad", "Td", "9s"],
    ],
    "K_HIGH_DRY": [
        ["Kc", "7h", "2d"],
        ["Ks", "8d", "3c"],
    ],
    "K_HIGH_WET": [
        ["Kh", "Qh", "Ts"],
        ["Kd", "Jd", "9c"],
    ],
    "LOW_CONNECTED": [
        ["8s", "7d", "6c"],
        ["7h", "6c", "5d"],
    ],
    "LOW_DYNAMIC": [
        ["6h", "5d", "3c"],
        ["5s", "4h", "2d"],
    ],
    "MIDDLE_CONNECTED": [
        ["Ts", "9h", "8d"],
        ["9c", "8d", "7s"],
    ],
    "DOUBLE_BROADWAY": [
        ["Kd", "Qs", "3c"],
        ["Qh", "Jc", "5d"],
    ],
    "TRIPLE_BROADWAY": [
        ["Kh", "Qd", "Js"],
        ["As", "Kd", "Qc"],
    ],
    "PAIRED_LOW": [
        ["7h", "7d", "3c"],
        ["5s", "5c", "9h"],
    ],
    "PAIRED_HIGH": [
        ["Kh", "Kd", "6c"],
        ["Qs", "Qc", "8h"],
    ],
    "MONOTONE": [
        ["Ah", "9h", "4h"],
        ["Ks", "Ts", "6s"],
    ],
    "RAINBOW_STATIC": [
        ["Kh", "8d", "3c"],
        ["Qs", "7h", "2d"],
    ],
    "RAINBOW_DYNAMIC": [
        ["Th", "9d", "7c"],
        ["Jh", "8d", "6c"],
    ],
    "FLUSH_COMPLETING": [
        ["Ah", "8h", "5h", "Kh"],  # Turn board — flush completes
    ],
    "STRAIGHT_COMPLETING": [
        ["Jh", "Td", "9c", "8s"],  # Turn board — straight completes
    ],
    "NEUTRAL": [
        ["Qd", "8c", "4h"],
        ["Js", "6d", "2c"],
    ],
}


# ── Position matchups in priority order ───────────────────────────────────

PRIORITY_POSITIONS: list[str] = [
    "BTN_vs_BB",     # Most common HU spot
    "CO_vs_BB",
    "SB_vs_BB",
    "BTN_vs_SB",
    "HJ_vs_BB",
    "CO_vs_SB",
    "LJ_vs_BB",
    "UTG_vs_BB",
]


# ── Bet size configurations ──────────────────────────────────────────────

BET_SIZE_CONFIGS: list[dict] = [
    {"bet_sizes": [0.33, 0.75], "raise_sizes": [0.5, 1.0], "label": "standard"},
    {"bet_sizes": [0.5, 1.0], "raise_sizes": [0.75, 1.5], "label": "polarized"},
]


class SolveScheduler:
    """
    Generates and enqueues systematic solve jobs for coverage expansion.

    Usage:
        scheduler = SolveScheduler(queue)
        jobs = await scheduler.generate_coverage_batch(
            spot_types=["SRP"],
            stack_depths=[100],
        )
    """

    def __init__(self, queue: SolveQueue) -> None:
        self._queue = queue

    async def generate_coverage_batch(
        self,
        *,
        spot_types: Sequence[str] = ("SRP", "3BET"),
        positions: Sequence[str] | None = None,
        stack_depths: Sequence[int] = (100,),
        board_classes: Sequence[str] | None = None,
        bet_config_index: int = 0,
        priority: SolveJobPriority = SolveJobPriority.NORMAL,
        max_jobs: int = 500,
        shuffle: bool = True,
    ) -> list[str]:
        """
        Generate solve jobs for all combinations of the given dimensions.

        Returns list of created job_ids.
        Deduplication is handled by the queue — already-solved spots are skipped.
        """
        if positions is None:
            positions = PRIORITY_POSITIONS
        if board_classes is None:
            board_classes = list(REPRESENTATIVE_BOARDS.keys())

        bet_config = BET_SIZE_CONFIGS[min(bet_config_index, len(BET_SIZE_CONFIGS) - 1)]

        combos = list(itertools.product(spot_types, positions, stack_depths, board_classes))

        if shuffle:
            random.shuffle(combos)

        job_ids: list[str] = []

        for spot_type, pos, stack, board_class in combos:
            if len(job_ids) >= max_jobs:
                break

            boards = REPRESENTATIVE_BOARDS.get(board_class, [])
            if not boards:
                continue

            for board in boards:
                if len(job_ids) >= max_jobs:
                    break

                config = SolveJobConfig(
                    spot_type=spot_type,
                    positions=pos,
                    stack_depth=stack,
                    board=board,
                    bet_sizes=bet_config["bet_sizes"],
                    raise_sizes=bet_config["raise_sizes"],
                    max_iterations=500,
                    accuracy_target=0.3,
                    use_isomorphism=True,
                    thread_count=4,
                    priority=priority,
                    tags=[f"batch:{board_class}", f"tree:{bet_config['label']}"],
                    board_class=board_class,
                )

                job = await self._queue.enqueue(
                    config, priority=priority, deduplicate=True,
                )
                if job is not None:
                    job_ids.append(job.job_id)

        logger.info(
            "[Scheduler] generated %d jobs from %d combinations "
            "(spot_types=%s, stacks=%s)",
            len(job_ids), len(combos), spot_types, stack_depths,
        )
        return job_ids

    async def generate_single_spot(
        self,
        *,
        spot_type: str,
        positions: str,
        stack_depth: int,
        board: list[str],
        priority: SolveJobPriority = SolveJobPriority.HIGH,
        accuracy_target: float = 0.3,
        max_iterations: int = 500,
    ) -> str | None:
        """
        Enqueue a single solve job for a specific spot.

        Returns the job_id, or None if deduplicated.
        """
        config = SolveJobConfig(
            spot_type=spot_type,
            positions=positions,
            stack_depth=stack_depth,
            board=board,
            accuracy_target=accuracy_target,
            max_iterations=max_iterations,
            priority=priority,
            tags=["single"],
        )

        job = await self._queue.enqueue(config, priority=priority, deduplicate=True)
        return job.job_id if job else None

    async def estimate_batch_size(
        self,
        spot_types: Sequence[str] = ("SRP", "3BET"),
        positions: Sequence[str] | None = None,
        stack_depths: Sequence[int] = (100,),
        board_classes: Sequence[str] | None = None,
    ) -> dict:
        """
        Estimate the number of jobs a coverage batch would generate.

        Returns stats without actually enqueuing anything.
        """
        if positions is None:
            positions = PRIORITY_POSITIONS
        if board_classes is None:
            board_classes = list(REPRESENTATIVE_BOARDS.keys())

        total_boards = sum(
            len(REPRESENTATIVE_BOARDS.get(bc, []))
            for bc in board_classes
        )
        total_combos = len(spot_types) * len(positions) * len(stack_depths) * total_boards

        # Rough time estimates
        avg_solve_minutes = 3.0  # Conservative for flop solves
        estimated_hours = (total_combos * avg_solve_minutes) / 60

        return {
            "spot_types": len(spot_types),
            "positions": len(positions),
            "stack_depths": len(stack_depths),
            "board_classes": len(board_classes),
            "total_boards": total_boards,
            "total_jobs": total_combos,
            "estimated_worker_hours": round(estimated_hours, 1),
            "estimated_hours_4_workers": round(estimated_hours / 4, 1),
        }
