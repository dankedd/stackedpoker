"""Dev-only features (app/services/features.py) are refused by the API for
everyone without development access — as a visitor (no token), a normal
user and an admin."""
import asyncio

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes import learn
from app.middleware.auth import get_current_user
from app.services import features


def test_learn_and_puzzles_are_dev_only():
    assert features.FEATURES == {"learn": "dev", "puzzles": "dev"}
    assert not features.is_feature_public("learn")
    assert features.has_dev_access("admin")
    for tier in ("free", "pro", "premium", None):
        assert not features.has_dev_access(tier)


@pytest.mark.parametrize("tier,allowed", [("free", False), ("pro", False), ("premium", False), ("admin", True)])
def test_require_feature_checks_the_callers_tier(monkeypatch, tier, allowed):
    async def fake_tier(user_id, settings=None):
        return tier

    monkeypatch.setattr(features, "get_subscription_tier", fake_tier)
    check = features.require_feature("learn")
    if allowed:
        asyncio.run(check({"sub": "u1"}))
    else:
        with pytest.raises(HTTPException) as e:
            asyncio.run(check({"sub": "u1"}))
        assert e.value.status_code == 403


GATED = [
    ("post", "/api/learn/steps/l1/s1"),
    ("post", "/api/learn/lessons/l1/complete"),
    ("post", "/api/learn/modules/m1/complete"),
    ("post", "/api/learn/leaks/k1/resolve"),
    ("post", "/api/learn/merge-guest-progress"),
]


def _client(tier: str | None, monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(learn.router, prefix="/api")

    async def fake_tier(user_id, settings=None):
        return tier

    monkeypatch.setattr(features, "get_subscription_tier", fake_tier)
    if tier is not None:
        app.dependency_overrides[get_current_user] = lambda: {"sub": "u1"}
    return TestClient(app)


def test_visitor_gets_401_on_every_lesson_endpoint(monkeypatch):
    c = _client(None, monkeypatch)
    for method, path in GATED:
        assert getattr(c, method)(path, json={}).status_code == 401, path


@pytest.mark.parametrize("tier", ["free", "pro", "premium"])
def test_normal_users_get_403_on_every_lesson_endpoint(monkeypatch, tier):
    c = _client(tier, monkeypatch)
    for method, path in GATED:
        r = getattr(c, method)(path, json={})
        assert r.status_code == 403, (path, r.status_code)
        assert r.json()["detail"] == "This feature is not available yet."


def test_admin_passes_the_feature_gate(monkeypatch):
    c = _client("admin", monkeypatch)
    for method, path in GATED:
        r = getattr(c, method)(path, json={})
        # Past the gate: whatever happens next (validation, DB), it is not the feature 403.
        assert not (r.status_code == 403 and r.json().get("detail") == "This feature is not available yet."), path
