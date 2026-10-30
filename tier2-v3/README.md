# Tier 2 v3 pattern pack

Full **agentic delivery (v3)** path for BC Gov greenfield (and similar) services — builds on [Tier 1](../tier1/). Adds Alex-inspired **criterion IDs**, **review receipts**, **provenance checks**, and **coverage metrics** without adding a trace UI or policy inheritance layer.

**Handoff layout:** this folder sits next to `../tier1/` in the pattern repo. Enrol with `./enrol.sh /path/to/service --with-tier1` from here (see root README).

## Tier 1 vs Tier 2 v3

| Tier 1 (keep) | Tier 2 v3 (adds) |
| --- | --- |
| Issue triage · docs drift · CI diagnose | Spec Kit scaffold · constitution |
| Repo automation | Human checkpoints (spec / plan / ship) |
| | Checkpoint gate CI + **risk triage** (direct / pipeline) |
| | **`@R-xx.y` criterion IDs** in Gherkin + coverage in metrics |
| | Spec-aware PR review + **`REVIEW.md`** review receipt |
| | **Redaction guard** on public spec-review comments |
| | **`intent/` loop** — issue → intent PR → spec (`## Evidence`) |
| | **Weekly metrics** (lead time, rework, coverage states, cost of judgment) |
| | **`CODEOWNERS`** on gates, constitution, acceptance |
| | **Provenance header** check on acceptance tests |
| | Harness evals · local hooks · maintain loop · Copilot assign · MCP |

## What's new vs Tier 2 v2

| Capability | v2 (`patterns/tier2-v2/`) | v3 (`patterns/tier2-v3/`) |
| --- | --- | --- |
| Config file | `tier2-v2.config.json` | `tier2-v3.config.json` |
| Pack path | `.github/tier2-v2/` | `.github/tier2-v3/` |
| Workflows | `tier2-v2-*` | `tier2-v3-*` |
| Criterion IDs | — | `@R-xx.y` tags on scenarios; gate warns when missing |
| Risk tier | path heuristics only | `@tier:high` on criterion forces pipeline |
| Review receipt | policy prose | `REVIEW.md` requires checked / could-not-check |
| Test provenance | — | `check-provenance.mjs` on acceptance/e2e tests |
| Redaction | — | deny-list before posting spec-review comments |
| Metrics | lead time + gate taxonomy | + `coverageStates`, `costOfJudgment` |
| Intent evidence | prose in Problem | dedicated `## Evidence` section |

v1 and v2 remain supported for enrolled repos; new greenfield enrols should prefer **v3**.

## Layout

```
patterns/tier2-v3/
  ENROL.md / OPERATE.md / YOU-PROVIDE.md / AGENTIC.md / LOCAL.md
  docs/economics.md
  tier2-v3.config.example.json
  enrol.sh
  bundle/                    # Spec Kit + REVIEW.md + intent template
  workflows/                 # tier2-v3-*
  scripts/                   # checkpoint, provenance, metrics, triage, …
  evals/
  templates/
  mcp/
```

Example consumer: [`../tier2-v3-example/`](../tier2-v3-example/)

## Quick start

```bash
chmod +x patterns/tier2-v3/enrol.sh
./patterns/tier2-v3/enrol.sh /path/to/service --with-tier1 --with-gh-aw
```

See **[ENROL.md](ENROL.md)**. Day-to-day: **[OPERATE.md](OPERATE.md)**. Pipeline diagram: **[docs/pipeline.html](docs/pipeline.html)**. Alex integration map: **[wiki/synthesis/tier2-v3-alex-integration.md](../../wiki/synthesis/tier2-v3-alex-integration.md)**.
