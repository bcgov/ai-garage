## Garage — spec-driven delivery

This repository is enrolled in the garage (`garage.config.json`).

### Before implementing

1. Confirm the work is in `spec/tasks.md` and traced to `spec/features/*.feature` (scenarios carry `@R-xx.y` IDs).
2. Query **bc-design-system** MCP before UI (`get_component`, `get_guidelines`).
3. Query **bcgov-sdlc** MCP for constitution / Gherkin / OpenShift checks when relevant.
4. Do not invent scope outside the signed `spec/spec.md`.
5. Follow `bc-gov-sdlc-policy.md`. Do not waive a MUST.

### Checkpoints (humans)

1. Spec sign-off  2. Plan approval  3. Review & ship — **no agent self-merge**.

### Evidence

Append to `docs/pr-evidence.md` on implementation PRs (never overwrite prior slices):

```bash
node .github/garage/evidence.mjs --root . --finding ID --title "…" --append
```

Fill the **Review receipt** (Checked / Could not check / Residual risk). Implementation PRs that only change evidence fail the gate.

Write the pull request description in plain technical language. Under **What changed**, say what is different and why. Under **How to review this**, give ordered steps: which spec to read, which files to open, what to run, and what a correct result looks like. Leave the receipt for the human reviewer.

Under **Change and verification walkthrough**, use concise, simple language to explain the original behavior, how the change affects it, what checks were actually performed and their outcomes, and their limits. Lead with the key point and include only the detail needed to understand the change and evidence. Compare before and after when relevant; identify synthetic data and stubs, link permitted evidence, and state what was not checked. Do not invent results or expose restricted evidence.

### Labels

- `ready-for-agent` — **Garage / Intake** assigns the Copilot coding agent (needs `COPILOT_ASSIGN_TOKEN`).
- `live-proof` — a before recording is required before assign, and an after recording is required before an implementation pull request merges. Off until `live_proof.enabled` is true.
- `live-proof-unavailable` — the dependency on the bug path cannot be started. Record the reason in `spec/spec.md`. Do not invent a stand-in.
