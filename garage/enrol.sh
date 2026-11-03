#!/usr/bin/env bash
# Enrol the garage pack into a consumer repo.
#   ./enrol.sh /path/to/repo                       # profile from existing garage.config.json, else delivery
#   ./enrol.sh /path/to/repo --profile intake      # triage / docs drift / CI diagnose only
#   ./enrol.sh /path/to/repo --profile delivery --with-gh-aw
# Re-run safely: overwrites .github/garage/ and garage-*.yml; never overwrites filled spec/constitution/config.
# Brownfield-safe: never creates src/, tests/, intent/, maintain/, or .specify/presets/.
set -euo pipefail

PACK_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET=""
PROFILE=""
WITH_GHAW=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --with-gh-aw) WITH_GHAW=true; shift ;;
    --*) echo "Unknown flag: $1" >&2; exit 1 ;;
    *) if [[ -z "$TARGET" ]]; then TARGET="$1"; else echo "Unexpected arg: $1" >&2; exit 1; fi; shift ;;
  esac
done
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 /path/to/repo [--profile intake|delivery] [--with-gh-aw]" >&2; exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ -n "$PROFILE" && "$PROFILE" != "intake" && "$PROFILE" != "delivery" ]]; then
  echo "--profile must be intake or delivery" >&2; exit 1
fi

echo "Garage enrol"
echo "  pack:    $PACK_DIR"
echo "  target:  $TARGET"

# 1. Legacy migration (tier1 / tier2-v3) → garage.config.json
if [[ -f "$TARGET/tier1.config.json" || -f "$TARGET/tier2-v3.config.json" ]]; then
  echo "  legacy config detected — migrating"
  node "$PACK_DIR/scripts/migrate-config.mjs" --root "$TARGET" --apply
fi

# 2. Config
if [[ ! -f "$TARGET/garage.config.json" ]]; then
  cp -f "$PACK_DIR/garage.config.example.json" "$TARGET/garage.config.json"
  echo "  wrote garage.config.json"
fi
if [[ -n "$PROFILE" ]]; then
  node -e '
    const fs = require("fs"); const p = process.argv[1]; const c = JSON.parse(fs.readFileSync(p, "utf8"));
    c.profile = process.argv[2]; fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
  ' "$TARGET/garage.config.json" "$PROFILE"
fi
PROFILE="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).profile || "delivery")' "$TARGET/garage.config.json")"
echo "  profile: $PROFILE"
echo "  gh-aw:   $WITH_GHAW"

# 3. Scripts + workflows (always refreshed)
rm -rf "$TARGET/.github/garage"
mkdir -p "$TARGET/.github/garage" "$TARGET/.github/workflows"
cp -R "$PACK_DIR/scripts/." "$TARGET/.github/garage/"
cp -f "$PACK_DIR"/workflows/garage-*.yml "$TARGET/.github/workflows/"
if [[ "$PROFILE" == "intake" ]]; then
  rm -f "$TARGET/.github/workflows/garage-gate.yml"
fi
cp -f "$PACK_DIR/labels.yml" "$TARGET/.github/garage/labels.yml"
cp -f "$PACK_DIR/OPERATE.md" "$TARGET/.github/garage/OPERATE.md"
chmod +x "$TARGET/.github/garage/"*.mjs "$TARGET/.github/garage/hooks/implement-guard.sh" 2>/dev/null || true

# 4. AGENTS.md (create or append once)
MARKER="## Garage — spec-driven delivery"
if [[ ! -f "$TARGET/AGENTS.md" ]]; then
  cp -f "$PACK_DIR/bundle/AGENTS.md" "$TARGET/AGENTS.md"
  printf '\n' >> "$TARGET/AGENTS.md"
  cat "$PACK_DIR/templates/AGENTS.garage-append.md" >> "$TARGET/AGENTS.md"
  echo "  wrote AGENTS.md"
elif ! grep -qF "$MARKER" "$TARGET/AGENTS.md"; then
  { printf '\n'; cat "$PACK_DIR/templates/AGENTS.garage-append.md"; } >> "$TARGET/AGENTS.md"
  echo "  appended garage section to AGENTS.md"
fi

