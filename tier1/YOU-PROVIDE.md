# What we need from you (to create a test repo and try Tier 1)

The pack in this repo is ready to copy. **You** own the GitHub side. Without the items below, workflows cannot run.

## Must have (blocking)

| # | You provide | Why |
| --- | --- | --- |
| 1 | **A GitHub repo** you can admin (org or personal). Prefer a **new empty/disposable** repo, e.g. `tier1-pattern-test`. | Workflows only run on GitHub.com / GHE, not locally. |
| 2 | **Actions enabled** on that repo (and org policy allowing Actions). | Tier 1 is 100% Actions-based. |
| 3 | **`GITHUB_TOKEN` workflow permission = Read and write** (Settings → Actions → General → Workflow permissions). | Triage labels/comments, docs-drift PR, CI diagnose comments need write. |
| 4 | **Push access** from your machine (`git push`) **or** agreement that I/we open a PR into a repo you create. | Enrol writes files into the consumer repo. |
| 5 | **Repo visibility + org rules** — if `bcgov` (or similar) restricts Actions, Apps, or fork PRs, confirm a sandbox org/personal account is OK for the pilot. | Avoid silent workflow blocks. |

## Nice to have (not required for heuristic)

| Item | Why |
| --- | --- |
| `gh` CLI authenticated (`gh auth login`) on your machine | Local preflight / label create without waiting for Actions |
| Permission to create repos under a team/org | Cleaner than personal sandbox |
| Name of your real CI workflow (`name:` in YAML) | So CI diagnose watches production pipelines, not only the demo fail job |
| Rocket.Chat channel (optional) | Human support for enrol failures — process, not code |

## For the **agentic** paths (optional)

| Path | You provide |
| --- | --- |
| **LLM (Actions)** | Repo secret `TIER1_LLM_API_KEY` + optional `TIER1_LLM_BASE_URL` / var `TIER1_LLM_MODEL`. OpenAI-compatible or Azure (`api_style: azure` in config). Set `agent.mode` to `auto` or `llm`. |
| **gh-aw** | `gh extension install github/gh-aw`, engine auth (org Copilot billing **or** `COPILOT_GITHUB_TOKEN`), run `gh aw compile`, commit `*.lock.yml`, set `agent.mode` to `gh-aw`. |

Heuristic remains the zero-secret default.

## Decision we need from you (reply with answers)

1. **Where should the test repo live?**  
   - [ ] Personal account (`github.com/<you>/tier1-pattern-test`)  
   - [ ] Org (`github.com/<org>/tier1-pattern-test`) — org name: ________  
   - [ ] You will create the empty repo and paste the URL here  

2. **Who pushes enrol commits?**  
   - [ ] I (platform) have write access — give me repo URL + confirm  
   - [ ] You run `enrol.sh` locally and push — I’ll only support  

3. **GHE or github.com?** ________  

4. **Any Actions allowlist / required checks** we must not fight? ________  

## After you answer

We will:

1. Point `enrol.sh` at the repo (or you run it).  
2. Push the Tier 1 files.  
3. Walk the three manual tests in [ENROL.md](ENROL.md).  
4. Note any org-policy failures for the pattern docs.

## Quick create (you can do this now)

```bash
# On your machine, with gh auth:
gh repo create tier1-pattern-test --private --clone
cd tier1-pattern-test
# From ai-sdlc clone:
/path/to/ai-sdlc/patterns/tier1/enrol.sh .
# Edit tier1.config.json → "project": "tier1-pattern-test"
git add . && git commit -m "chore: enrol Tier 1" && git push -u origin HEAD
```

Then paste the repo URL back so we can validate Actions runs together.
