# AGENTS.md — {{SERVICE_NAME}}

Instructions for coding agents working in this repository.

## Mission

Implement only what is specified under `spec/`, consistent with `.specify/memory/constitution.md` (or `constitution.md` at repo root if that is where the bundle was placed) and with `bc-gov-sdlc-policy.md` beside the constitution. Do not waive a MUST in that policy.

## Before writing UI

1. Call the **BC Design System MCP** (`get_component`, `get_guidelines`, `get_setup`).
2. Prefer Design System components and tokens; never hard-code BC blue/gold hex values.
3. If Figma MCP is connected, re-read the live canvas; do not trust stale screenshots.

## Before claiming "done"

1. Map work to a `spec/features/*.feature` scenario or an explicit tasks.md item.
2. Attach or update `docs/pr-evidence.md` (see PR evidence pack).
3. Write the pull request description in plain technical language. Say what changed, then how to review it: which spec to read, which files to open, what to run, and what a correct result looks like. Leave the review receipt for the human reviewer.
   Under **Change and verification walkthrough**, use concise, simple language to explain the behavior before the change, how the change affects it, the actual checks and outcomes (including before/after when applicable), and what remains unverified. Lead with the key point and include only details needed to understand the change and evidence. Link permitted evidence; identify synthetic data or stubs. Never invent a test result or disclose restricted evidence.
4. Do not merge your own PR. Do not weaken the gate.

## Repo conventions

- TypeScript/React unless `spec/plan.md` says otherwise.
- OpenShift manifests under `deploy/` or `.pipeline/` as the plan defines.
- No secrets in git; use cluster secrets / sealed secrets per PaaS practice.

## When blocked

Open a draft PR or issue describing the ambiguity. Do not invent product rules that contradict the constitution or spec.

## Optional local implement guard

During **implementation** sessions, teams may install Cursor hooks from `.github/garage/hooks/` that block agent edits to `spec/features/**`, `.github/workflows/**`, `.github/garage/**`, `constitution.md`, and `garage.config.json`. For spec/plan work, start the agent with `GARAGE_ALLOW_SPEC_EDIT=1`. See pack `LOCAL.md` and `hooks/README.md`.
