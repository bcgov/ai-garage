# Intent (stage 1)

The `intent/` directory holds **stage 1** artifacts: the raw problem statement and proposed outcome *before* a technology-free spec exists.

## Flow

1. **Intent** — capture who is stuck, what outcome is wanted, constraints, and open questions (`intent/<slug>.md`).
2. **Spec** — derive `spec/spec.md` and `spec/features/*.feature` from a signed intent (checkpoint 1).
3. **Plan** — architecture and tasks (checkpoint 2).
4. **Implement** — draft PR, gate, human merge (checkpoint 3).

## Getting started

Copy `.template.md` to a new file when starting a slice:

```bash
cp intent/.template.md intent/my-feature.md
```

Fill placeholders, agree with stakeholders, then link the intent from `spec/spec.md` under **Upstream intent**.

## Enforcement

Set `checkpoints.require_intent: true` in `tier2-v3.config.json` to warn when `spec/spec.md` exists but no `intent/*.md` files are present (excluding `.template.md`). Default is `false` (warn-first opt-in).
