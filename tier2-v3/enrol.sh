#!/usr/bin/env bash
# Enrol Tier 2 v3 (Spec Kit + checkpoints + spec review) into a consumer repo.
# Usage:
#   ./enrol.sh /path/to/repo
#   ./enrol.sh /path/to/repo --with-tier1
#   ./enrol.sh /path/to/repo --with-tier1 --with-gh-aw
set -euo pipefail

PACK_DIR="$(cd "$(dirname "$0")" && pwd)"
TIER1_DIR="$(cd "$PACK_DIR/../tier1" && pwd)"
TARGET=""
WITH_TIER1=false
WITH_GHAW=false

for arg in "$@"; do
  case "$arg" in
    --with-tier1) WITH_TIER1=true ;;
    --with-gh-aw) WITH_GHAW=true ;;
    --*)
      echo "Unknown flag: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$arg"; else echo "Unexpected arg: $arg" >&2; exit 1; fi
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 /path/to/repo [--with-tier1] [--with-gh-aw]" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"

echo "Tier 2 v3 enrol"
echo "  pack:    $PACK_DIR"
echo "  target:  $TARGET"
echo "  tier1:   $WITH_TIER1"
echo "  gh-aw:   $WITH_GHAW"

if [[ "$WITH_TIER1" == true ]]; then
  if [[ ! -x "$TIER1_DIR/enrol.sh" ]]; then
    echo "Tier 1 enrol not found at $TIER1_DIR/enrol.sh" >&2
    exit 1
  fi
  if [[ "$WITH_GHAW" == true ]]; then
    "$TIER1_DIR/enrol.sh" "$TARGET" --with-gh-aw
  else
    "$TIER1_DIR/enrol.sh" "$TARGET"
  fi
fi

mkdir -p \
  "$TARGET/.github/workflows" \
  "$TARGET/.github/tier2-v3/scripts" \
  "$TARGET/.github/tier2-v3/evals/tasks" \
  "$TARGET/.github/tier2-v3/hooks" \
  "$TARGET/.github/ISSUE_TEMPLATE" \
  "$TARGET/.github/mcp" \
  "$TARGET/spec/features" \
  "$TARGET/intent" \
  "$TARGET/maintain" \
  "$TARGET/.specify/memory" \
  "$TARGET/.specify/presets" \
  "$TARGET/docs" \
  "$TARGET/src"

# Bundle — constitution + spec scaffold
mkdir -p "$TARGET/.specify/memory" "$TARGET/.specify/presets"
if [[ ! -f "$TARGET/.specify/memory/constitution.md" ]]; then
  if [[ -f "$PACK_DIR/bundle/.specify/memory/constitution.md" ]]; then
    cp -f "$PACK_DIR/bundle/.specify/memory/constitution.md" "$TARGET/.specify/memory/constitution.md"
  else
    cp -f "$PACK_DIR/bundle/constitution.md" "$TARGET/.specify/memory/constitution.md"
  fi
  echo "  wrote .specify/memory/constitution.md"
fi
if [[ ! -f "$TARGET/constitution.md" ]]; then
  cp -f "$PACK_DIR/bundle/constitution.md" "$TARGET/constitution.md"
  echo "  wrote constitution.md"
fi
if [[ ! -f "$TARGET/REVIEW.md" ]]; then
  cp -f "$PACK_DIR/bundle/REVIEW.md" "$TARGET/REVIEW.md"
  echo "  wrote REVIEW.md"
fi
cp -R "$PACK_DIR/bundle/presets/." "$TARGET/.specify/presets/"

for f in spec.md plan.md tasks.md; do
  if [[ ! -f "$TARGET/spec/$f" ]]; then
    cp -f "$PACK_DIR/bundle/spec/$f" "$TARGET/spec/$f"
    echo "  wrote spec/$f"
  fi
done
if [[ ! -f "$TARGET/spec/features/example-happy-path.feature" ]]; then
  cp -f "$PACK_DIR/bundle/spec/features/example-happy-path.feature" "$TARGET/spec/features/" 2>/dev/null || true
