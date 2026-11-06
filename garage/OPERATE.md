# Operate the garage

Human playbook for **day-to-day use** of the garage pack after enrol.  
For first-time setup see [ENROL.md](ENROL.md). Backends & coding agent: [AGENTIC.md](AGENTIC.md). Local IDE agents: [LOCAL.md](LOCAL.md).

For the optional synthetic Sightline proof pilot, see [SIGHTLINE.md](SIGHTLINE.md).

**What the garage is:** spec-driven delivery — constitution + Spec Kit in git, human checkpoints, PR gates, optional Copilot assign, optional MCP for local agents, plus intake (triage / docs drift / CI diagnose).  
**Profiles:** `delivery` is the full path. `intake` is triage / docs drift / CI diagnose only (no gate).

---

## Who does what

| Role | Responsibilities |
| --- | --- |
| **Product / tech lead** | Owns constitution placeholders → real standards; signs checkpoint 1–2; merges (checkpoint 3) |
| **Developers** | Write `spec/` and features; implement from signed work; draft PRs only until gate is green |
| **Local coding agent users** | Follow `AGENTS.md` + MCP; never self-merge |
| **Repo maintainers** | `garage.config.json`, secrets (`COPILOT_ASSIGN_TOKEN`, LLM), branch protection, MCP paths |
| **Platform** | Pack updates, org Copilot coding-agent policy, APIM/runner access for Actions LLM |

---

## The story of a change

```text
Constitution (living standards)
        ↓
Feature issue — stage 0: who is stuck, what outcome, evidence
        ↓
Spec + features  ──►  Checkpoint 1 (human: did we agree what to build?)
        ↓
Plan             ──►  Checkpoint 2 (human: is the plan sound?)
        ↓
Implement (local agent or Copilot cloud) ──► draft PR
        ↓
Garage / Gate (checkpoints + review + live proof when enabled)
        ↓
Human merge      ──►  Checkpoint 3 (does the PR match what we said?)
```

Agents may draft; **humans** accept spec, plan, and ship.

### Front door (no side entrances)

Every change — including production fixes — re-enters through the same path: **issue → spec → plan → implement → merge**. There is no hot-patch lane that skips the record. Agents may **propose** (draft PRs, spec deltas, evidence); only a named human at a checkpoint **commits** the contract.

| Stage | Agent may | Human must |
| --- | --- | --- |
| Issue (proposal) | Draft Problem / Outcome / Evidence in the Feature template | Accept problem and outcome (label ready when clear) |
| Spec / features | Draft `spec/spec.md`, Gherkin with `@R-xx.y` | Sign checkpoint 1 — agree what to build |
| Plan | Draft `spec/plan.md` | Sign checkpoint 2 — agree how |
| Implement | Draft code + tests with provenance headers | Sign checkpoint 3 — merge |

**Proposal vs spec:** conversational intake and issue bodies are *proposals*. `spec/spec.md` and `spec/features/*.feature` are the *contract* after checkpoint 1. Do not treat chat or issue text as authoritative once spec is signed.

### Gate proliferation rule

Add a new automated gate only when (a) it blocks a class of defect humans repeatedly miss, and (b) it does not duplicate an existing check. Prefer extending `REVIEW.md`, criterion IDs, or metrics over new workflows. If a gate fires more than twice a month on false positives, tune or remove it — safety routed around provides no safety.

---

## Issues are proposals

Program staff file issues using the **Feature / story** template (Problem + Outcome required). The issue is the proposal; label `ready-for-agent` when a cloud coding agent may implement. Do not treat the issue body as the signed spec — that is checkpoint 1.

---

## Artifacts you keep current

