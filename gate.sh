#!/usr/bin/env bash
set -euo pipefail

PASS="\033[1;32mPASS\033[0m"
FAIL="\033[1;31mFAIL\033[0m"
overall=0

run_check() {
  local label="$1"; shift
  if "$@" > /tmp/gate_out.txt 2>&1; then
    printf "%-30s %b\n" "$label" "$PASS"
  else
    printf "%-30s %b\n" "$label" "$FAIL"
    cat /tmp/gate_out.txt
    overall=1
  fi
}

echo ""
echo "==============================="
echo "  Habit Tracker — gate checks  "
echo "==============================="
echo ""

run_check "TypeScript typecheck"  bunx tsc --noEmit
run_check "ESLint"                bun lint
run_check "Unit tests"            bun test tests/unit/

echo ""
if [ $overall -eq 0 ]; then
  printf "\033[1;32mAll checks passed.\033[0m\n\n"
else
  printf "\033[1;31mOne or more checks failed.\033[0m\n\n"
  exit 1
fi
