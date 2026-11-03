# Garage — GitHub Agentic Workflows (`gh-aw`)

Natural-language agent workflows (public preview). These are **sources**; consumers compile and run the generated `*.lock.yml` files.

| Source | Role |
| --- | --- |
| `garage-triage.md` | Issue triage on open/reopen |
| `garage-docs-drift.md` | Weekly docs drift check |
| `garage-ci-diagnose.md` | Diagnose failed CI workflow runs |
| `garage-review.md` | Spec-aware PR review |

```bash
# From consumer repo after enrol --with-gh-aw
gh aw compile
# Set llm.mode to "gh-aw" in garage.config.json so Actions scripts skip their LLM/comment sections
```

Do not commit `.lock.yml` files in this pack — consumers compile after enrol. Same engine auth as Tier 1 (org Copilot billing or `COPILOT_GITHUB_TOKEN`). See pack `AGENTIC.md`.
