"""Canonical XP reward resolution — the server-authoritative source for "how
much XP is step/lesson/module X actually worth," replacing trust in
client-submitted xp_earned / lesson_xp_reward / module_xp_reward values.

ARCHITECTURE
------------
reward_manifest.json (same directory) is a GENERATED artifact —
frontend/scripts/generate-reward-manifest.ts, run via `npm run
generate:reward-manifest` from frontend/ — derived directly from
frontend/lib/learn/curriculum.ts by actually importing and running it (via
sucrase, already a project dependency; no ts-node/tsx needed). curriculum.ts
remains the ONE authoritative source; this JSON file is never hand-edited,
and frontend/lib/learn/__tests__/rewardManifestFreshness.test.ts fails the
test suite if the two ever drift apart (e.g. someone edits a lesson's XP and
forgets to regenerate).

This was chosen over two alternatives:
  - Hand-copying reward numbers into Python: explicitly rejected — the exact
    "another hardcoded giant XP table" anti-pattern this task warned against,
    and guaranteed to silently drift.
  - Populating the pre-existing (currently dormant) `lessons`/`learning_modules`
    Postgres tables — supabase_learning_persistence_migration.sql's own
    comment already documents these as "intentionally left as-is and
    unused... curriculum content stays static in curriculum.ts." Resurrecting
    them for this alone would mean maintaining a second sync target with no
    benefit over a flat file the backend can load with zero network calls.

WHAT THIS DOES vs DOES NOT PROTECT
-----------------------------------
The server is now authoritative for: (1) the base XP value of every step,
lesson, and module, and (2) the quality-tier multiplier applied to it. A
client can no longer claim an arbitrary absolute xp_earned/lesson_xp_reward/
module_xp_reward — the amount actually credited is always
`canonical_base_xp * QUALITY_XP_MULTIPLIER[client_submitted_quality]`.

It does NOT independently re-verify WHICH quality tier an answer actually
earned — that still depends on the client's per-step-type evaluator
(frontend/lib/learn/evaluator.ts), consistent with the existing, deliberate
"ARCHITECTURE RULE" documented at the top of learn.py (answer evaluation is
client-side; the server's job is durable storage + bookkeeping). Re-deriving
correctness for every interactive step type (range grids, drag-and-drop
sorts, sliders, etc.) server-side would be a much larger project explicitly
out of scope here. The practical effect: a tampered client can at most claim
"perfect" (1.0x) on a step it didn't actually answer correctly — bounded by
that step's real authored value, not by an arbitrary flat ceiling. This is
the same class of limitation, just with a much smaller blast radius than
before (previously bounded by MAX_STEP_XP_AWARD=100 regardless of the step's
real value; now bounded by the step's own real value, which is usually 2-28).
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_MANIFEST_PATH = Path(__file__).parent / "reward_manifest.json"

# Mirrors frontend/lib/learn/evaluator.ts's QUALITY_XP_MULT exactly — the
# other half of "canonical reward," alongside the manifest's base amounts.
# Small and stable enough to hardcode directly (not curriculum content).
QUALITY_XP_MULTIPLIER: dict[str, float] = {
    "perfect": 1.00,
    "good": 0.80,
    "acceptable": 0.50,
    "mistake": 0.20,
    "punt": 0.00,
}


@lru_cache(maxsize=1)
def _load_manifest() -> dict:
    try:
        with open(_MANIFEST_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logger.error(
            "reward_manifest.json missing or invalid at %s — every step/lesson/"
            "module XP award will resolve to 0 until this is fixed "
            "(run `npm run generate:reward-manifest` in frontend/).",
            _MANIFEST_PATH,
        )
        return {"lessons": {}, "modules": {}}


def resolve_step_xp(lesson_id: str, step_id: str, quality: str) -> int:
    """Canonical XP for a single step result. Ignores any client-submitted
    amount entirely — only `quality` (which tier the client's own evaluator
    assigned the answer) scales the server-known base value."""
    manifest = _load_manifest()
    lesson = manifest.get("lessons", {}).get(lesson_id)
    if lesson is None:
        logger.warning(
            "resolve_step_xp: unknown lesson_id=%s (manifest stale, or an invalid/tampered request)",
            lesson_id,
        )
        return 0
    base_xp = lesson.get("steps", {}).get(step_id)
    if base_xp is None:
        logger.warning(
            "resolve_step_xp: unknown step_id=%s in lesson=%s (manifest stale, or an invalid/tampered request)",
            step_id, lesson_id,
        )
        return 0
    multiplier = QUALITY_XP_MULTIPLIER.get(quality)
    if multiplier is None:
        logger.warning("resolve_step_xp: unrecognized quality=%r — treating as 0", quality)
        return 0
    return round(base_xp * multiplier)


def resolve_lesson_bonus_xp(lesson_id: str, score: int) -> int:
    """Canonical one-time lesson-completion bonus, scaled by score%. Ignores
    any client-submitted lesson_xp_reward entirely."""
    manifest = _load_manifest()
    lesson = manifest.get("lessons", {}).get(lesson_id)
    if lesson is None:
        logger.warning("resolve_lesson_bonus_xp: unknown lesson_id=%s", lesson_id)
        return 0
    reward = lesson.get("xp_reward", 0)
    score_pct = max(0, min(100, score)) / 100
    return int(round(reward * score_pct))


def resolve_module_bonus_xp(module_id: str) -> int:
    """Canonical one-time module-completion bonus. Ignores any
    client-submitted module_xp_reward entirely."""
    manifest = _load_manifest()
    reward = manifest.get("modules", {}).get(module_id)
    if reward is None:
        logger.warning("resolve_module_bonus_xp: unknown module_id=%s", module_id)
        return 0
    return reward
