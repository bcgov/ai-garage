## Tier 2 v3 — Spec-driven delivery

This repository is enrolled in **Tier 2** of the BC Gov agentic SDLC pattern.

### Before implementing

1. Confirm work is in `spec/tasks.md` and traced to `spec/features/*.feature` (or an explicit spec section).
2. Query **bc-design-system** MCP before UI (`get_component`, `get_guidelines`).
3. Query **bcgov-sdlc** MCP for constitution / Gherkin / OpenShift checks when relevant.
4. Do not invent scope outside the signed `spec/spec.md`.

### Checkpoints (humans)

1. Spec sign-off  
2. Plan / architecture approval  
3. Review & ship (no agent self-merge)

### Evidence

Update `docs/pr-evidence.md` on implementation PRs with **append** (never overwrite prior slices):

```bash
node .github/tier2-v3/packs/pr-evidence/generate.mjs --root . --finding ID --title "…" --append
```

Fill the **Review receipt** (Checked / Could not check / Residual risk). Implementation PRs that only change evidence without touching code or workflows will **fail** the checkpoint gate.

### Labels

- `ready-for-agent` — triggers **Tier 2 v3 / Assign coding agent** (Copilot draft PR), when `COPILOT_ASSIGN_TOKEN` is set
- `live-proof` — a local before recording must be on the base branch before a coding agent is assigned, and an after recording must be in the implementation diff. The coding agent does not run that check, does not remove the label, and does not invent a stand-in for the component the bug runs through.
- `live-proof-unavailable` — the local copy cannot be built. `spec/spec.md` must say why (`Live proof unavailable: FINDING-ID — reason`). No recording is required.

### Live proof

When `live_proof.enabled` is true and the issue or pull request is marked required:

1. Do not start implementation until `docs/live-proof/<finding-id>/before.md` contains `verdict: confirmed`.
2. On the implementation pull request, add `docs/live-proof/<finding-id>/after.md` with `verdict: closed` in the same diff as the code change.
3. Put `Finding-Id: VULN-001` in the pull request body (or `[RA VULN-001]` in the title).
