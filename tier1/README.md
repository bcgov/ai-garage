# Tier 1 pattern pack

Plug-and-play **repo automation** for BC Gov teams (deck Tier 1): issue triage, docs drift, CI diagnosis.

- **Plain GitHub Actions** with three backends: heuristic · optional LLM · optional `gh-aw`
- **Heuristic default** — works with only `GITHUB_TOKEN`
- Docs: **[OPERATE.md](OPERATE.md)** (day-to-day) · **[ENROL.md](ENROL.md)** · **[AGENTIC.md](AGENTIC.md)** · **[YOU-PROVIDE.md](YOU-PROVIDE.md)**

## Layout

```
patterns/tier1/
  ENROL.md / OPERATE.md / YOU-PROVIDE.md / AGENTIC.md
  tier1.config.example.json
  labels.yml / AGENTS.tier1.md
  scripts/                 # Node: heuristic + LLM
  workflows/               # Actions YAML (heuristic/LLM)
  gh-aw/                   # Agentic Workflow markdown sources (compile → .lock.yml)
  enrol.sh                 # ./enrol.sh REPO [--with-gh-aw]
```

Example consumer scaffold: [`../tier1-example/`](../tier1-example/).