| Path | Role |
| --- | --- |
| `constitution.md` (and/or `.specify/memory/constitution.md`) | Non-negotiables: security, a11y, logging, stack |
| `bc-gov-sdlc-policy.md` | 52 graded MUST rules. “How this was cut” records why that is fewer than the 874 mandatory statements in the source PDFs: a delivery session must be able to violate the clause, repeated standard/specification wording is kept once, and one heading is one eval. One task per rule under `garage/evals/tasks/`. |
| `spec/spec.md` | Technology-light “what” |
| `spec/features/*.feature` | Acceptance scenarios |
| `spec/plan.md` | Approach for the slice |
| `spec/tasks.md` | Implementable breakdown |
| `docs/pr-evidence.md` | Evidence pack for reviews (when required) |
| `AGENTS.md` | Entryfile for coding agents |
| `garage.config.json` | Gates, review mode, coding-agent assign |

Fill `{{PLACEHOLDER}}`s before treating the repo as production-ready.

---

## Human checkpoints (operate these deliberately)

| # | When | Owner asks | Exit |
| --- | --- | --- | --- |
| **1 — Spec** | Before implementation of a slice | Is the behaviour clear and testable? | Spec + features agreed (PR or recorded review) |
| **2 — Plan** | Before coding the slice | Is the approach safe and sized? | `spec/plan.md` agreed |
| **3 — Ship** | Before merge to the default branch | Does this PR match spec/plan and clear gates? | Human merge only |

Do not turn off the checkpoint gate to “make CI green.” Fix the artifacts or the PR scope.

### Assessment gap accepted (checkpoint 1)

When the signed spec asks for **less** than the originating finding / assessment **Expected**:

1. Add an explicit note under the feature file or `spec/spec.md`:  
   `Assessment gap accepted: <what was deferred> — follow-up: <issue or “none”>.`
2. Keep the backlog row **partial** (or open a follow-up issue) — do **not** mark the original finding fully done.
3. Prefer **scenario-per-outcome** Gherkin (one `@R-xx.y` scenario per concrete acceptance check). Avoid a single scenario that only says “the criterion is satisfied.”

Scope reduction is sometimes correct (e.g. server-side log shipping is a project). The failure mode is quietly closing the assessment finding when only the narrowed slice shipped.

### Evidence-only implementations (blocked)

The checkpoint gate **fails** implementation-shaped PRs that update `docs/pr-evidence.md` but touch **no** `paths.impl` (including `.github/workflows/`). Evidence without a code/workflow diff is not a fix (see agentic-b LOG-002).

Always append evidence:

```bash
node .github/garage/evidence.mjs --root . --finding AUTH-001 --title "…" --append
```

**Criterion IDs (`@R-xx.y`):** every scenario should carry a permanent ID (e.g. `@R-14.1`). The checkpoint gate **warns** when IDs are missing. IDs feed weekly `coverageStates` in the metrics artifact.

**Path-aware plan requirement:** the checkpoint gate requires `spec/plan.md` only when the PR’s **changed files** touch implementation prefixes — not merely because an `src/` directory exists on disk.

Risk triage is off by default — `gate.risk_triage.enabled`.

Local dry-run:

```bash
node .github/garage/gate.mjs --root . --changed-paths src/foo.ts --no-comment
```

---

## Live proof (optional, off until you turn it on)

Most tickets never use this. Set `live_proof.enabled` to `true` in `garage.config.json` when this repository should demand a local recording for some findings. Leaving it `false` changes nothing.

Add label **`live-proof`** when the bug can be shown with a request against a local copy of the app: injection, a login check you can actually hit, a connection that trusts any server. Logging, tests, headers, secrets sitting in a file, and dependency cleanup do not get the label.

Add label **`live-proof-unavailable`** when a local copy cannot be built because something on the bug’s path cannot be started (a government database, an internal login). Do not invent a stand-in for that component. The spec must contain a line:

```text
Live proof unavailable: VULN-004 — the database cannot be started on a laptop.
```

The pack does not know how to start the application. A recipe outside this pack commits two files:

