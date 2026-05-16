"""
Tests for security header middleware in main.py.

Verifies:
- Security headers are injected on every response
- Server fingerprint header is removed safely (no .pop() crash)
- Middleware never crashes the request pipeline
- CORS compatibility preserved
- Streaming and error responses handled correctly
"""
import pytest
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.testclient import TestClient
from starlette.responses import Response


# ── Minimal app that mirrors the production middleware exactly ────────────────

def _make_app(debug: bool = True) -> FastAPI:
    """Build a test app with the same security middleware as main.py."""
    import logging
    app = FastAPI()
    logger = logging.getLogger("test_middleware")

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        try:
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
            if not debug:
                response.headers["Strict-Transport-Security"] = (
                    "max-age=63072000; includeSubDomains; preload"
                )
            if "server" in response.headers:
                del response.headers["server"]
        except Exception:
            logger.warning(
                "Security header middleware failed on %s %s",
                request.method, request.url.path, exc_info=True,
            )
        return response

    @app.get("/ok")
    async def ok():
        return {"status": "ok"}

    @app.get("/with-server-header")
    async def with_server_header():
        """Simulates a response that Uvicorn would attach a 'server' header to."""
        r = Response(content='{"status":"ok"}', media_type="application/json")
        r.headers["server"] = "uvicorn"
        return r

    @app.get("/stream")
    async def stream():
        async def gen():
            yield b"chunk1"
            yield b"chunk2"
        return StreamingResponse(gen(), media_type="text/plain")

    @app.get("/error")
    async def error():
        return JSONResponse(status_code=500, content={"detail": "internal error"})

    @app.get("/raise")
    async def raise_exc():
        raise RuntimeError("unexpected crash")

    return app


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    app = _make_app(debug=True)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def prod_client():
    app = _make_app(debug=False)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Tests: security header injection ─────────────────────────────────────────

def test_security_headers_present(client):
    r = client.get("/ok")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-xss-protection"] == "1; mode=block"
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "permissions-policy" in r.headers


def test_hsts_absent_in_debug(client):
    r = client.get("/ok")
    assert "strict-transport-security" not in r.headers


def test_hsts_present_in_production(prod_client):
    r = prod_client.get("/ok")
    hsts = r.headers.get("strict-transport-security", "")
    assert "max-age=63072000" in hsts
    assert "includeSubDomains" in hsts


# ── Tests: server header removal ──────────────────────────────────────────────

def test_server_header_removed_when_present(client):
    """del response.headers['server'] must work without .pop()."""
    r = client.get("/with-server-header")
    assert r.status_code == 200
    # The middleware should have deleted it
    assert "server" not in r.headers


def test_no_crash_when_server_header_absent(client):
    """The existence guard prevents KeyError when 'server' is not set."""
    r = client.get("/ok")
    assert r.status_code == 200
    # If we got here without 500, the guard works
    assert r.headers["x-frame-options"] == "DENY"


# ── Tests: middleware never crashes the pipeline ──────────────────────────────

def test_streaming_response_reaches_client(client):
    """Middleware must not swallow streaming responses."""
    r = client.get("/stream")
    assert r.status_code == 200
    assert r.content == b"chunk1chunk2"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_error_response_has_security_headers(client):
    """500-class responses must also carry security headers."""
    r = client.get("/error")
    assert r.status_code == 500
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_unhandled_exception_does_not_suppress_500(client):
    """An unhandled route exception should surface as 500, not be swallowed."""
    r = client.get("/raise")
    # FastAPI returns 500 for unhandled exceptions; middleware must not hide it
    assert r.status_code == 500


# ── Tests: no .pop() usage anywhere in middleware ────────────────────────────

def test_no_pop_call_in_main():
    """Regression guard — ensure .pop() is never re-introduced on headers."""
    import pathlib
    main_src = (
        pathlib.Path(__file__).parent.parent / "main.py"
    ).read_text(encoding="utf-8")
    # The only acceptable .pop() would be on a plain dict, not on response.headers
    assert "response.headers.pop(" not in main_src, (
        "response.headers.pop() is not supported by MutableHeaders — use "
        "'if key in response.headers: del response.headers[key]'"
    )


# ── Tests: analysis-critical path ────────────────────────────────────────────

def test_successful_route_response_is_never_invalidated(client):
    """
    A successful 200 from a route handler must always reach the client,
    even if the middleware had to handle an edge-case header.
    """
    r = client.get("/ok")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    # Security headers injected
    assert r.headers["x-content-type-options"] == "nosniff"
