#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for t in tests/*.test.mjs; do
  echo "== $t"
  node "$t"
done
bash tests/enrol.test.sh
