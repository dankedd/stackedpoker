# TexasSolver binary builder — multi-stage for slim runtime image.
#
# Stage 1: Build the solver binary from source
# Stage 2: Minimal runtime with just the binary + resources

FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    qtbase5-dev \
    qt5-qmake \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone --depth 1 --branch v0.2.0 \
    https://github.com/bupticybee/TexasSolver.git .

RUN qmake TexasSolverGui.pro && make -j$(nproc)

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libgomp1 \
    libqt5core5a \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/texassolver

COPY --from=builder /build/console_solver /opt/texassolver/bin/console_solver
COPY --from=builder /build/resources/compairer /opt/texassolver/resources/compairer
COPY --from=builder /build/resources/yamls /opt/texassolver/resources/yamls

RUN mkdir -p /opt/texassolver/input /opt/texassolver/output \
    && chmod +x /opt/texassolver/bin/console_solver

ENV PATH="/opt/texassolver/bin:${PATH}"
ENV TEXASSOLVER_RESOURCE_DIR="/opt/texassolver/resources"

ENTRYPOINT ["console_solver"]
CMD ["-r", "/opt/texassolver/resources", "-m", "holdem"]