| File | When | Required line |
| --- | --- | --- |
| `docs/live-proof/<finding-id>/before.md` | On the branch before checkpoint 1, and before `ready-for-agent` assigns a coding agent | `verdict: confirmed` |
| `docs/live-proof/<finding-id>/after.md` | In the implementation pull request diff, next to the code change | `verdict: closed` |

Name the finding in the pull request with `Finding-Id: VULN-001` or `[RA VULN-001]`. The same label on the pull request keeps the full gate, so a missing plan is a failure rather than a warning. A recording with no code change is still not a fix.

The person or session that produces the recordings is not the coding agent that writes the fix.

---

## Two ways to implement

### A. Local coding agent (default day-to-day)

1. Clone the **service** repo (not the pattern monorepo) as the agent workspace.
2. Wire MCP from `.github/mcp/mcp.json.example` — see [LOCAL.md](LOCAL.md).
3. Prompt against a signed issue / `spec/tasks.md` row; require a **draft** PR.
4. Let **Garage / Gate** run on GitHub; you merge.

No `COPILOT_ASSIGN_TOKEN` required for this path.

### B. Copilot cloud coding agent

1. Issue uses the Feature template (spec ref + acceptance).
2. Add label **`ready-for-agent`** (configurable).
3. Workflow assigns Copilot → Copilot opens a **draft** PR.
4. Gate + review run; **you** merge.

Needs: coding agent enabled on the repo + secret **`COPILOT_ASSIGN_TOKEN`** (user PAT — `GITHUB_TOKEN` cannot assign). Details: [AGENTIC.md](AGENTIC.md).

You can use A and B on different issues; both must respect the same checkpoints.

---

## Batch pilots & backlog hygiene

When draining many findings (security assessment, remediation wave):

| Rule | Why |
| --- | --- |
| **Sequential slice lock** | One writer / one open impl branch at a time — parallel agents fight over shared `spec.md` / `plan.md` / `pr-evidence.md` |
| **Always pass `--repo owner/name` to `gh`** | Clones with an `upstream` remote can make `gh` target the wrong repo |
| **Dedupe before `gh issue create`** | Search open/closed issues for `[RA FINDING-ID]` first |
| **Close-on-ship** | Close the finding issue when the implementation PR merges (`Closes #n` in the PR body) |
| **Metrics reviews** | After reviewing the weekly `garage:review` issue, close it or file follow-up issues — leave it open only while action is pending |
| **Post-pass verification** | Before declaring a backlog “drained,” re-check each finding against the **original assessment Expected** (grep / inspect), not only against the signed slice. Track **slice complete** vs **finding remediated** separately |

---

## What CI enforces

| Workflow | Purpose |
| --- | --- |
| **Garage / Preflight** | Manual or config/spec push; sanity (scripts, config, scaffold) |
| **Garage / Gate** | One PR comment: checkpoints, structural checks, provenance, review, and live proof when that switch is on. Risk triage optional (`gate.risk_triage.enabled`) |
| **Garage / Intake** | Issue triage (labels / `needs-detail`); `ready-for-agent` → Copilot assign |
| **Garage / Measure** | Weekly metrics artifact, docs drift, one `garage:review` issue |
| **Garage / CI diagnose** | Comment on failed watched CI runs. Add fingerprints to `ci_diagnose.known_residuals` so accepted residuals are flagged, not treated as new |

---

## Weekly review issue

**Garage / Measure** runs Monday 06:00 UTC (or on demand), uploads the `garage-metrics` artifact, runs docs drift, and opens/updates one issue labelled `garage:review` with the metrics table. Review it, file actions as issues, close it.

The workflow writes `docs/garage-metrics.json` locally in CI and uploads it as the **`garage-metrics`** artifact — the file is **not** committed to the default branch.

