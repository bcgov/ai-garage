# gh-aw — Tier 2

Natural-language agentic workflow for **spec-aware PR review**.

| File | Role |
| --- | --- |
| `tier2-v3-spec-review.md` | Source (edit this) |
| `tier2-v3-spec-review.lock.yml` | Precompiled — commit after `gh aw compile` |

```bash
# From consumer repo after enrol --with-gh-aw
gh aw compile
# Set spec_review.mode to "gh-aw" in tier2-v3.config.json so Actions heuristic skips
```

Same engine auth as Tier 1 (org Copilot billing or `COPILOT_GITHUB_TOKEN`). See [`../AGENTIC.md`](../AGENTIC.md).
