# Garage

One enrolable pack for a service repository. Four jobs:

- **Intake** — label a thin issue, and assign a coding agent when the issue is marked ready
- **Gate** — constitution, spec, plan, features, evidence, provenance, review, and optional live proof, as one pull-request comment
- **Measure** — weekly metrics, docs drift, and one review issue
- **Diagnose** — a comment when a watched workflow fails

Humans own three checkpoints (spec, plan, ship). Agents propose.

`profile: "intake"` is triage, docs drift, and CI diagnose only. `profile: "delivery"` is the full path. Those used to be called Tier 1 and Tier 2. The profile is the switch. The directory name is garage.

## Layout

```
garage/
  ENROL.md  OPERATE.md  AGENTIC.md  LOCAL.md  SIGHTLINE.md  YOU-PROVIDE.md
  enrol.sh
  garage.config.example.json
  scripts/          # copied to the service as .github/garage/
  workflows/        # garage-intake, garage-gate, garage-measure, garage-ci-diagnose, garage-preflight
  gh-aw/            # optional; compile in the service repo
  bundle/  templates/  labels.yml
  tests/            # pack tests; not copied into a service
```

## Enrol

```bash
chmod +x garage/enrol.sh
./garage/enrol.sh /path/to/service --profile delivery
```

Then [ENROL.md](ENROL.md), and day to day [OPERATE.md](OPERATE.md). Copilot and model backends: [AGENTIC.md](AGENTIC.md). A local coding agent: [LOCAL.md](LOCAL.md).

A repo that still has `tier1.config.json` or `tier2-v3.config.json` is migrated on enrol. Older secret names `SDLC_LLM_*` and `TIER1_LLM_*` still work.

Live proof stays off until `live_proof.enabled` is true. The existing gate reads two recordings that a recipe outside the pack commits. The separately enabled [Sightline pilot](SIGHTLINE.md) can coordinate a local synthetic verification container; it requires separate approval and human review.

## Tests

```bash
bash garage/tests/run-all.sh
```

The delivery profile also copies [`bundle/bc-gov-sdlc-policy.md`](bundle/bc-gov-sdlc-policy.md), the graded MUST rules taken from the B.C. IM/IT guidelines. The task runner that scores an agent against those rules stays with the ai-sdlc catalog. It is not copied into a service.
