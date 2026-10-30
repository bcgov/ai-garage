# Tier 2 v2 — economics (CapEx vs OpEx)

Ministry enrol decisions should weigh **total cost of ownership**, not demo velocity alone. This framing follows Google’s *New SDLC With Vibe Coding* (`gasdlc`, `raw/google-agentic-sdlc/the-new-sdlc-with-vibe-coding.md`): **CapEx vs OpEx; ongoing OpEx is heavily dictated by the token economy.**

## Two curves

| Profile | Upfront (CapEx) | Ongoing (OpEx) | Typical outcome |
| --- | --- | --- | --- |
| **Vibe coding** | Low — prompt and ship | High — unstructured context, fix loops, review churn, security remediation without eval harness | Fast first PR; compounding maintenance tax |
| **Agentic engineering (Tier 2 v2)** | Higher — harness, constitution, Spec Kit, gates, evals, CODEOWNERS | Lower — dense context, deterministic gates, fewer rework cycles | Slower first slice; marginal cost of shipping drops |

**Context engineering is a financial lever:** precise `AGENTS.md`, skills, and review policy raise first-pass success versus noisy full-repo dumps (same source: `gasdlc`).

## CapEx — what you invest once (or per service)

| Item | Pack artifact | Notes |
| --- | --- | --- |
| Enrol + wiring | `enrol.sh`, `tier2-v3.config.json`, MCP snippet | Platform time + repo maintainer time |
| Living standards | `constitution.md`, `.specify/memory/constitution.md` | Architecture review; not a one-off paste |
| Harness entryfile | `AGENTS.md`, `.github/tier2-v3/` packs | Owned like any other infra |
| Non-bypassable governance | `CODEOWNERS`, checkpoint gate, `REVIEW.md` | Prevents agents from weakening acceptance |
| Regression-tested harness | `.github/tier2-v3/evals/` | Catches harness drift before it reaches production PRs |
| Local session guards | `.github/tier2-v3/hooks/` (optional Cursor install) | Blocks protected-path edits during implement |
| Secrets / org policy | `COPILOT_ASSIGN_TOKEN`, Copilot coding agent, optional APIM LLM | Org blockers documented in [[wiki/synthesis/bcgov-pattern-packs]] |

CapEx is **team time**, not a licence line item — but it is real and should be budgeted like CI or branch protection.

## OpEx — what burns every change

| Cost driver | How Tier 2 v2 surfaces it | Mitigation |
| --- | --- | --- |
| **Token burn** | Local/cloud agent sessions, Actions LLM spec review, gh-aw | Structured spec/plan/tasks; one review backend; model routing (`agent.mode` / `spec_review.mode`) |
| **Review cycles** | Checkpoint gate failures, spec review rework | `collect-metrics.mjs` → `reworkCyclesPerPr`, `firstPassMergeRate`, `gateFailureTaxonomy` |
| **Lead time** | Intent → spec → plan → first PR | Same metrics: `intentToSpecDays`, `specToPlanDays`, `planToFirstPrDays` |
| **Copilot cloud agent** | Per-session AI credits when using coding agent | Optional credit tracking (see below) |
| **Human checkpoint time** | Checkpoints 1–3 | Risk triage (`direct` vs `pipeline`) reduces ceremony on truly small changes |

### Measuring OpEx in-repo

Enable weekly metrics in `tier2-v3.config.json`:

```json
"metrics": {
  "enabled": true,
  "schedule": "weekly",
  "artifact_path": "docs/tier2-v3-metrics.json"
}
```

The **Tier 2 v3 / Metrics** workflow runs `node .github/tier2-v3/scripts/collect-metrics.mjs` and uploads the **`tier2-v3-metrics`** artifact (not committed to main). See [OPERATE.md](../OPERATE.md) for field definitions.

Local run:

```bash
node .github/tier2-v3/scripts/collect-metrics.mjs --root .
```

### Optional — Copilot session credits

When the **GitHub Agent Tasks API** is available for your org/repo, per-session **AI credits** (and estimated USD) can be attached to shipped stories. The pilot **pipeline-monitor** implements this pattern:

- Tooling: `pilots/local-dev/pipeline-monitor/generate-story-summary.mjs`
- Wiki examples: `wiki/synthesis/stories/` (Copilot usage sections)
- Conversion: 1 AI credit ≈ $0.01 (nano-AIU scale; not an org invoice export)

Future pack option: `metrics.include_token_cost: true` in `tier2-v3.config.json` when Agent Tasks API access is stable — today, use pipeline-monitor or org billing dashboards for credit totals.

## How to use this with leadership

1. **Quote CapEx honestly** — first vertical slice includes constitution, spec, gates, and smoke enrol (days–weeks, not an afternoon for every ministry).
2. **Track OpEx with metrics** — download weekly artifacts; watch rework cycles and gate taxonomy before blaming “the model.”
3. **Compare modes** — local agent vs Copilot cloud vs Actions LLM; pick one writer per capability to avoid double token spend.
4. **Set the bar at evals** — harness eval failures are cheaper than production security remediation (`gasdlc`: investment in deterministic tests and structured context).

## Related

- [OPERATE.md](../OPERATE.md) — metrics fields, triage, checkpoints
- [AGENTIC.md](../AGENTIC.md) — Copilot assign, LLM backends
- Wiki: [[concepts/metrics-and-velocity]], [[synthesis/adoption-and-metrics]], [[synthesis/bcgov-pattern-packs]]
- Source: [[sources/gasdlc-the-new-sdlc-with-vibe-coding]]
