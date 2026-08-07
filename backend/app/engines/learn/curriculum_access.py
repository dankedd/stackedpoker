"""Server-side Learn lesson/module access enforcement — the backend mirror
of frontend/lib/entitlements.ts's canAccessModule/canAccessLesson.

ARCHITECTURE
------------
curriculum_access_manifest.json (same directory) is a GENERATED artifact —
frontend/scripts/generate-curriculum-access-manifest.ts, run via `npm run
generate:curriculum-access-manifest` from frontend/ — derived from
curriculum.ts's actual lesson/module ordering (module_id, sort_order, module
order). curriculum.ts remains the ONE authoritative source for that
ordering; this JSON file is never hand-edited, and
frontend/lib/learn/__tests__/curriculumAccessManifestFreshness.test.ts fails
the test suite if the two ever drift apart. Mirrors reward_resolver.py's
exact manifest pattern.

The ACCESS RULE itself (first two modules by `order` fully free, every other
module's lowest-`sort_order` lesson free) is necessarily duplicated here as
Python logic — there's no shared runtime between Next.js and FastAPI — but
it is a small, stable, directly-tested mirror of lib/entitlements.ts's
canAccessModule/canAccessLesson, not a second source of truth for the DATA
those functions operate on.

WHY THIS MATTERS: api/routes/learn.py's step-result and lesson-complete
endpoints must reject a write for a lesson the caller's tier doesn't unlock.
Without this, a locked lesson's content is invisible in the UI (see the
membership-system plan's Part 3, the lesson page's server-side gate) but
could still be marked "completed" via a raw POST to these endpoints —
exactly the "URL/API/console/direct request" bypass the plan requires
closing.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

from app.services.entitlements import is_paid_tier

logger = logging.getLogger(__name__)

_MANIFEST_PATH = Path(__file__).parent / "curriculum_access_manifest.json"

_FREE_FULL_MODULE_COUNT = 2


@lru_cache(maxsize=1)
def _load_manifest() -> dict:
    try:
        with open(_MANIFEST_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logger.error(
            "curriculum_access_manifest.json missing or invalid at %s — every "
            "lesson will resolve as inaccessible to free-tier users until this "
            "is fixed (run `npm run generate:curriculum-access-manifest` in "
            "frontend/).",
            _MANIFEST_PATH,
        )
        return {"lessons": {}, "modules": {}}


def can_access_lesson(tier: str | None, lesson_id: str) -> bool:
    """True if `tier` unlocks `lesson_id` — mirrors
    lib/entitlements.ts's canAccessLesson exactly. An unknown lesson_id
    (missing from the manifest, e.g. a stale/forged id) is never accessible,
    the same fail-closed default entitlements.ts uses for an empty lesson
    list."""
    if is_paid_tier(tier):
        return True

    manifest = _load_manifest()
    lesson = manifest["lessons"].get(lesson_id)
    if lesson is None:
        return False

    module_id = lesson["module_id"]
    if _module_is_free(manifest, module_id):
        return True

    sibling_sort_orders = [
        l["sort_order"] for l in manifest["lessons"].values() if l["module_id"] == module_id
    ]
    if not sibling_sort_orders:
        return False
    return lesson["sort_order"] == min(sibling_sort_orders)


def _module_is_free(manifest: dict, module_id: str) -> bool:
    module = manifest["modules"].get(module_id)
    if module is None or module.get("order") is None:
        return False

    all_orders = sorted(
        m["order"] for m in manifest["modules"].values() if m.get("order") is not None
    )
    rank = all_orders.index(module["order"]) if module["order"] in all_orders else -1
    return 0 <= rank < _FREE_FULL_MODULE_COUNT
