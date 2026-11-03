# ai-garage

The garage is the enrol pack for a service repository: intake, a pull-request gate, a weekly measure, and a comment when CI fails. Humans still merge.

Enrol copies `garage/` into the service. One config file, `garage.config.json`, chooses the profile. `intake` is triage, docs drift, and CI diagnose. `delivery` is the full path, including the gate.

Live proof is off until that service sets `live_proof.enabled` to `true`. The pack does not build the application or run a check. It requires two recordings, committed by a recipe outside this repo, before a labelled finding can be assigned and again before its fix can merge. See [garage/OPERATE.md](garage/OPERATE.md#live-proof-optional-off-until-you-turn-it-on).

## Enrol a service

```bash
git clone https://github.com/bcgov/ai-garage.git
cd ai-garage
chmod +x garage/enrol.sh
./garage/enrol.sh /path/to/your-service --profile delivery
```

Then [garage/YOU-PROVIDE.md](garage/YOU-PROVIDE.md), [garage/ENROL.md](garage/ENROL.md), and day to day [garage/OPERATE.md](garage/OPERATE.md).

A repository that already has `tier1.config.json` or `tier2-v3.config.json` is migrated by that enrol. Re-run enrol to refresh scripts and workflows. It does not overwrite a filled constitution, spec, or config.

## What a service receives

| Job | When it runs |
| --- | --- |
| Intake | An issue is opened or labelled |
| Gate | A pull request is opened or updated (`delivery` only) |
| Measure | Weekly |
| Diagnose | A watched workflow fails |
| Preflight | After enrol, or when config and spec change |

The gate comment starts with how a person should review the pull request. The description template asks for **What changed** and **How to review this**. The review receipt stays for the human.

## Smoke

```bash
mkdir -p /tmp/garage-smoke && git -C /tmp/garage-smoke init
./garage/enrol.sh /tmp/garage-smoke --profile delivery
node /tmp/garage-smoke/.github/garage/preflight.mjs --root /tmp/garage-smoke
```
