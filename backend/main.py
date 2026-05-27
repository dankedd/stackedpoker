"""Minimal FastAPI app — debugging Railway ASGI wiring."""
import os
import uvicorn
from fastapi import FastAPI

port = int(os.environ.get("PORT", "8080"))
print(f"[MAIN] PORT={port}")

app = FastAPI()


@app.get("/")
def root():
    return {"ok": True, "port": port}


@app.get("/health")
def health():
    return {"healthy": True}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


print(f"[MAIN] App ready, will bind 0.0.0.0:{port}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=port)