fi
if [[ ! -f "$TARGET/tests/acceptance/example-happy-path.test.ts" ]]; then
  mkdir -p "$TARGET/tests/acceptance"
  cp -f "$PACK_DIR/bundle/tests/acceptance/example-happy-path.test.ts" "$TARGET/tests/acceptance/" 2>/dev/null || true
  echo "  wrote tests/acceptance/example-happy-path.test.ts"
fi
if [[ ! -f "$TARGET/intent/.template.md" ]]; then
  cp -f "$PACK_DIR/bundle/intent/intent.template.md" "$TARGET/intent/.template.md"
  echo "  wrote intent/.template.md"
fi
if [[ ! -f "$TARGET/maintain/bands.json" ]]; then
  cp -f "$PACK_DIR/bundle/maintain/bands.json" "$TARGET/maintain/bands.json"
  echo "  wrote maintain/bands.json"
fi
# Migrate away from legacy bands.yaml if only yaml present
if [[ -f "$TARGET/maintain/bands.yaml" && ! -f "$TARGET/maintain/bands.json" ]]; then
  cp -f "$PACK_DIR/bundle/maintain/bands.json" "$TARGET/maintain/bands.json"
  echo "  wrote maintain/bands.json (migrated from bands.yaml)"
fi

# AGENTS.md — merge tier2 if missing enrol marker (Tier 1 AGENTS mentions "Tier 2" in upgrade path)
MARKER="## Tier 2 v3 — Spec-driven delivery"
if [[ ! -f "$TARGET/AGENTS.md" ]]; then
  cp -f "$PACK_DIR/bundle/AGENTS.md" "$TARGET/AGENTS.md"
  cat "$PACK_DIR/templates/AGENTS.tier2-v3-append.md" >> "$TARGET/AGENTS.md"
  echo "  wrote AGENTS.md"
elif ! grep -qF "$MARKER" "$TARGET/AGENTS.md" 2>/dev/null; then
  {
    echo ""
    cat "$PACK_DIR/templates/AGENTS.tier2-v3-append.md"
  } >> "$TARGET/AGENTS.md"
  echo "  appended Tier 2 section to AGENTS.md"
fi

# Config
if [[ ! -f "$TARGET/tier2-v3.config.json" ]]; then
  cp -f "$PACK_DIR/tier2-v3.config.example.json" "$TARGET/tier2-v3.config.json"
  echo "  wrote tier2-v3.config.json"
fi

CODEOWNERS_MARKER="# Tier 2 v2 — do not let implementation agents"
if [[ ! -f "$TARGET/CODEOWNERS" ]]; then
  cp -f "$PACK_DIR/templates/CODEOWNERS.tier2-v3" "$TARGET/CODEOWNERS"
  echo "  wrote CODEOWNERS"
elif ! grep -qF "$CODEOWNERS_MARKER" "$TARGET/CODEOWNERS" 2>/dev/null; then
  { echo ""; cat "$PACK_DIR/templates/CODEOWNERS.tier2-v3"; } >> "$TARGET/CODEOWNERS"
  echo "  appended Tier 2 v2 CODEOWNERS block"
fi

