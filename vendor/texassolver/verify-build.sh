#!/usr/bin/env bash
set -Eeuo pipefail

echo "=== TexasSolver Build Verification ==="

SOLVER=""
for name in console_solver TexasSolverGui TexasSolver; do
  if [ -f "$name" ]; then
    SOLVER="$name"
    break
  fi
done

if [ -z "$SOLVER" ]; then
  echo "FATAL: No solver binary found"
  echo "Directory contents:"
  ls -la
  exit 1
fi

echo "Binary found: $SOLVER"
chmod +x "$SOLVER"

if [ "$SOLVER" != "console_solver" ]; then
  cp "$SOLVER" console_solver
  chmod +x console_solver
  echo "Copied to console_solver"
fi

echo "--- file ---"
file console_solver

echo "--- ldd ---"
MISSING=$(ldd console_solver 2>&1 | grep "not found" || true)
if [ -n "$MISSING" ]; then
  echo "FATAL: Missing shared libraries:"
  echo "$MISSING"
  exit 1
fi
ldd console_solver

echo "--- size ---"
ls -la console_solver

echo "=== Verification PASSED ==="
