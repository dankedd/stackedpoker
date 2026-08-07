"""Tests for curriculum_access.py — the backend mirror of
frontend/lib/entitlements.ts's canAccessModule/canAccessLesson. Uses a fake
manifest (not the real, generated one) so these tests exercise the RULE in
isolation, independent of the current shape of curriculum.ts."""
from __future__ import annotations

from app.engines.learn import curriculum_access


FAKE_MANIFEST = {
    "modules": {
        "mod-1": {"order": 1},
        "mod-2": {"order": 2},
        "mod-3": {"order": 3},
        "mod-4": {"order": 4},
        "mod-roadmap-a": {"order": None},
        "mod-roadmap-b": {"order": None},
    },
    "lessons": {
        "m1-l1": {"module_id": "mod-1", "sort_order": 1},
        "m1-l2": {"module_id": "mod-1", "sort_order": 2},
        "m2-l1": {"module_id": "mod-2", "sort_order": 1},
        "m3-l1": {"module_id": "mod-3", "sort_order": 1},
        "m3-l2": {"module_id": "mod-3", "sort_order": 2},
        "m3-l3": {"module_id": "mod-3", "sort_order": 3},
        "m4-l1": {"module_id": "mod-4", "sort_order": 1},
    },
}


def _patch_manifest(monkeypatch):
    curriculum_access._load_manifest.cache_clear()
    monkeypatch.setattr(curriculum_access, "_load_manifest", lambda: FAKE_MANIFEST)


def test_every_lesson_in_module_1_or_2_is_free(monkeypatch):
    _patch_manifest(monkeypatch)
    assert curriculum_access.can_access_lesson("free", "m1-l1") is True
    assert curriculum_access.can_access_lesson("free", "m1-l2") is True
    assert curriculum_access.can_access_lesson("free", "m2-l1") is True


def test_only_the_first_lesson_of_module_3_plus_is_free(monkeypatch):
    _patch_manifest(monkeypatch)
    assert curriculum_access.can_access_lesson("free", "m3-l1") is True
    assert curriculum_access.can_access_lesson("free", "m3-l2") is False
    assert curriculum_access.can_access_lesson("free", "m3-l3") is False
    assert curriculum_access.can_access_lesson("free", "m4-l1") is True  # module 4's own first lesson


def test_paid_tiers_get_every_lesson(monkeypatch):
    _patch_manifest(monkeypatch)
    for tier in ("pro", "premium", "admin"):
        assert curriculum_access.can_access_lesson(tier, "m3-l2") is True
        assert curriculum_access.can_access_lesson(tier, "m3-l3") is True


def test_unknown_lesson_id_is_never_accessible_for_free(monkeypatch):
    """A forged/stale lesson_id (not in the manifest) must fail closed for a
    free-tier caller, not open — this is exactly the "direct API request
    with a made-up id" attack the membership-system plan calls out. Paid
    tiers short-circuit to True before ever consulting the manifest (same as
    entitlements.ts) — an unrecognized id is moot for them, they're allowed
    everything regardless."""
    _patch_manifest(monkeypatch)
    assert curriculum_access.can_access_lesson("free", "does-not-exist") is False


def test_none_tier_is_treated_as_free(monkeypatch):
    _patch_manifest(monkeypatch)
    assert curriculum_access.can_access_lesson(None, "m3-l2") is False
    assert curriculum_access.can_access_lesson(None, "m1-l1") is True


def test_roadmap_only_modules_never_count_toward_the_free_first_two(monkeypatch):
    """Modules with order: None (curriculum.ts's roadmap-only placeholders)
    must never be mistaken for module 1 or 2 — this is the exact bug class
    sort_order (vs. order) ranking would have caused, see entitlements.ts."""
    _patch_manifest(monkeypatch)
    assert curriculum_access._module_is_free(FAKE_MANIFEST, "mod-roadmap-a") is False
    assert curriculum_access._module_is_free(FAKE_MANIFEST, "mod-roadmap-b") is False
    assert curriculum_access._module_is_free(FAKE_MANIFEST, "mod-1") is True
    assert curriculum_access._module_is_free(FAKE_MANIFEST, "mod-2") is True
    assert curriculum_access._module_is_free(FAKE_MANIFEST, "mod-3") is False


def test_missing_manifest_file_fails_closed(monkeypatch):
    """If the generated manifest is missing/corrupt, every lesson must
    resolve as locked for free users rather than silently wide open."""
    curriculum_access._load_manifest.cache_clear()
    monkeypatch.setattr(curriculum_access, "_MANIFEST_PATH", curriculum_access._MANIFEST_PATH.parent / "does-not-exist.json")
    assert curriculum_access.can_access_lesson("free", "m1-l1") is False
    curriculum_access._load_manifest.cache_clear()