# Scripts + workflows (includes tier2-v3-metrics.yml when metrics.enabled)
cp -f "$PACK_DIR"/scripts/*.mjs "$TARGET/.github/tier2-v3/scripts/"
cp -f "$PACK_DIR"/workflows/tier2-v3-*.yml "$TARGET/.github/workflows/"
cp -f "$PACK_DIR"/evals/*.md "$PACK_DIR"/evals/*.json "$PACK_DIR"/evals/*.mjs "$TARGET/.github/tier2-v3/evals/" 2>/dev/null || true
cp -f "$PACK_DIR"/evals/tasks/*.json "$TARGET/.github/tier2-v3/evals/tasks/" 2>/dev/null || true

# Packs
mkdir -p "$TARGET/.github/tier2-v3/packs"
cp -R "$PACK_DIR/packs/pr-evidence" "$TARGET/.github/tier2-v3/packs/"
cp -R "$PACK_DIR/packs/public-service-minimums" "$TARGET/.github/tier2-v3/packs/"
if [[ ! -f "$TARGET/docs/public-service-minimums.md" ]]; then
  cp -f "$PACK_DIR/packs/public-service-minimums/checklist.md" "$TARGET/docs/public-service-minimums.md"
fi
# Issue / PR templates
cp -f "$PACK_DIR"/templates/*.yml "$TARGET/.github/ISSUE_TEMPLATE/" 2>/dev/null || true
cp -f "$PACK_DIR/templates/pull_request_template.md" "$TARGET/.github/" 2>/dev/null || true
cp -f "$PACK_DIR/labels.yml" "$TARGET/.github/tier2-v3/labels.yml" 2>/dev/null || true

# Local session hooks (optional — install to .cursor/hooks per hooks/README.md)
cp -f "$PACK_DIR/templates/hooks/implement-guard.sh" "$TARGET/.github/tier2-v3/hooks/"
cp -f "$PACK_DIR/templates/hooks/hooks.json.example" "$TARGET/.github/tier2-v3/hooks/"
cp -f "$PACK_DIR/templates/hooks/README.md" "$TARGET/.github/tier2-v3/hooks/"
chmod +x "$TARGET/.github/tier2-v3/hooks/implement-guard.sh"

# MCP snippet
cp -f "$PACK_DIR/mcp/mcp.json.example" "$TARGET/.github/mcp/mcp.json.example"
cp -f "$PACK_DIR/AGENTIC.md" "$TARGET/.github/tier2-v3/AGENTIC.md"
cp -f "$PACK_DIR/OPERATE.md" "$TARGET/.github/tier2-v3/OPERATE.md"
cp -f "$PACK_DIR/LOCAL.md" "$TARGET/.github/tier2-v3/LOCAL.md"
cp -f "$PACK_DIR/ENROL.md" "$TARGET/.github/tier2-v3/ENROL.md"

if [[ "$WITH_GHAW" == true ]]; then
  cp -f "$PACK_DIR"/gh-aw/tier2-v3-*.md "$TARGET/.github/workflows/"
  if ls "$PACK_DIR"/gh-aw/tier2-v3-*.lock.yml >/dev/null 2>&1; then
    cp -f "$PACK_DIR"/gh-aw/tier2-v3-*.lock.yml "$TARGET/.github/workflows/"
  fi
  echo "  copied tier2-v3 gh-aw sources — run: cd $TARGET && gh aw compile"
fi

chmod +x "$TARGET/.github/tier2-v3/scripts/"*.mjs 2>/dev/null || true
chmod +x "$TARGET/.github/tier2-v3/evals/"*.mjs 2>/dev/null || true

# Generate criteria index from enrolled features
if [[ -f "$TARGET/.github/tier2-v3/scripts/generate-criteria-index.mjs" ]]; then
  node "$TARGET/.github/tier2-v3/scripts/generate-criteria-index.mjs" --root "$TARGET" || true
fi

cat > "$TARGET/.github/tier2-v3/ENROLLED.md" <<EOF
# Tier 2 v3 enrolled

Enrolled at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
tier1: $WITH_TIER1
gh-aw: $WITH_GHAW

Next:
1. Fill constitution placeholders and open a constitution PR (architecture review).
2. Edit tier2-v3.config.json project name.
3. Connect MCP servers (see .github/mcp/mcp.json.example).
4. Write technology-free spec/spec.md + features; checkpoint 1.
5. Write plan.md; checkpoint 2.
6. Set secret COPILOT_ASSIGN_TOKEN (user PAT); enable Copilot coding agent on the repo.
7. Label issues \`ready-for-agent\` → auto-assigns Copilot (or implement in IDE).
8. PRs get checkpoint-gate + spec-review; human merges (checkpoint 3).
9. Day-to-day ops: \`.github/tier2-v3/OPERATE.md\` (local agents: LOCAL.md).
EOF

echo ""
echo "Done. See $TARGET/.github/tier2-v3/ENROLLED.md and $PACK_DIR/ENROL.md"
echo "Operate: $TARGET/.github/tier2-v3/OPERATE.md"
