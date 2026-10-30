# What we need from you (to try Tier 2)

Tier 2 builds on Tier 1. You still need a GitHub repo with Actions; plus willingness to keep **spec / plan / constitution** in git and run **three human checkpoints**.

## Must have (blocking)

| # | You provide | Why |
| --- | --- | --- |
| 1 | **A GitHub repo** you can admin (prefer disposable, e.g. `tier2-pattern-test`) | Workflows only run on GitHub |
| 2 | **Actions enabled** + **`GITHUB_TOKEN` Read and write** | Checkpoint comments, Tier 1 if enrolled |
| 3 | **Push access** (or agree we open a PR) | Enrol writes Spec Kit + workflows |
| 4 | **Someone who will own checkpoints** | Agents must not self-merge; humans sign spec/plan/ship |
| 5 | **Tier 1 decision** — enrol with `--with-tier1` (recommended) or Tier 2 alone | Intake vs delivery stack |

## Nice to have

| Item | Why |
| --- | --- |
| `gh` CLI authenticated | Local preflight / labels |
| Node 22+ | Local `check-checkpoints.mjs` / preflight |
| Absolute paths to Design System + SDLC MCP builds | Local coding agent can query components & constitution |
| Org Copilot coding agent access | Issue → draft PR path without local IDE |
| Figma MCP (optional) | Design-in-the-loop |

## For agentic paths (optional)

| Path | You provide |
| --- | --- |
| **LLM (Actions)** | Same as Tier 1: secret `TIER1_LLM_API_KEY`, set `spec_review.mode` to `auto` or `llm` |
| **gh-aw** | `gh aw compile`, commit `tier2-v3-spec-review.lock.yml`, set mode `gh-aw` |
| **Coding agent auto-assign** | Repo secret `COPILOT_ASSIGN_TOKEN` (user PAT) + Copilot coding agent enabled on the repo. Label `ready-for-agent` triggers assign. |

## Decision we need from you

1. **Where should the test repo live?** personal / org / you create URL  
2. **Include Tier 1?** yes (recommended) / Tier 2 only  
3. **gh-aw for spec review?** yes / heuristic only  
4. **Who owns checkpoint 1–3** for the pilot? ________  

## Quick create

```bash
gh repo create tier2-pattern-test --private --clone
cd tier2-pattern-test
/path/to/ai-sdlc/patterns/tier2-v3/enrol.sh . --with-tier1 --with-gh-aw
# Edit tier2-v3.config.json → "project": "tier2-pattern-test"
git add . && git commit -m "chore: enrol Tier 2" && git push -u origin HEAD
```

Then run **Tier 2 v3 / Preflight** in Actions and paste the URL back.
