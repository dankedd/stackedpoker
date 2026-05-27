#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────
# TexasSolver v0.2.0 → GCC 11+ / Ubuntu 22.04 Compatibility Patch
# ──────────────────────────────────────────────────────────────────────────
#
# Problem: TexasSolver v0.2.0 was built for GCC 10 / Ubuntu 20.04.
# GCC 11+ changed transitive header behavior — <vector> and <string>
# no longer pull in <memory>, breaking all shared_ptr/weak_ptr usage.
#
# This script patches the source IN-PLACE after git clone.
# Run from the TexasSolver source root directory.
#
# Usage:
#   cd /build/TexasSolver
#   bash /patches/patch-gcc11.sh
#
set -euo pipefail

echo "=== Applying GCC 11+ compatibility patches ==="

# ── Fix 1: Add #include <memory> to all headers using smart pointers ─────
# These files use shared_ptr/weak_ptr but rely on transitive includes
# that no longer provide <memory> on GCC 11+.

MEMORY_PATCH_FILES=(
    "include/trainable/Trainable.h"
    "include/trainable/CfrPlusTrainable.h"
    "include/trainable/DiscountedCfrTrainable.h"
    "include/runtime/PokerSolver.h"
    "include/tools/CommandLineTool.h"
    "include/GameTree.h"
    "include/solver/Solver.h"
    "include/solver/PCfrSolver.h"
    "include/solver/BestResponse.h"
    "include/nodes/ChanceNode.h"
    "include/nodes/ShowdownNode.h"
    "include/nodes/TerminalNode.h"
)

for file in "${MEMORY_PATCH_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Only add if not already present
        if ! grep -q '#include <memory>' "$file"; then
            # Insert after the first #include line
            sed -i '0,/#include/{s/#include/#include <memory>\n#include/}' "$file"
            echo "  patched: $file (added #include <memory>)"
        else
            echo "  skipped: $file (already has #include <memory>)"
        fi
    else
        echo "  WARNING: $file not found"
    fi
done

# ── Fix 2: Add #include <mutex> where needed ─────────────────────────────
# PCfrSolver.h and BestResponse.h may use mutex types
MUTEX_FILES=(
    "include/solver/PCfrSolver.h"
    "include/solver/BestResponse.h"
)

for file in "${MUTEX_FILES[@]}"; do
    if [ -f "$file" ]; then
        if ! grep -q '#include <mutex>' "$file"; then
            sed -i '0,/#include/{s/#include/#include <mutex>\n#include/}' "$file"
            echo "  patched: $file (added #include <mutex>)"
        fi
    fi
done

# ── Fix 3: Add #include <algorithm> where std::sort/min/max used ─────────
ALGO_FILES=(
    "include/ranges/RiverRangeManager.h"
    "include/ranges/PrivateCards.h"
    "src/ranges/RiverRangeManager.cpp"
)

for file in "${ALGO_FILES[@]}"; do
    if [ -f "$file" ]; then
        if ! grep -q '#include <algorithm>' "$file"; then
            sed -i '0,/#include/{s/#include/#include <algorithm>\n#include/}' "$file"
            echo "  patched: $file (added #include <algorithm>)"
        fi
    fi
done

# ── Fix 4: Ensure DiscountedCfrTrainable variants have <memory> ──────────
for variant in HF SF; do
    file="include/trainable/DiscountedCfrTrainable${variant}.h"
    if [ -f "$file" ]; then
        if ! grep -q '#include <memory>' "$file"; then
            sed -i '0,/#include/{s/#include/#include <memory>\n#include/}' "$file"
            echo "  patched: $file (added #include <memory>)"
        fi
    fi
done

# ── Fix 5: Console build — strip Qt GUI deps from PokerSolver.h ──────────
# The console solver doesn't use Qt GUI features. Guard Qt includes.
if [ -f "include/runtime/PokerSolver.h" ]; then
    # Replace bare Qt includes with conditional includes
    sed -i 's|^#include <QDebug>|#ifdef QT_CORE_LIB\n#include <QDebug>\n#endif|' \
        "include/runtime/PokerSolver.h" 2>/dev/null || true
    sed -i 's|^#include <QFile>|#ifdef QT_CORE_LIB\n#include <QFile>\n#endif|' \
        "include/runtime/PokerSolver.h" 2>/dev/null || true
    echo "  patched: include/runtime/PokerSolver.h (guarded Qt includes)"
fi

# ── Fix 6: Patch .pro file for Ubuntu 22.04 ──────────────────────────────
if [ -f "TexasSolverGui.pro" ]; then
    # Add C++17 standard flag for consistency with GCC 11+ defaults
    if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
        echo 'CONFIG += c++17' >> "TexasSolverGui.pro"
        echo "  patched: TexasSolverGui.pro (added c++17 flag)"
    fi
fi

echo "=== Patches applied successfully ==="
echo ""
echo "Build with:"
echo "  qmake TexasSolverGui.pro && make -j\$(nproc)"
