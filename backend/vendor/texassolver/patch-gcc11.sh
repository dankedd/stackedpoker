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

echo "=== Phase 4: Console-only build system ==="
if [ -f "TexasSolverGui.pro" ]; then
  # Add C++17 flag
  if ! grep -q 'CONFIG += c++17' "TexasSolverGui.pro"; then
    printf '\nCONFIG += c++17\n' >> "TexasSolverGui.pro"
    echo "  ~ added c++17 flag"
    PATCHED=$((PATCHED + 1))
  fi

  echo "  Replacing GUI .pro with console-only .pro..."

  # The upstream .pro builds a full Qt GUI app. main.cpp uses QApplication,
  # QInputDialog, MainWindow — all require Qt widgets. We cannot compile it
  # without the full Qt GUI stack.
  #
  # Instead: replace the ENTIRE .pro with a minimal console-only version
  # that compiles only the solver engine + console entry point.

  # First, rename main_backup() to main() in console.cpp
  if [ -f "src/console.cpp" ]; then
    sed -i 's/int main_backup(/int main(/' "src/console.cpp"
    echo "  ~ renamed main_backup -> main in console.cpp"
  fi

  # Discover ALL .cpp files in src/ (exclude pybind and ui)
  echo "  Discovering source files..."
  FOUND_SOURCES=""
  while IFS= read -r cpp; do
    FOUND_SOURCES="${FOUND_SOURCES}    ${cpp} \\
"
    echo "    src: $cpp"
  done < <(find src -name '*.cpp' | grep -v 'pybind' | grep -v 'src/ui/' | sort)

  # Write a clean console-only .pro file with ALL discovered sources
  cat > TexasSolverGui.pro << PROEOF
QT += core
QT -= gui widgets
CONFIG += c++17 console
CONFIG -= app_bundle
TARGET = console_solver
TEMPLATE = app

QMAKE_CXXFLAGS += -fopenmp -w
QMAKE_LFLAGS += -fopenmp
QMAKE_CXXFLAGS_RELEASE += -O2

INCLUDEPATH += include

SOURCES += \\
${FOUND_SOURCES}    src/console.cpp
PROEOF

  echo "  ~ wrote console-only .pro file"
  echo "  ~ target: console_solver"
  PATCHED=$((PATCHED + 1))
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
