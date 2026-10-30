# AGENTS.md — {{SERVICE_NAME}}

Instructions for coding agents working in this repository.

## Mission

Implement only what is specified under `spec/`, consistent with `.specify/memory/constitution.md` (or `constitution.md` at repo root if that is where the bundle was placed).

## Before writing UI

1. Call the **BC Design System MCP** (`get_component`, `get_guidelines`, `get_setup`).
2. Prefer Design System components and tokens; never hard-code BC blue/gold hex values.
3. If Figma MCP is connected, re-read the live canvas; do not trust stale screenshots.

## Before claiming "done"

1. Map work to a `spec/features/*.feature` scenario or an explicit tasks.md item.
2. Attach or update `docs/pr-evidence.md` (see PR evidence pack).
3. Do not merge your own PR. Do not weaken checkpoint-gate checks.

## Repo conventions

- TypeScript/React unless `spec/plan.md` says otherwise.
- OpenShift manifests under `deploy/` or `.pipeline/` as the plan defines.
- No secrets in git; use cluster secrets / sealed secrets per PaaS practice.

## When blocked

Open a draft PR or issue describing the ambiguity. Do not invent product rules that contradict the constitution or spec.

## Optional local implement guard

During **implementation** sessions, teams may install Cursor hooks from `.github/tier2-v3/hooks/` that block agent edits to `spec/features/**`, `.github/workflows/**`, `.github/tier2-v3/scripts/**`, `constitution.md`, and `tier2-v3.config.json`. For spec/plan work, start the agent with `TIER2_ALLOW_SPEC_EDIT=1`. See `.github/tier2-v3/LOCAL.md` and `hooks/README.md`.