| Field | Meaning |
| --- | --- |
| `specToPlanDays` | Days from first spec commit to first plan commit |
| `planToFirstPrDays` | Days from first plan commit to earliest PR opened |
| `firstPassMergeRate` | Share of last 30 merged PRs with ≤1 commit (0–1) |
| `reworkCyclesPerPr` | Average extra commits per merged PR (commits − 1) |
| `gateFailureTaxonomy` | Counts of checkpoint-gate check failures (by check id when parseable) |
| `coverageStates` | Per `R-xx.y` ID: `specified` → `accepted` (on default branch) → `implemented` → `verified` |
| `costOfJudgment.reviewTurnsPerCheckpointPr` | Average human PR comment count on spec/plan PRs (proxy for review turns) |
| `costOfJudgment.medianDaysAtCheckpoint` | Median days from open to merge on checkpoint PRs |
| `traceabilityQuality.criterionIdCoverage` | Share of Gherkin scenarios with `@R-xx.y` tags (`coverageRate`, `missingScenarios`) |
| `traceabilityQuality.provenanceCoverage` | Share of acceptance/e2e tests with valid `criterion: @R-xx.y` header |
| `traceabilityQuality.coverageSummary` | Counts per coverage state; `stalledCriteria` (no progress past `stall_days`); `orphanCriteria` (specified/accepted only) |
| `traceabilityQuality.implPrTraceability` | On last 30 merged impl PRs: `specTraceMissRate`, `reviewReceiptMissRate` |

Nulls mean the artifact path did not exist yet or `gh` was unavailable. Toggle with `measure.metrics.enabled` in `garage.config.json`; artifact path defaults to `measure.metrics.artifact_path`. Measure also regenerates `spec/criteria-index.json`. Dry-run locally:

```bash
node .github/garage/measure.mjs --root . --dry-run
```

---

## Config you’ll actually touch

Root file: **`garage.config.json`**.

**CODEOWNERS** (written at enrol) is the allowManagedHooksOnly equivalent for GitHub: it blocks implementation agents from self-modifying gates, constitution, acceptance criteria, and pack config. Replace placeholder teams (`@bcgov/platform-architecture`, `@bcgov/qa-leads`) with your org’s GitHub teams or named owners before relying on branch protection.

| Knob | Typical use |
| --- | --- |
| `profile` | `delivery` (full gate) or `intake` (triage-only) |
| `paths.impl` | Paths that require plan/features; include `.github/workflows/` for workflow-only fixes |
| `paths.evidence` | Evidence file the gate expects (`docs/pr-evidence.md`) |
| `gate.evidence_requires_impl` | Fail evidence-only “impl” PRs (default true) |
| `gate.require_plan_on_impl` | Require `spec/plan.md` when impl paths change |
| `gate.strict_placeholders` | Tighten when scaffolds are filled |
| `llm.mode` | `heuristic` · `auto` · `llm` · `gh-aw` |
| `llm.*` | Actions LLM for review and triage (`GARAGE_LLM_*`; older `SDLC_LLM_*` and `TIER1_LLM_*` names still work) |
| `live_proof.enabled` | Off until a repo wants before/after recordings. The pack does not run the check |
| `gate.review.require_evidence` / `gate.review.require_receipt` | Expect `docs/pr-evidence.md` and `REVIEW.md` receipt |
| `intake.coding_agent.auto_assign` | `false` = label is human signal only |
| `intake.coding_agent.label` | Default `ready-for-agent` |
| `intake.triage.enabled` / `intake.triage.min_body_length` | Thin-issue labelling |
| `measure.metrics.enabled` / `measure.metrics.artifact_path` | Weekly metrics; artifact path for local CLI runs |
| `measure.metrics.gate_taxonomy_exclude` | Drop non-blocking noise (e.g. `activation`, `agent`) from failure taxonomy |
| `measure.docs_drift.enabled` | Weekly docs-vs-code drift |
| `measure.review_issue.enabled` / `measure.review_issue.label` | Rolling `garage:review` issue |
| `ci_diagnose.watch_workflows` | Exact `name:` of app CI workflows to diagnose |
| `ci_diagnose.known_residuals` | Regexes for accepted-but-still-red jobs |
| `gate.risk_triage.enabled` | Off by default |

