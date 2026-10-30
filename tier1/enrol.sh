#!/usr/bin/env bash
# Enrol a target repository directory with Tier 1 workflows + scripts.
# Usage:
#   ./enrol.sh /path/to/consumer-repo
#   ./enrol.sh /path/to/consumer-repo --with-gh-aw
set -euo pipefail

PACK_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-}"
WITH_GHAW=false
if [[ "${2:-}" == "--with-gh-aw" ]] || [[ "${1:-}" == "--with-gh-aw" ]]; then
  WITH_GHAW=true
fi
if [[ "${1:-}" == "--with-gh-aw" ]]; then
  TARGET="${2:-}"
fi
if [[ -z "${TARGET}" || "${TARGET}" == --* ]]; then
  echo "Usage: $0 /path/to/consumer-repo [--with-gh-aw]" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"

echo "Tier 1 enrol"
echo "  pack:   $PACK_DIR"
echo "  target: $TARGET"
echo "  gh-aw:  $WITH_GHAW"

mkdir -p "$TARGET/.github/workflows" "$TARGET/.github/tier1/scripts/lib" "$TARGET/docs"

cp -f "$PACK_DIR"/workflows/tier1-preflight.yml "$TARGET/.github/workflows/"
cp -f "$PACK_DIR"/workflows/tier1-triage.yml "$TARGET/.github/workflows/"
cp -f "$PACK_DIR"/workflows/tier1-docs-drift.yml "$TARGET/.github/workflows/"
cp -f "$PACK_DIR"/workflows/tier1-ci-diagnose.yml "$TARGET/.github/workflows/"
cp -f "$PACK_DIR"/workflows/tier1-demo-fail.yml "$TARGET/.github/workflows/"

cp -f "$PACK_DIR"/scripts/*.mjs "$TARGET/.github/tier1/scripts/"
cp -f "$PACK_DIR"/scripts/lib/*.mjs "$TARGET/.github/tier1/scripts/lib/"

if [[ ! -f "$TARGET/tier1.config.json" ]]; then
  cp -f "$PACK_DIR/tier1.config.example.json" "$TARGET/tier1.config.json"
  echo "  wrote tier1.config.json (edit project name + agent.mode)"
else
  echo "  kept existing tier1.config.json"
fi

if [[ ! -f "$TARGET/AGENTS.md" ]]; then
  cp -f "$PACK_DIR/AGENTS.tier1.md" "$TARGET/AGENTS.md"
  echo "  wrote AGENTS.md"
fi

cp -f "$PACK_DIR/labels.yml" "$TARGET/.github/tier1/labels.yml"
cp -f "$PACK_DIR/AGENTIC.md" "$TARGET/.github/tier1/AGENTIC.md"
cp -f "$PACK_DIR/OPERATE.md" "$TARGET/.github/tier1/OPERATE.md"
cp -f "$PACK_DIR/ENROL.md" "$TARGET/.github/tier1/ENROL.md"

if [[ "$WITH_GHAW" == true ]]; then
  mkdir -p "$TARGET/.github/workflows"
  cp -f "$PACK_DIR"/gh-aw/tier1-*.md "$TARGET/.github/workflows/"
  if ls "$PACK_DIR"/gh-aw/tier1-*.lock.yml >/dev/null 2>&1; then
    cp -f "$PACK_DIR"/gh-aw/tier1-*.lock.yml "$TARGET/.github/workflows/"
    echo "  copied precompiled tier1-*.lock.yml (re-compile after editing .md)"
  fi
  cp -f "$PACK_DIR"/gh-aw/README.md "$TARGET/.github/tier1/GH-AW.md"
  rm -f "$TARGET/.github/workflows/README.md"
  echo "  copied gh-aw/tier1-*.md — optional: cd $TARGET && gh aw compile"
  echo "  then set agent.mode to \"gh-aw\" in tier1.config.json to skip heuristic/LLM Actions jobs"
fi

chmod +x "$TARGET/.github/tier1/scripts/"*.mjs 2>/dev/null || true

cat > "$TARGET/.github/tier1/ENROLLED.md" <<EOF
# Tier 1 enrolled

Pack source: patterns/tier1
Enrolled at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
gh-aw sources: $WITH_GHAW

Next:
1. Edit \`tier1.config.json\` — \`project\` and \`agent.mode\` (\`auto\` | \`heuristic\` | \`llm\` | \`gh-aw\`).
2. For LLM: add repo secret \`TIER1_LLM_API_KEY\` (see .github/tier1/AGENTIC.md).
3. For gh-aw: \`gh extension install github/gh-aw && gh aw compile\`, commit \`*.lock.yml\`, set mode \`gh-aw\`.
4. Push; enable Actions; workflow permissions Read and write.
5. Run **Tier 1 / Preflight**.
6. Test triage / demo-fail / docs-drift.
7. Day-to-day ops: \`.github/tier1/OPERATE.md\`.
EOF

echo ""
echo "Done. See $TARGET/.github/tier1/ENROLLED.md"
echo "Operate: $TARGET/.github/tier1/OPERATE.md"
echo "Agent backends: $PACK_DIR/AGENTIC.md"
