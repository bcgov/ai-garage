#!/usr/bin/env bash
# Enrol into a temp dir for each profile; run preflight and a local gate; migrate from tier2-v3-example copy.
set -euo pipefail
PACK="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

echo "--- delivery profile"
mkdir -p "$T/d" && git -C "$T/d" init -q
"$PACK/enrol.sh" "$T/d" --profile delivery >/dev/null
test ! -d "$T/d/src" || { echo "FAIL: src/ created"; exit 1; }
test ! -d "$T/d/tests" || { echo "FAIL: tests/ created"; exit 1; }
test ! -d "$T/d/intent" || { echo "FAIL: intent/ created"; exit 1; }
test ! -f "$T/d/.specify/memory/constitution.md" || { echo "FAIL: second constitution written"; exit 1; }
test -f "$T/d/bc-gov-sdlc-policy.md" || { echo "FAIL: bc-gov-sdlc-policy.md missing"; exit 1; }
test -f "$T/d/.github/workflows/garage-gate.yml" || { echo "FAIL: gate workflow missing"; exit 1; }
test -f "$T/d/.github/garage/OPERATE.md" || { echo "FAIL: OPERATE.md missing"; exit 1; }
test -f "$T/d/.github/garage/SIGHTLINE.md" || { echo "FAIL: Sightline operator guide missing"; exit 1; }
test -f "$T/d/.github/garage/sightline.mjs" || { echo "FAIL: Sightline coordinator missing"; exit 1; }
test -f "$T/d/.github/garage/sightline-service.mjs" || { echo "FAIL: Sightline service missing"; exit 1; }
test -f "$T/d/.github/garage/sightline-client.mjs" || { echo "FAIL: Sightline client missing"; exit 1; }
test -f "$T/d/.github/garage/sightline/freshness.mjs" || { echo "FAIL: Sightline freshness check missing"; exit 1; }
test -f "$T/d/.github/workflows/garage-sightline-run.yml" || { echo "FAIL: Sightline workflow missing"; exit 1; }
node "$T/d/.github/garage/preflight.mjs" --root "$T/d" >/dev/null || { echo "FAIL: preflight"; exit 1; }
node "$T/d/.github/garage/gate.mjs" --root "$T/d" --changed-paths src/x.ts --no-comment >/dev/null || { echo "FAIL: gate on scaffold"; exit 1; }
echo "PASS  delivery enrol + preflight + gate"

echo "--- intake profile"
mkdir -p "$T/i" && git -C "$T/i" init -q
"$PACK/enrol.sh" "$T/i" --profile intake >/dev/null
test ! -f "$T/i/.github/workflows/garage-gate.yml" || { echo "FAIL: gate workflow present in intake"; exit 1; }
test ! -f "$T/i/constitution.md" || { echo "FAIL: constitution written in intake"; exit 1; }
test ! -f "$T/i/bc-gov-sdlc-policy.md" || { echo "FAIL: policy written in intake"; exit 1; }
node "$T/i/.github/garage/preflight.mjs" --root "$T/i" >/dev/null || { echo "FAIL: intake preflight"; exit 1; }
echo "PASS  intake enrol + preflight"

echo "--- migration from a legacy consumer"
cp -R "$PACK/tests/fixtures/legacy-consumer" "$T/m"
git -C "$T/m" init -q
"$PACK/enrol.sh" "$T/m" >/dev/null
test -f "$T/m/garage.config.json" || { echo "FAIL: no garage.config.json after migration"; exit 1; }
test ! -f "$T/m/tier2-v3.config.json" || { echo "FAIL: legacy tier2 config remains"; exit 1; }
test ! -f "$T/m/tier1.config.json" || { echo "FAIL: legacy tier1 config remains"; exit 1; }
test ! -d "$T/m/.github/tier2-v3" || { echo "FAIL: .github/tier2-v3 remains"; exit 1; }
test ! -d "$T/m/.github/tier1" || { echo "FAIL: .github/tier1 remains"; exit 1; }
if ls "$T/m"/.github/workflows/tier*.yml >/dev/null 2>&1; then echo "FAIL: legacy workflows remain"; exit 1; fi
test ! -d "$T/m/maintain" || { echo "FAIL: maintain/ remains"; exit 1; }
node "$T/m/.github/garage/preflight.mjs" --root "$T/m" >/dev/null || { echo "FAIL: migrated preflight"; exit 1; }
echo "PASS  migration"
echo "ALL GREEN"
