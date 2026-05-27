# Backend API server with embedded TexasSolver binary.
#
# Multi-stage build:
#   Stage 1: Compile TexasSolver from source with GCC 11+ patches
#   Stage 2: Python runtime with solver binary + resources
#
# The GCC 11+ patch fixes missing #include <memory> in upstream v0.2.0
# which breaks on Ubuntu 22.04 / GCC 11+.

# ── Stage 1: Build TexasSolver ────────────────────────────────────────────
FROM ubuntu:22.04 AS solver-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential g++ qtbase5-dev qt5-qmake libgomp1 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone upstream source
RUN git clone --depth 1 --branch v0.2.0 \
    https://github.com/bupticybee/TexasSolver.git .

# Apply GCC 11+ compatibility patches (fixes missing #include <memory> etc.)
COPY vendor/texassolver/patch-gcc11.sh /patches/patch-gcc11.sh
RUN chmod +x /patches/patch-gcc11.sh \
    && bash -n /patches/patch-gcc11.sh \
    && bash /patches/patch-gcc11.sh

# Compile
RUN qmake TexasSolverGui.pro && make -j$(nproc)

# Verify binary was produced and is executable
RUN test -f console_solver && chmod +x console_solver \
    && echo "=== TexasSolver binary built successfully ===" \
    && ls -la console_solver \
    && file console_solver \
    && ldd console_solver

# ── Stage 2: Python API runtime ──────────────────────────────────────────
FROM python:3.11-slim

# Install runtime dependencies for TexasSolver (OpenMP + Qt5 core)
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libqt5core5a \
    file \
    && rm -rf /var/lib/apt/lists/*

# Copy solver binary and resources from builder
COPY --from=solver-builder /build/console_solver /opt/texassolver/bin/console_solver
COPY --from=solver-builder /build/resources/compairer /opt/texassolver/resources/compairer
COPY --from=solver-builder /build/resources/yamls /opt/texassolver/resources/yamls
RUN chmod +x /opt/texassolver/bin/console_solver

# Verify binary works in runtime image (fail build immediately if not)
RUN echo "=== Runtime binary verification ===" \
    && ls -la /opt/texassolver/bin/console_solver \
    && file /opt/texassolver/bin/console_solver \
    && ldd /opt/texassolver/bin/console_solver \
    && echo "=== Binary verification passed ==="

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
