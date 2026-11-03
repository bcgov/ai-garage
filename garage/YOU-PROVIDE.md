# What we need from you (to try the garage)

The garage needs a GitHub repo with Actions, willingness to keep **spec / plan / constitution** in git (delivery profile), and **three human checkpoints**. `profile: intake` is triage / docs drift / CI diagnose only.

## Must have (blocking)

| # | You provide | Why |
| --- | --- | --- |
| 1 | **A GitHub repo** you can admin (prefer disposable, e.g. `sdlc-pattern-test`) | Workflows only run on GitHub |
| 2 | **Actions enabled** + **`GITHUB_TOKEN` Read and write** | Gate comments, intake labels |
| 3 | **Push access** (or agree we open a PR) | Enrol writes Spec Kit + workflows |
| 4 | **Someone who will own checkpoints** | Agents must not self-merge; humans sign spec/plan/ship |
| 5 | **Profile** — `delivery` (recommended) or `intake` | Full gate vs triage-only |

## Nice to have

| Item | Why |
| --- | --- |
| `gh` CLI authenticated | Local preflight / labels |
| Node 22+ | Local `gate.mjs` / preflight |
| Absolute paths to Design System + SDLC MCP builds | Local coding agent can query components & constitution |
| Org Copilot coding agent access | Issue → draft PR path without local IDE |
| Figma MCP (optional) | Design-in-the-loop |

## For agentic paths (optional)

| Path | You provide |
| --- | --- |
| **LLM (Actions)** | Secret `GARAGE_LLM_API_KEY` (older `SDLC_LLM_*` and `TIER1_LLM_*` names still work), set `llm.mode` to `auto` or `llm` |
| **gh-aw** | `gh aw compile`, commit `garage-*.lock.yml`, set `llm.mode` to `gh-aw` |
| **Coding agent auto-assign** | Repo secret `COPILOT_ASSIGN_TOKEN` (user PAT) + Copilot coding agent enabled on the repo. Label `ready-for-agent` triggers assign. |

## Decision we need from you

1. **Where should the test repo live?** personal / org / you create URL  
2. **Profile?** `intake` or `delivery`  
3. **gh-aw for spec review?** yes / heuristic only  
4. **Who owns checkpoint 1–3** for the pilot? ________  

## Quick create

```bash
gh repo create garage-pattern-test --private --clone
cd garage-pattern-test
/path/to/ai-garage/garage/enrol.sh . --profile delivery --with-gh-aw
# Edit garage.config.json → "project": "garage-pattern-test"
git add . && git commit -m "chore: enrol garage" && git push -u origin HEAD
```

Then run **Garage / Preflight** in Actions and paste the URL back.
