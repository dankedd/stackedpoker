"""
Solve result persistence — filesystem storage for raw solver output.

Design:
  - Raw JSON output stored in job-specific directories
  - Compressed (gzip) copies for long-term archival
  - Deterministic directory naming by job_id
  - Future: pluggable backend (S3, GCS) via storage interface

Directory layout:
  /data/solves/output/{job_id}/
    solve_input.txt          — generated input file
    solve_output.json        — raw solver JSON output
  /data/solves/archive/{job_id}.json.gz  — compressed archive
"""

from __future__ import annotations

import gzip
import json
import logging
import shutil
from pathlib import Path

from .settings import WorkerSettings

logger = logging.getLogger(__name__)


class SolveStorage:
    """Filesystem storage manager for solve artifacts."""

    def __init__(self, settings: WorkerSettings) -> None:
        self._output_dir = Path(settings.solve_output_dir)
        self._archive_dir = Path(settings.solve_archive_dir)

    def ensure_dirs(self) -> None:
        """Create base directories if they don't exist."""
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._archive_dir.mkdir(parents=True, exist_ok=True)

    def job_dir(self, job_id: str) -> Path:
        """Get or create the working directory for a specific job."""
        d = self._output_dir / job_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def compress_output(self, output_path: str, job_id: str) -> str | None:
        """
        Compress raw solver output to archive directory.

        Returns the path to the compressed file, or None on failure.
        """
        src = Path(output_path)
        if not src.exists():
            logger.warning("[SolveStorage] output not found for compression: %s", src)
            return None

        dest = self._archive_dir / f"{job_id}.json.gz"
        try:
            with open(src, "rb") as f_in, gzip.open(dest, "wb", compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
            logger.debug("[SolveStorage] compressed %s → %s", src, dest)
            return str(dest)
        except Exception:
            logger.exception("[SolveStorage] compression failed for %s", src)
            return None

    def load_output(self, job_id: str) -> dict | None:
        """
        Load solver output JSON for a completed job.

        Tries uncompressed first, then compressed archive.
        """
        # Try uncompressed
        raw_path = self._output_dir / job_id / "solve_output.json"
        if raw_path.exists():
            with open(raw_path, "r", encoding="utf-8") as f:
                return json.load(f)

        # Try compressed archive
        gz_path = self._archive_dir / f"{job_id}.json.gz"
        if gz_path.exists():
            with gzip.open(gz_path, "rt", encoding="utf-8") as f:
                return json.load(f)

        return None

    def cleanup_job(self, job_id: str, keep_archive: bool = True) -> None:
        """
        Remove working directory for a job.

        By default, keeps the compressed archive.
        """
        job_path = self._output_dir / job_id
        if job_path.exists():
            shutil.rmtree(job_path, ignore_errors=True)
            logger.debug("[SolveStorage] cleaned up %s", job_path)

        if not keep_archive:
            gz_path = self._archive_dir / f"{job_id}.json.gz"
            gz_path.unlink(missing_ok=True)

    def output_size_bytes(self, job_id: str) -> int:
        """Total size of all artifacts for a job."""
        total = 0
        job_path = self._output_dir / job_id
        if job_path.exists():
            for f in job_path.rglob("*"):
                if f.is_file():
                    total += f.stat().st_size
        gz_path = self._archive_dir / f"{job_id}.json.gz"
        if gz_path.exists():
            total += gz_path.stat().st_size
        return total

    def total_archive_size_bytes(self) -> int:
        """Total size of all compressed archives."""
        total = 0
        for f in self._archive_dir.glob("*.json.gz"):
            total += f.stat().st_size
        return total
