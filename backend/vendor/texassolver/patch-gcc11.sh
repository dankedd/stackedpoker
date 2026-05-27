#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "[PATCH FAILED] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

PATCHED=0

add_inc() {
  local f="$1" h="$2"
  if [ ! -f "$f" ]; then return 0; fi
  if grep -q "#include <${h}>" "$f" 2>/dev/null; then return 0; fi
  local n
  n="$(grep -n '#include' "$f" | head -1 | cut -d: -f1)"
  if [ -n "$n" ]; then
    sed -i "${n}i\#include <${h}>" "$f"
  else
    sed -i "1i\#include <${h}>" "$f"
  fi
  echo "  + $f  <--  <${h}>"
  PATCHED=$((PATCHED + 1))
}

echo "=== Phase 1: Add missing includes ==="
find include src -type f -name '*.h' -o -name '*.cpp' -o -name '*.hpp' | sort | while IFS= read -r f; do
  grep -qE 'shared_ptr|weak_ptr|unique_ptr|make_shared|make_unique' "$f" && add_inc "$f" "memory" || true
  grep -qE 'mutex|lock_guard|unique_lock' "$f" && add_inc "$f" "mutex" || true
  grep -qE 'std::thread|this_thread' "$f" && add_inc "$f" "thread" || true
  grep -qE 'std::sort|std::min|std::max|std::find' "$f" && add_inc "$f" "algorithm" || true
  grep -qE 'memcpy|memset' "$f" && add_inc "$f" "cstring" || true
done

echo "=== Phase 2: Top-level files ==="
find . -maxdepth 1 -type f -name '*.h' -o -name '*.cpp' | sort | while IFS= read -r f; do
  grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$f" && add_inc "$f" "memory" || true
  grep -qE 'mutex|lock_guard' "$f" && add_inc "$f" "mutex" || true
done

echo "=== Phase 3: Guard Qt includes ==="
find include src -type f -name '*.h' -o -name '*.cpp' | sort | while IFS= read -r f; do
  for qh in QDebug QFile QString; do
    if grep -q "^#include <${qh}>" "$f" 2>/dev/null; then
      sed -i "s|^#include <${qh}>|#ifdef QT_CORE_LIB\n#include <${qh}>\n#endif|" "$f"
      echo "  ~ $f (guarded ${qh})"
      PATCHED=$((PATCHED + 1))
    fi
  done
done

echo "=== Phase 4: Build system ==="
if [ -f "TexasSolverGui.pro" ]; then
  if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
    printf '\nCONFIG += c++17\n' >> "TexasSolverGui.pro"
    echo "  ~ added c++17 flag"
    PATCHED=$((PATCHED + 1))
  fi
fi

echo "=== Phase 5: Validate ==="
find include src -type f -name '*.h' -o -name '*.cpp' | sort | while IFS= read -r f; do
  if grep -qE 'shared_ptr|weak_ptr|unique_ptr' "$f"; then
    if ! grep -q '#include <memory>' "$f"; then
      echo "  WARN: $f missing <memory>"
    fi
  fi
done

echo "=== Done: ${PATCHED} patches applied ==="
