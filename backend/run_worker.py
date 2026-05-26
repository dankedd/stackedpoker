"""
Entry point for running a solve worker process.

Usage:
    python run_worker.py

Environment variables:
    REDIS_URL              — Redis connection URL (default: redis://localhost:6379/0)
    TEXASSOLVER_BIN        — Path to TexasSolver binary
    TEXASSOLVER_RESOURCE_DIR — Path to solver resource files
    SOLVE_TIMEOUT          — Max seconds per solve (default: 600)
    MAX_CONCURRENT_SOLVES  — Concurrent solves per worker (default: 2)
    SOLVER_THREADS         — OpenMP threads per solve (default: 4)
    SOLVE_OUTPUT_DIR       — Directory for solve output files
    DATABASE_URL           — PostgreSQL connection URL
    LOG_LEVEL              — Logging level (default: INFO)
"""

import asyncio
import sys

from app.solver_worker.worker import run_worker
from app.solver_worker.settings import WorkerSettings


def main() -> None:
    settings = WorkerSettings.from_env()
    print(f"Starting solve worker with settings:")
    print(f"  Redis:           {settings.redis_url}")
    print(f"  Solver binary:   {settings.solver_binary}")
    print(f"  Concurrency:     {settings.max_concurrent_solves}")
    print(f"  Threads/solve:   {settings.max_worker_threads}")
    print(f"  Timeout:         {settings.solve_timeout_seconds}s")
    print(f"  Output dir:      {settings.solve_output_dir}")

    try:
        asyncio.run(run_worker(settings))
    except KeyboardInterrupt:
        print("\nWorker stopped by user")
        sys.exit(0)


if __name__ == "__main__":
    main()
