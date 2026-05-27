#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "[PATCH FAILED] line=$LINENO cmd=$BASH_COMMAND exit=$?" >&2' ERR

PATCHED=0

add_include() {
    local file="$1"
    local header="$2"
    if [ ! -f "$file" ]; then return 0; fi
    if grep -q "#include <${header}>" "$file"; then return 0; fi
    local linenum
    linenum="$(grep -n '#include' "$file" | head -1 | cut -d: -f1)"
    if [ -n "$linenum" ]; then
        sed -i "${linenum}i\#include <${header}>" "$file"
    else
        sed -i "1i\#include <${header}>" "$file"
    fi
    echo "  + $file  <--  #include <${header}>"
    PATCHED=$((PATCHED + 1))
}

guard_qt() {
    local file="$1"
    local hdr="$2"
    if [ ! -f "$file" ]; then return 0; fi
    if ! grep -q "^#include <${hdr}>" "$file"; then return 0; fi
    sed -i "s|^#include <${hdr}>|#ifdef QT_CORE_LIB\n#include <${hdr}>\n#endif|" "$file"
    echo "  ~ $file  (guarded ${hdr})"
    PATCHED=$((PATCHED + 1))
}

echo "========================================================"
echo "  TexasSolver GCC 11+ Modernization"
echo "========================================================"

echo ""
echo "--- Phase 1: Add missing includes (recursive scan) ---"

find include src -type f \( -name '*.h' -o -name '*.cpp' -o -name '*.hpp' \) | sort | while IFS= read -r f; do
    if grep -qE 'shared_ptr|weak_ptr|unique_ptr|make_shared|make_unique' "$f"; then
        add_include "$f" "memory"
    fi
    if grep -qE 'mutex|lock_guard|unique_lock' "$f"; then
        add_include "$f" "mutex"
    fi
    if grep -qE 'std::thread|this_thread' "$f"; then
        add_include "$f" "thread"
    fi
    if grep -qE 'std::sort|std::min|std::max|std::find' "$f"; then
        add_include "$f" "algorithm"
    fi
    if grep -qE 'memcpy|memset' "$f"; then
        add_include "$f" "cstring"
    fi
done

echo ""
echo "--- Phase 2: Top-level sources ---"

find . -maxdepth 1 -type f \( -name '*.h' -o -name '*.cpp' \) | sort | while IFS= read -r f; do
    if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$f"; then
        add_include "$f" "memory"
    fi
    if grep -qE 'mutex|lock_guard' "$f"; then
        add_include "$f" "mutex"
    fi
done

echo ""
echo "--- Phase 3: Guard Qt includes ---"

find include src -type f \( -name '*.h' -o -name '*.cpp' \) | sort | while IFS= read -r f; do
    guard_qt "$f" "QDebug"
    guard_qt "$f" "QFile"
    guard_qt "$f" "QString"
done

echo ""
echo "--- Phase 4: Build system ---"

if [ -f "TexasSolverGui.pro" ]; then
    if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
        printf '\nCONFIG += c++17\n' >> "TexasSolverGui.pro"
        echo "  ~ TexasSolverGui.pro  (added c++17)"
        PATCHED=$((PATCHED + 1))
    fi
fi

echo ""
echo "--- Phase 5: Validation ---"

WARN=0
find include src -type f \( -name '*.h' -o -name '*.cpp' \) | sort | while IFS= read -r f; do
    if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$f"; then
        if ! grep -q '#include <memory>' "$f"; then
            echo "  WARN: $f missing #include <memory>"
        fi
    fi
done

echo ""
echo "========================================================"
echo "  Done: ${PATCHED} patches applied"
echo "========================================================"
