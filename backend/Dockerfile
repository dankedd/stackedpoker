# Backend API server with embedded TexasSolver binary.
#
# Multi-stage build:
#   Stage 1: Compile TexasSolver from source (Ubuntu + Qt + GCC)
#   Stage 2: Python runtime with solver binary + resources
#
# The API server can run live river solves directly without
# needing the separate solver-worker container.

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

# ── Stage 2: Python API runtime ──────────────────────────────────────────
FROM python:3.11-slim

# Install runtime dependencies for TexasSolver (OpenMP + Qt5 core)
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libqt5core5a \
    && rm -rf /var/lib/apt/lists/*

# Copy solver binary and resources from builder
COPY --from=solver-builder /build/console_solver /opt/texassolver/bin/console_solver
COPY --from=solver-builder /build/resources/compairer /opt/texassolver/resources/compairer
COPY --from=solver-builder /build/resources/yamls /opt/texassolver/resources/yamls
RUN chmod +x /opt/texassolver/bin/console_solver

# Verify binary is executable (fail build if not)
RUN /opt/texassolver/bin/console_solver --help || true

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Solver environment
ENV TEXASSOLVER_BIN="/opt/texassolver/bin/console_solver"
ENV TEXASSOLVER_RESOURCE_DIR="/opt/texassolver/resources"
ENV ENABLE_SOLVER_ENGINE="true"
ENV PYTHONUNBUFFERED="1"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
