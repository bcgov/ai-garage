# Enrol garage (external teams)

**Goal:** Spec Kit + constitution + checkpoint gate + spec-aware review in *your* service repo. `--profile delivery` (default) includes intake (triage / Copilot assign / measure / CI diagnose). Use `--profile intake` for triage-only.

## Prerequisites

See **[YOU-PROVIDE.md](YOU-PROVIDE.md)**.

## Enrol

```bash
chmod +x garage/enrol.sh
# Recommended: delivery profile + optional gh-aw sources
./garage/enrol.sh /path/to/your-service --profile delivery --with-gh-aw

cd /path/to/your-service
${EDITOR:-nano} garage.config.json   # project name
${EDITOR:-nano} constitution.md     # fill {{PLACEHOLDER}}s (or .specify/memory/constitution.md)

git add .
git commit -m "chore: enrol garage (Spec Kit + checkpoints)"
git push -u origin HEAD
```

Smoke without a service repo:

```bash
mkdir -p /tmp/garage-smoke && git -C /tmp/garage-smoke init
./garage/enrol.sh /tmp/garage-smoke --profile delivery
```

Brownfield repos with `tier1.config.json` and/or `tier2-v3.config.json` are migrated automatically on enrol (`scripts/migrate-config.mjs --apply`).

## After push

1. **Actions** — Read and write workflow permissions.
2. Run **Garage / Preflight** (workflow_dispatch). Must be green.
3. Connect MCP for a local coding agent (see **[LOCAL.md](LOCAL.md)** — start from `.github/mcp/mcp.json.example`).
4. Open a **constitution PR** for architecture review; fill placeholders before production.
5. Write technology-free `spec/spec.md` + `spec/features/*.feature` → **checkpoint 1**.
6. Write `spec/plan.md` → **checkpoint 2**.
7. Set secret **`COPILOT_ASSIGN_TOKEN`** (user PAT — see [AGENTIC.md](AGENTIC.md)). Ensure Copilot coding agent is enabled on the repo.
8. Label issues `ready-for-agent` → workflow auto-assigns Copilot (or implement in IDE).
9. Draft PRs get **Garage / Gate**; **human merges** (checkpoint 3).

## Config

`garage.config.json` (see `garage.config.example.json`):

| Key | Purpose |
| --- | --- |
| `profile` | `delivery` (gate + checkpoints) or `intake` (triage / docs drift / CI diagnose) |
| `gate.*` | What the gate requires |
| `llm.mode` | `heuristic` / `auto` / `llm` / `gh-aw` |
| `intake.coding_agent.auto_assign` | Label → assign Copilot (`true` by default on delivery) |
| `intake.coding_agent.label` | Default `ready-for-agent` |

### Agent backends

See **[AGENTIC.md](AGENTIC.md)**.

| Mode | Enrol | Secrets |
| --- | --- | --- |
| Heuristic / `auto` without key | default | none |
| `auto` / `llm` | optional | `GARAGE_LLM_API_KEY` (legacy `TIER1_LLM_*` names still accepted) |
| `gh-aw` | `--with-gh-aw` + `gh aw compile` | Copilot org billing or `COPILOT_GITHUB_TOKEN` |

When `llm.mode` is `gh-aw`, Actions LLM / review narrative no-ops so you do not double-comment.

```bash
./enrol.sh /path/to/repo --profile delivery --with-gh-aw
cd /path/to/repo
# set "llm": { "mode": "gh-aw" }
gh extension install github/gh-aw
gh aw compile
git add .github/workflows/garage-*.md .github/workflows/garage-*.lock.yml garage.config.json
git commit -m "chore(sdlc): gh-aw spec review" && git push
```

## What “done” looks like for a story

1. Spec + feature signed (checkpoint 1)  
2. Plan approved (checkpoint 2)  
3. Coding agent (or human) opens draft PR  
4. Checkpoint gate + spec review green/commented  
5. Human merges (checkpoint 3)

## Day-to-day

After enrol, use **[OPERATE.md](OPERATE.md)** — checkpoints, local vs cloud implement, weekly rhythm, troubleshooting. Local agents: **[LOCAL.md](LOCAL.md)**.

## Support

Paste preflight / gate logs into an issue on the pattern repo. Do not disable the checkpoint gate to greenwash merges.
