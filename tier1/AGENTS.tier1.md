# AGENTS.md (Tier 1)

This repository uses **Tier 1** automation from the BC Gov agentic SDLC pattern:

1. **Issue triage** — labels and asks for detail on thin issues
2. **Docs drift** — periodic check that docs keep up with code
3. **CI diagnose** — comments a diagnosis on failed workflow runs

Backend is selected by `agent.mode` in `tier1.config.json`: `heuristic` | `auto` | `llm` | `gh-aw` (see `.github/tier1/AGENTIC.md`).

## For coding agents

- Do not disable Tier 1 workflows to “make CI green.”
- Prefer updating `docs/` in the same PR when you change public APIs under `src/`.
- Write issue bodies with: problem, expected, actual, steps — triage bots flag thin descriptions.
- Configuration: `tier1.config.json` at repo root.

## Upgrade path

Tier 2 adds Spec Kit, constitution, Design System MCP, and human checkpoints. See the platform `bcgov-agentic-glue` bundles when you are ready.
