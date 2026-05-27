#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────
# TexasSolver v0.2.0 → GCC 11+ / Ubuntu 22.04 Systematic Modernization
# ──────────────────────────────────────────────────────────────────────────
#
# This script SCANS the entire source tree and adds missing includes
# wherever STL symbols are used. No manual file lists — fully automatic.
#
# Run from the TexasSolver source root:
#   bash /patches/patch-gcc11.sh
#
set -euo pipefail
trap 'echo "PATCH SCRIPT FAILED at line $LINENO (exit $?)" >&2' ERR

PATCHED=0
SCANNED=0

patch_include() {
    local file="$1"
    local header="$2"
    local guard_string="$3"

    if [ ! -f "$file" ]; then return; fi
    if grep -q "#include <${header}>" "$file"; then return; fi

    # Insert at the top of the file, after the first existing #include
    if grep -q '#include' "$file"; then
        sed -i "0,/#include/{s|#include|#include <${header}>\n#include|}" "$file"
    else
        # No includes at all — add at line 1
        sed -i "1i #include <${header}>" "$file"
    fi
    echo "  + ${file}  ←  #include <${header}>"
    PATCHED=$((PATCHED + 1))
}

echo "========================================================"
echo "  TexasSolver GCC 11+ Systematic Modernization"
echo "========================================================"
echo ""

# ── Phase 1: Scan ALL .h and .cpp files for STL symbol usage ─────────────
echo "--- Phase 1: Scanning source tree for missing includes ---"
echo ""

ALL_SOURCES=$(find include/ src/ -name '*.h' -o -name '*.cpp' -o -name '*.hpp' 2>/dev/null)

for file in $ALL_SOURCES; do
    SCANNED=$((SCANNED + 1))

    # <memory>: shared_ptr, weak_ptr, unique_ptr, make_shared, make_unique
    if grep -qE '\bshared_ptr\b|\bweak_ptr\b|\bunique_ptr\b|\bmake_shared\b|\bmake_unique\b' "$file"; then
        patch_include "$file" "memory" "memory"
    fi

    # <mutex>: mutex, lock_guard, unique_lock, scoped_lock
    if grep -qE '\bmutex\b|\block_guard\b|\bunique_lock\b|\bscoped_lock\b' "$file"; then
        # Avoid false positive on "mutex" in comments or strings
        if grep -qE '^\s*(#|//|/\*)' "$file" 2>/dev/null; then true; fi
        patch_include "$file" "mutex" "mutex"
    fi

    # <thread>: thread, this_thread
    if grep -qE '\bstd::thread\b|\bthis_thread\b' "$file"; then
        patch_include "$file" "thread" "thread"
    fi

    # <algorithm>: sort, min, max, find, copy, transform, remove_if
    if grep -qE '\bsort\s*\(|\bstd::sort\b|\bstd::min\b|\bstd::max\b|\bstd::find\b|\bstd::copy\b' "$file"; then
        patch_include "$file" "algorithm" "algorithm"
    fi

    # <functional>: function, bind
    if grep -qE '\bstd::function\b|\bstd::bind\b' "$file"; then
        patch_include "$file" "functional" "functional"
    fi

    # <numeric>: accumulate, iota
    if grep -qE '\bstd::accumulate\b|\bstd::iota\b' "$file"; then
        patch_include "$file" "numeric" "numeric"
    fi

    # <cstring>: memcpy, memset
    if grep -qE '\bmemcpy\b|\bmemset\b' "$file"; then
        patch_include "$file" "cstring" "cstring"
    fi

    # <cstdlib>: abs (C-style)
    if grep -qE '\babs\s*\(' "$file"; then
        patch_include "$file" "cstdlib" "cstdlib"
    fi
done

echo ""
echo "  Scanned ${SCANNED} files, patched ${PATCHED} missing includes"
echo ""

# ── Phase 2: Also patch any top-level .h files (not in include/) ─────────
echo "--- Phase 2: Scanning top-level headers ---"

TOP_FILES=$(find . -maxdepth 1 \( -name '*.h' -o -name '*.cpp' \) 2>/dev/null || true)
for file in $TOP_FILES; do
    if [ ! -f "$file" ]; then continue; fi
    SCANNED=$((SCANNED + 1))
    if grep -qE '\bshared_ptr\b|\bweak_ptr\b|\bunique_ptr\b' "$file"; then
        patch_include "$file" "memory" "memory"
    fi
    if grep -qE '\bmutex\b|\block_guard\b' "$file"; then
        patch_include "$file" "mutex" "mutex"
    fi
done

echo ""

# ── Phase 3: Guard Qt includes for console builds ────────────────────────
echo "--- Phase 3: Guarding Qt includes for console build ---"

for file in $(find include/ src/ -name '*.h' -o -name '*.cpp' 2>/dev/null); do
    if grep -q '^#include <QDebug>' "$file" 2>/dev/null; then
        sed -i 's|^#include <QDebug>|#ifdef QT_CORE_LIB\n#include <QDebug>\n#endif|' "$file"
        echo "  ~ ${file}  (guarded QDebug)"
        PATCHED=$((PATCHED + 1))
    fi
    if grep -q '^#include <QFile>' "$file" 2>/dev/null; then
        sed -i 's|^#include <QFile>|#ifdef QT_CORE_LIB\n#include <QFile>\n#endif|' "$file"
        echo "  ~ ${file}  (guarded QFile)"
        PATCHED=$((PATCHED + 1))
    fi
    if grep -q '^#include <QString>' "$file" 2>/dev/null; then
        sed -i 's|^#include <QString>|#ifdef QT_CORE_LIB\n#include <QString>\n#endif|' "$file"
        echo "  ~ ${file}  (guarded QString)"
        PATCHED=$((PATCHED + 1))
    fi
done

echo ""

# ── Phase 4: Patch .pro for C++17 and console target ─────────────────────
echo "--- Phase 4: Build system patches ---"

if [ -f "TexasSolverGui.pro" ]; then
    if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
        echo 'CONFIG += c++17' >> "TexasSolverGui.pro"
        echo "  ~ TexasSolverGui.pro  (added CONFIG += c++17)"
        PATCHED=$((PATCHED + 1))
    fi
fi

echo ""

# ── Phase 5: Validation scan ─────────────────────────────────────────────
echo "--- Phase 5: Validation — checking for remaining unprotected usage ---"

VALIDATION_FAILED=0

for file in $(find include/ src/ -name '*.h' -o -name '*.cpp' 2>/dev/null); do
    # Check: uses shared_ptr but still no #include <memory>
    if grep -qE '\bshared_ptr\b|\bweak_ptr\b|\bunique_ptr\b' "$file"; then
        if ! grep -q '#include <memory>' "$file"; then
            echo "  WARN: ${file} uses smart pointers but missing #include <memory>"
            VALIDATION_FAILED=$((VALIDATION_FAILED + 1))
        fi
    fi
done

if [ "$VALIDATION_FAILED" -gt 0 ]; then
    echo ""
    echo "  WARNING: ${VALIDATION_FAILED} file(s) may still have missing includes"
    echo "  Build may still succeed if they get <memory> transitively"
else
    echo "  All files validated — no unprotected smart pointer usage found"
fi

echo ""
echo "========================================================"
echo "  Modernization complete: ${PATCHED} patches applied"
echo "  Build with: qmake TexasSolverGui.pro && make -j\$(nproc)"
echo "========================================================"