# 5. Delivery-profile scaffold (never overwrite filled files)
if [[ "$PROFILE" == "delivery" ]]; then
  mkdir -p "$TARGET/spec/features" "$TARGET/.github/ISSUE_TEMPLATE" "$TARGET/docs"
  if [[ ! -f "$TARGET/constitution.md" && ! -f "$TARGET/.specify/memory/constitution.md" ]]; then
    cp -f "$PACK_DIR/bundle/constitution.md" "$TARGET/constitution.md"; echo "  wrote constitution.md"
  fi
  if [[ ! -f "$TARGET/bc-gov-sdlc-policy.md" ]]; then
    cp -f "$PACK_DIR/bundle/bc-gov-sdlc-policy.md" "$TARGET/bc-gov-sdlc-policy.md"; echo "  wrote bc-gov-sdlc-policy.md"
  fi
  [[ -f "$TARGET/REVIEW.md" ]] || { cp -f "$PACK_DIR/bundle/REVIEW.md" "$TARGET/REVIEW.md"; echo "  wrote REVIEW.md"; }
  for f in spec.md plan.md tasks.md; do
    [[ -f "$TARGET/spec/$f" ]] || { cp -f "$PACK_DIR/bundle/spec/$f" "$TARGET/spec/$f"; echo "  wrote spec/$f"; }
  done
  if ! ls "$TARGET"/spec/features/*.feature >/dev/null 2>&1; then
    cp -f "$PACK_DIR/bundle/spec/features/example-happy-path.feature" "$TARGET/spec/features/"
    echo "  wrote spec/features/example-happy-path.feature"
  fi
  CO_MARKER="# Garage — implementation agents must not self-modify"
  if [[ ! -f "$TARGET/CODEOWNERS" ]]; then
    cp -f "$PACK_DIR/templates/CODEOWNERS.garage" "$TARGET/CODEOWNERS"; echo "  wrote CODEOWNERS"
  elif ! grep -qF "$CO_MARKER" "$TARGET/CODEOWNERS"; then
    { printf '\n'; cat "$PACK_DIR/templates/CODEOWNERS.garage"; } >> "$TARGET/CODEOWNERS"; echo "  appended CODEOWNERS block"
  fi
  cp -f "$PACK_DIR/templates/feature.yml" "$TARGET/.github/ISSUE_TEMPLATE/feature.yml"
  cp -f "$PACK_DIR/templates/pull_request_template.md" "$TARGET/.github/pull_request_template.md"
  mkdir -p "$TARGET/.github/mcp"
  cp -f "$PACK_DIR/templates/mcp.json.example" "$TARGET/.github/mcp/mcp.json.example"
  node "$TARGET/.github/garage/measure/criteria-index.mjs" --root "$TARGET" >/dev/null 2>&1 || true
fi

# 6. gh-aw sources
if [[ "$WITH_GHAW" == true ]]; then
  cp -f "$PACK_DIR"/gh-aw/garage-*.md "$TARGET/.github/workflows/"
  if [[ "$PROFILE" == "intake" ]]; then rm -f "$TARGET/.github/workflows/garage-review.md"; fi
  echo "  copied gh-aw sources — run: cd $TARGET && gh aw compile ; then set llm.mode to \"gh-aw\""
fi

cat > "$TARGET/.github/garage/ENROLLED.md" <<EOF
# Garage enrolled

Enrolled at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
profile: $PROFILE
gh-aw: $WITH_GHAW

Next:
1. Edit garage.config.json (project name; paths.impl for your layout).
2. Push; Actions → workflow permissions Read and write; run **Garage / Preflight**.
3. Delivery: fill constitution.md placeholders (architecture review PR); write spec/spec.md + features (checkpoint 1); spec/plan.md (checkpoint 2).
4. Delivery: set secret COPILOT_ASSIGN_TOKEN; label issues ready-for-agent — or implement with a local agent (see pack LOCAL.md).
5. Every PR runs **Garage / Gate**; a human merges (checkpoint 3). Weekly **Garage / Measure** opens one review issue.
6. Day-to-day: .github/garage/OPERATE.md
EOF

echo ""
echo "Done. See $TARGET/.github/garage/ENROLLED.md"
