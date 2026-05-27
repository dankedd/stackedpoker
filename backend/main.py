"""Minimal FastAPI app — debugging Railway ASGI wiring."""
import os
from fastapi import FastAPI

print(f"[MAIN] Loading main.py, PORT={os.environ.get('PORT', 'NOT SET')}")

app = FastAPI()

print(f"[MAIN] App created: {app}")


@app.get("/")
def root():
    return {"ok": True, "port": os.environ.get("PORT")}


@app.get("/health")
def health():
    return {"healthy": True}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


print("[MAIN] Routes registered, ready for uvicorn")
