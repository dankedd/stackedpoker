# Backend API server with embedded TexasSolver binary.
# Multi-stage: compile TexasSolver → slim Python runtime
#
# IMPORTANT: The GCC 11+ patch is embedded as a heredoc below,
# NOT copied from a file. This eliminates Docker layer caching
# of stale patch scripts and CRLF corruption from Windows hosts.

# ── Stage 1: Build TexasSolver ────────────────────────────────────────────
FROM ubuntu:22.04 AS solver-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ qtbase5-dev qt5-qmake libgomp1 git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN git clone --depth 1 --branch v0.2.0 \
    https://github.com/bupticybee/TexasSolver.git .

# ── GCC 11+ compatibility patch (inline heredoc — no COPY, no caching) ───
RUN bash <<'PATCH'
set -Eeuo pipefail

echo "=== GCC 11+ Patch: scanning source tree ==="
PATCHED=0

add_inc() {
  local f="$1" h="$2"
  if [ ! -f "$f" ]; then return 0; fi
  if grep -q "#include <${h}>" "$f" 2>/dev/null; then return 0; fi
  local n
  n="$(grep -n '#include' "$f" | head -1 | cut -d: -f1)"
  if [ -n "$n" ]; then
    sed -i "${n}i\\#include <${h}>" "$f"
  else
    sed -i "1i\\#include <${h}>" "$f"
  fi
  echo "  + $f  <--  <${h}>"
  PATCHED=$((PATCHED + 1))
}

# Phase 1: Add missing includes to ALL source files
while IFS= read -r f; do
  if grep -qE 'shared_ptr|weak_ptr|unique_ptr|make_shared|make_unique' "$f"; then
    add_inc "$f" "memory"
  fi
  if grep -qE 'mutex|lock_guard|unique_lock' "$f"; then
    add_inc "$f" "mutex"
  fi
  if grep -qE 'std::thread|this_thread' "$f"; then
    add_inc "$f" "thread"
  fi
  if grep -qE 'std::sort|std::min|std::max|std::find' "$f"; then
    add_inc "$f" "algorithm"
  fi
  if grep -qE 'memcpy|memset' "$f"; then
    add_inc "$f" "cstring"
  fi
done < <(find include src -type f \( -name '*.h' -o -name '*.cpp' -o -name '*.hpp' \) | sort)

# Phase 2: Top-level files
while IFS= read -r f; do
  if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$f"; then
    add_inc "$f" "memory"
  fi
  if grep -qE 'mutex|lock_guard' "$f"; then
    add_inc "$f" "mutex"
  fi
done < <(find . -maxdepth 1 -type f \( -name '*.h' -o -name '*.cpp' \) | sort)

# Phase 3: Guard Qt includes for console build
while IFS= read -r f; do
  for qhdr in QDebug QFile QString; do
    if grep -q "^#include <${qhdr}>" "$f" 2>/dev/null; then
      sed -i "s|^#include <${qhdr}>|#ifdef QT_CORE_LIB\n#include <${qhdr}>\n#endif|" "$f"
      echo "  ~ $f (guarded ${qhdr})"
      PATCHED=$((PATCHED + 1))
    fi
  done
done < <(find include src -type f \( -name '*.h' -o -name '*.cpp' \) | sort)

# Phase 4: Add C++17 flag
if [ -f "TexasSolverGui.pro" ]; then
  if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
    printf '\nCONFIG += c++17\n' >> "TexasSolverGui.pro"
    echo "  ~ TexasSolverGui.pro (c++17)"
    PATCHED=$((PATCHED + 1))
  fi
fi

# Phase 5: Validate
echo ""
echo "--- Validation ---"
MISSING=0
while IFS= read -r f; do
  if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$f"; then
    if ! grep -q '#include <memory>' "$f"; then
      echo "  WARN: $f still missing <memory>"
      MISSING=$((MISSING + 1))
    fi
  fi
done < <(find include src -type f \( -name '*.h' -o -name '*.cpp' \) | sort)

echo "=== Patch complete: ${PATCHED} changes, ${MISSING} warnings ==="
PATCH

# ── Compile ───────────────────────────────────────────────────────────────
RUN qmake TexasSolverGui.pro \
    && make -j"$(nproc)" \
    && echo "=== Compilation successful ==="

# ── Verify binary ─────────────────────────────────────────────────────────
# The .pro builds either 'console_solver' or 'TexasSolverGui' depending
# on the target config. Find whichever was produced and normalize the name.
RUN SOLVER_BIN="" \
    && for name in console_solver TexasSolverGui TexasSolver; do \
         if [ -f "$name" ]; then SOLVER_BIN="$name"; break; fi; \
       done \
    && if [ -z "$SOLVER_BIN" ]; then \
         echo "FATAL: No solver binary found after make" >&2; \
         ls -la; \
         exit 1; \
       fi \
    && echo "=== Found binary: $SOLVER_BIN ===" \
    && chmod +x "$SOLVER_BIN" \
    && if [ "$SOLVER_BIN" != "console_solver" ]; then \
         cp "$SOLVER_BIN" console_solver; \
       fi \
    && ls -la console_solver \
    && file console_solver \
    && ldd console_solver

# ── Stage 2: Python API runtime ──────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libqt5core5a file \
    && rm -rf /var/lib/apt/lists/*

COPY --from=solver-builder /build/console_solver /opt/texassolver/bin/console_solver
COPY --from=solver-builder /build/resources/compairer /opt/texassolver/resources/compairer
COPY --from=solver-builder /build/resources/yamls /opt/texassolver/resources/yamls
RUN chmod +x /opt/texassolver/bin/console_solver

RUN echo "=== Runtime verification ===" \
    && file /opt/texassolver/bin/console_solver \
    && ldd /opt/texassolver/bin/console_solver \
    && echo "=== OK ==="

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
