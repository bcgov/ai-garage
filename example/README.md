# Tier 2 v3 example consumer

Pre-enrolled smoke repo for `tier2-v3/` (+ Tier 1). Not a production service.

```bash
node .github/tier2-v3/scripts/preflight.mjs
node .github/tier2-v3/scripts/check-checkpoints.mjs --root .
```

Re-enrol from this pattern repo:

```bash
./tier2-v3/enrol.sh ./example --with-tier1
```

See the root [README.md](../README.md) and [tier2-v3/OPERATE.md](../tier2-v3/OPERATE.md) for how to run the pipeline.
