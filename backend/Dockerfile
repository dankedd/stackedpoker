# Backend API with embedded TexasSolver binary.
# Static files only. No heredocs. No dynamic script generation.
# Each major step is its own RUN layer for debuggability.

# ── Stage 1: Build TexasSolver ────────────────────────────────────────────
FROM ubuntu:22.04 AS solver-builder

ENV DEBIAN_FRONTEND=noninteractive

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ qtbase5-dev qt5-qmake libgomp1 \
    git ca-certificates dos2unix file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN git clone --depth 1 --branch v0.2.0 \
    https://github.com/bupticybee/TexasSolver.git .

# Copy build scripts from repo (static files)
COPY vendor/texassolver/patch-gcc11.sh   /scripts/patch-gcc11.sh
COPY vendor/texassolver/verify-build.sh  /scripts/verify-build.sh
COPY vendor/texassolver/diagnose-env.sh  /scripts/diagnose-env.sh

# Force LF line endings (belt-and-suspenders for Windows git)
RUN dos2unix /scripts/*.sh

# Set executable bits
RUN chmod +x /scripts/*.sh

# Validate syntax before execution
RUN bash -n /scripts/patch-gcc11.sh
RUN bash -n /scripts/verify-build.sh
RUN bash -n /scripts/diagnose-env.sh

# Print build environment
RUN bash /scripts/diagnose-env.sh

# Apply GCC 11+ compatibility patches
RUN bash /scripts/patch-gcc11.sh

# Show available resources before compile
RUN echo "=== Build resources ===" \
    && echo "CPUs: $(nproc)" \
    && free -m 2>/dev/null || echo "(free not available)" \
    && echo "Using make -j2 for Railway memory safety"

# Compile (console target only, -j2 to avoid OOM on Railway)
RUN qmake TexasSolverGui.pro

RUN make -j2

# Verify binary
RUN bash /scripts/verify-build.sh

# ── Stage 2: Python API runtime ──────────────────────────────────────────
FROM python:3.11-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libqt5core5a file \
    && rm -rf /var/lib/apt/lists/*

COPY --from=solver-builder /build/console_solver /opt/texassolver/bin/console_solver
COPY --from=solver-builder /build/resources/compairer /opt/texassolver/resources/compairer
COPY --from=solver-builder /build/resources/yamls /opt/texassolver/resources/yamls

RUN chmod +x /opt/texassolver/bin/console_solver

RUN file /opt/texassolver/bin/console_solver

RUN ldd /opt/texassolver/bin/console_solver

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV TEXASSOLVER_BIN="/opt/texassolver/bin/console_solver"
ENV TEXASSOLVER_RESOURCE_DIR="/opt/texassolver/resources"
ENV ENABLE_SOLVER_ENGINE="true"
ENV PYTHONUNBUFFERED="1"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
