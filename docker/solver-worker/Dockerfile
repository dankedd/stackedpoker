# Solve worker — Python backend + TexasSolver binary in one image.
#
# This image contains:
#   1. The Python backend code (for runner.py, parser.py, adapter.py)
#   2. The TexasSolver binary + resources (copied from builder stage)
#   3. The worker entry point (run_worker.py)
#
# It does NOT run the FastAPI server — only the background worker process.

# ── Stage 1: Build TexasSolver ────────────────────────────────────────────
FROM ubuntu:22.04 AS solver-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential g++ qtbase5-dev qt5-qmake libgomp1 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone --depth 1 --branch v0.2.0 \
    https://github.com/bupticybee/TexasSolver.git .
RUN qmake TexasSolverGui.pro && make -j$(nproc)

# ── Stage 2: Python worker runtime ───────────────────────────────────────
FROM python:3.11-slim

# Install runtime dependencies for TexasSolver
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libqt5core5a \
    && rm -rf /var/lib/apt/lists/*

# Copy solver binary and resources
COPY --from=solver-builder /build/console_solver /opt/texassolver/bin/console_solver
COPY --from=solver-builder /build/resources/compairer /opt/texassolver/resources/compairer
COPY --from=solver-builder /build/resources/yamls /opt/texassolver/resources/yamls
RUN chmod +x /opt/texassolver/bin/console_solver

# Create data directories
RUN mkdir -p /data/solves/output /data/solves/archive

# Install Python dependencies
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Environment defaults
ENV TEXASSOLVER_BIN="/opt/texassolver/bin/console_solver"
ENV TEXASSOLVER_RESOURCE_DIR="/opt/texassolver/resources"
ENV SOLVE_OUTPUT_DIR="/data/solves/output"
ENV MAX_CONCURRENT_SOLVES="2"
ENV SOLVER_THREADS="4"
ENV SOLVE_TIMEOUT="600"
ENV LOG_LEVEL="INFO"
ENV PYTHONUNBUFFERED="1"

CMD ["python", "run_worker.py"]
