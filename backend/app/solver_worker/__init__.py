"""
solver_worker — offline solve pipeline with Redis queues and background workers.

Architecture:
  FastAPI → queue.enqueue_solve() → Redis → ARQ worker → TexasSolver subprocess
  → parse → import → StrategyStore / PostgreSQL

Modules:
  models.py     — SolveJob, SolveJobStatus, SolveJobResult Pydantic models
  queue.py      — Redis queue management, job submission, status tracking
  worker.py     — ARQ worker definition, job execution, timeout/OOM handling
  scheduler.py  — Batch solve generation, spot enumeration, priority scheduling
  storage.py    — Raw solve result persistence (filesystem, future S3)
  health.py     — Worker health checks, watchdog, liveness probes
  metrics.py    — Prometheus metrics, structured logging
  settings.py   — Worker-specific configuration
"""
