# ai-garage

Copy of the BC Gov **Tier 2 v3** pattern pack, with an optional live-proof gate. Enrol still copies `tier2-v3/` into a service repo. The gate stays off until that repo sets `live_proof.enabled` to `true`.

The pack does not build an application or run a check. It requires two recordings, committed by a recipe outside this repo, before a labelled finding can be signed and again before its fix can merge. See [tier2-v3/OPERATE.md](tier2-v3/OPERATE.md#live-proof-optional-off-until-you-turn-it-on).

## Tier 2 v3 pattern pack

Handoff package for the **BC Gov Tier 2 v3** enrol pack: Spec Kit scaffold, constitution, human checkpoints, checkpoint gate CI, criterion IDs (`@R-xx.y`), review receipts, metrics, and optional Copilot coding-agent assign.

This repo is **self-contained**. It includes:

| Path | What it is |
| --- | --- |
| [`tier2-v3/`](tier2-v3/) | The pattern pack (enrol scripts, workflows, docs) |
| [`tier1/`](tier1/) | Tier 1 dependency (issue triage, docs drift, CI diagnose) — enrol with `--with-tier1` |
| [`example/`](example/) | Pre-enrolled smoke consumer (what the pack looks like after enrol) |
| [`tier2-v3/docs/pipeline.html`](tier2-v3/docs/pipeline.html) | Visual pipeline overview (open in a browser) |

## Quick start (enrol into a service repo)

```bash
git clone https://github.com/bcgov/ai-garage.git
cd ai-garage

chmod +x tier1/enrol.sh tier2-v3/enrol.sh

# Recommended: Tier 1 + Tier 2 v3 (+ optional gh-aw sources)
./tier2-v3/enrol.sh /path/to/your-service --with-tier1

cd /path/to/your-service
${EDITOR:-nano} tier2-v3.config.json    # project name
${EDITOR:-nano} tier1.config.json       # if --with-tier1
${EDITOR:-nano} constitution.md         # fill {{PLACEHOLDER}}s

git add .
git commit -m "chore: enrol Tier 2 v3 (Spec Kit + checkpoints)"
git push
```

Then follow **[tier2-v3/ENROL.md](tier2-v3/ENROL.md)** (post-push checklist) and day-to-day **[tier2-v3/OPERATE.md](tier2-v3/OPERATE.md)**.

## How to use — doc map

Start here, in order:

1. **[tier2-v3/YOU-PROVIDE.md](tier2-v3/YOU-PROVIDE.md)** — what the consuming team must supply (repo, secrets, reviewers)
2. **[tier2-v3/ENROL.md](tier2-v3/ENROL.md)** — enrol steps and after-push checklist
3. **[tier2-v3/OPERATE.md](tier2-v3/OPERATE.md)** — the story of a change (constitution → spec → plan → implement → gate → merge → metrics)
4. **[tier2-v3/AGENTIC.md](tier2-v3/AGENTIC.md)** — Copilot assign, LLM / gh-aw review backends
5. **[tier2-v3/LOCAL.md](tier2-v3/LOCAL.md)** — local IDE agents + MCP

Tier 1-only docs live under [`tier1/`](tier1/) (`ENROL.md`, `OPERATE.md`, `AGENTIC.md`).

### Preview the pipeline diagram

```bash
cd tier2-v3/docs
python3 -m http.server 8877 --bind 127.0.0.1
# open http://127.0.0.1:8877/pipeline.html
```

### Smoke without a real service repo

```bash
cp -R example /tmp/tier2-v3-smoke
# or re-enrol into a fresh empty git repo:
mkdir -p /tmp/my-service && cd /tmp/my-service && git init
/path/to/tier2-v3-pattern/tier2-v3/enrol.sh . --with-tier1
```

## What the pack does (short)

**Tier 1:** labels thin issues, watches docs drift, comments a heuristic diagnosis on failed CI.

**Tier 2 v3 adds:** Spec Kit + constitution; human checkpoints (spec / plan / ship); checkpoint gate CI; `@R-xx.y` criterion IDs; `REVIEW.md` receipt; provenance checks; weekly metrics; optional Copilot `ready-for-agent` → draft PR; optional maintain / intent loops.

Humans still own merge (checkpoint 3). Agents propose.

## Status / provenance

Frozen snapshot from the AI SDLC working tree (`patterns/archive/tier2-v3/` + `tier1/`), aligned with packs used in the 2026 pilots (`bcparks-ar-admin-agentic-b`, restitution).

**Note for maintainers:** in the originating monorepo this pack was later consolidated into a single `patterns/sdlc/` pipeline (`profile: delivery` ≈ former Tier 2 v3). This handoff repo ships the **Tier 2 v3** shape people already ran in pilots, not that successor. Do not expect ongoing sync from the monorepo unless someone re-exports.

## License / use

Intended for BC Gov / public-sector service teams adopting a voluntary agentic delivery path. Adjust constitution, CODEOWNERS, and secrets for your org before production use.
