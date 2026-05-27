#!/usr/bin/env bash
set -Eeuo pipefail

echo "=== Build Environment Diagnostics ==="
echo "--- OS ---"
cat /etc/os-release 2>/dev/null | head -5 || echo "unknown"
echo "--- arch ---"
uname -m
echo "--- gcc ---"
gcc --version | head -1
echo "--- g++ ---"
g++ --version | head -1
echo "--- qmake ---"
qmake --version 2>&1 | head -2
echo "--- make ---"
make --version | head -1
echo "--- nproc ---"
nproc
echo "--- pwd ---"
pwd
echo "--- env (solver) ---"
env | grep -iE 'TEXAS|SOLVER|QT|CXX|CC' || echo "(none)"
echo "=== Diagnostics complete ==="
