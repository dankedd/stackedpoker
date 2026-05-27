#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "[PATCH FAILED] line=$LINENO cmd=$BASH_COMMAND exit=$?" >&2' ERR

PATCHED=0
SCANNED=0

add_include_if_missing() {
    local file="$1"
    local header="$2"

    if [ ! -f "$file" ]; then
        return 0
    fi
    if grep -q "#include <${header}>" "$file"; then
        return 0
    fi

    # Find the first line number containing #include
    local first_inc
    first_inc=$(grep -n '#include' "$file" | head -1 | cut -d: -f1)

    if [ -n "$first_inc" ]; then
        sed -i "${first_inc}i\\#include <${header}>" "$file"
    else
        sed -i "1i\\#include <${header}>" "$file"
    fi

    echo "  + $file  <--  #include <${header}>"
    PATCHED=$((PATCHED + 1))
}

guard_qt_include() {
    local file="$1"
    local qt_header="$2"

    if [ ! -f "$file" ]; then
        return 0
    fi
    if ! grep -q "^#include <${qt_header}>" "$file"; then
        return 0
    fi

    sed -i "s|^#include <${qt_header}>|#ifdef QT_CORE_LIB\n#include <${qt_header}>\n#endif|" "$file"
    echo "  ~ $file  (guarded ${qt_header})"
    PATCHED=$((PATCHED + 1))
}

echo "========================================================"
echo "  TexasSolver GCC 11+ Systematic Modernization"
echo "========================================================"
echo ""

# ── Phase 1: Recursive scan for missing STL includes ─────────────────────
echo "--- Phase 1: Scanning include/ and src/ for missing includes ---"

find include/ src/ -type f -name '*.h' -o -name '*.cpp' -o -name '*.hpp' | sort | while IFS= read -r file; do
    SCANNED=$((SCANNED + 1))

    if grep -qE 'shared_ptr|weak_ptr|unique_ptr|make_shared|make_unique' "$file"; then
        add_include_if_missing "$file" "memory"
    fi

    if grep -qE 'mutex|lock_guard|unique_lock|scoped_lock' "$file"; then
        add_include_if_missing "$file" "mutex"
    fi

    if grep -qE 'std::thread|this_thread' "$file"; then
        add_include_if_missing "$file" "thread"
    fi

    if grep -qE 'std::sort|std::min|std::max|std::find|std::copy' "$file"; then
        add_include_if_missing "$file" "algorithm"
    fi

    if grep -qE 'std::function|std::bind' "$file"; then
        add_include_if_missing "$file" "functional"
    fi

    if grep -qE 'memcpy|memset' "$file"; then
        add_include_if_missing "$file" "cstring"
    fi
done

echo ""
echo "  Phase 1 complete (patched: ${PATCHED})"
echo ""

# ── Phase 2: Top-level source files ──────────────────────────────────────
echo "--- Phase 2: Scanning top-level .h/.cpp files ---"

find . -maxdepth 1 -type f -name '*.h' -o -name '*.cpp' | sort | while IFS= read -r file; do
    if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$file"; then
        add_include_if_missing "$file" "memory"
    fi
    if grep -qE 'mutex|lock_guard' "$file"; then
        add_include_if_missing "$file" "mutex"
    fi
done

echo ""

# ── Phase 3: Guard Qt includes for headless/console builds ───────────────
echo "--- Phase 3: Guarding Qt includes for console build ---"

find include/ src/ -type f -name '*.h' -o -name '*.cpp' | sort | while IFS= read -r file; do
    guard_qt_include "$file" "QDebug"
    guard_qt_include "$file" "QFile"
    guard_qt_include "$file" "QString"
done

echo ""

# ── Phase 4: Build system ────────────────────────────────────────────────
echo "--- Phase 4: Build system patches ---"

if [ -f "TexasSolverGui.pro" ]; then
    if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
        echo 'CONFIG += c++17' >> "TexasSolverGui.pro"
        echo "  ~ TexasSolverGui.pro  (added CONFIG += c++17)"
        PATCHED=$((PATCHED + 1))
    fi
fi

echo ""

# ── Phase 5: Validation ──────────────────────────────────────────────────
echo "--- Phase 5: Validation scan ---"

WARN_COUNT=0
find include/ src/ -type f -name '*.h' -o -name '*.cpp' | sort | while IFS= read -r file; do
    if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$file"; then
        if ! grep -q '#include <memory>' "$file"; then
            echo "  WARN: $file uses smart pointers without #include <memory>"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    fi
done

echo ""
echo "========================================================"
echo "  Modernization complete: ${PATCHED} patches applied"
echo "  Build: qmake TexasSolverGui.pro && make -j\$(nproc)"
echo "========================================================"