### Review backends — stay on one writer

Don’t let Actions LLM **and** gh-aw both comment on every PR. Set `llm.mode` to match the backend you want.

---

## Normal weekly rhythm

1. **Preflight** after pack or config changes. Optionally download the latest **garage-metrics** artifact to track lead time and gate friction.
2. **Constitution PR** when standards change — treat it as architecture review, not a drive-by edit.
3. **One vertical slice** at a time: spec → plan → implement → draft PR → merge.
4. **Label hygiene** — only `ready-for-agent` when the slice is ready for a cloud agent (acceptance clear, checkpoints 1–2 done).
5. **Read gate failures** — missing feature file or plan usually means the PR is ahead of the paper trail; fix artifacts, don’t bypass.
6. **Evidence** — append to `docs/pr-evidence.md` (`evidence.mjs --append`); fill **Review receipt** (Checked / Could not check / Residual risk).
7. **Close finding issues** on merge; close or action the weekly `garage:review` issue after triage.
8. **After a backlog wave** — run independent verification vs the source assessment before claiming drained.

---

## First-week checklist (after enrol)

- [ ] Actions: workflow permissions **Read and write**
- [ ] **Garage / Preflight** green
- [ ] Replace constitution / spec placeholders for a thin pilot slice
- [ ] Open a constitution or spec PR and practice checkpoint 1
- [ ] Wire local MCP **or** set `COPILOT_ASSIGN_TOKEN` + confirm `copilot-swe-agent` is available
- [ ] Land one **draft** implementation PR; confirm **Garage / Gate** runs
- [ ] Human merges (checkpoint 3) — confirm branch protection doesn’t allow bot self-merge

---

## Troubleshooting

| Symptom | Likely cause | What to try |
| --- | --- | --- |
| Checkpoint gate fails on every PR | Placeholders / missing `spec/` files / wrong `paths.impl` | Fill scaffold; align prefixes with real paths; see gate logs |
| Spec review silent | `gate.review.enabled: false` or `llm.mode` / skip mismatch | Check config; ensure PR is implementation-shaped |
| Double review comments | Actions + gh-aw both writing | One `llm.mode` |
| `ready-for-agent` no draft PR | Coding agent off, bad PAT, or assign workflow failed | `suggestedActors` / secret / workflow log — see AGENTIC.md |
| Copilot PR checks stuck at action_required | Actions approval policy for bot PRs | Settings → Actions → General → "Require approval" scope; or push an empty commit as operator |
| Same CI failure every PR | Known residual (e.g. CodeQL SARIF) | Add a pattern to ci_diagnose.known_residuals so diagnose flags it, then fix or remove the failing job — do not merge over red indefinitely |
| Local agent ignores DS / constitution | MCP not wired or wrong absolute paths | [LOCAL.md](LOCAL.md); rebuild MCP `dist/` |
| LLM review 403 | APIM private network vs GitHub-hosted runners | Use heuristic/gh-aw for review, or private runners — wiki pattern-packs status |

Org blockers (APIM, Copilot): pattern monorepo `wiki/synthesis/bcgov-pattern-packs.md`, or ask platform.

---

## Updating the pack

```bash
./garage/enrol.sh /path/to/your-service --profile delivery [--with-gh-aw]
```

Overwrites `.github/garage/` and `garage-*.yml`; preserves existing `garage.config.json` and filled `spec/` / constitution when already present. Diff carefully. Re-compile gh-aw locks after editing `.md` sources.

---

## Related docs

| Doc | Use when |
| --- | --- |
| [ENROL.md](ENROL.md) | First install |
| [AGENTIC.md](AGENTIC.md) | Modes, Copilot assign, Azure/APIM, gh-aw |
| [LOCAL.md](LOCAL.md) | IDE / local agent loop |
