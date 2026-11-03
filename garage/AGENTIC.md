# garage — agent backends & coding agent

## What the pack includes

| Capability | Mechanism |
| --- | --- |
| Spec as source of truth | `spec/` + constitution in git (delivery profile) |
| Checkpoint gate | **Garage / Gate** fails PRs missing artifacts |
| Spec-aware review | Actions heuristic (+ optional LLM) and/or `gh-aw` — one PR comment |
| Implementation | Label `ready-for-agent` → **auto-assign Copilot coding agent** |

`profile: intake` keeps triage / docs drift / CI diagnose and turns the gate and Copilot assign off.

## Coding agent workflow

### A. Local coding agent (recommended for day-to-day)

See **[LOCAL.md](LOCAL.md)** — open the enrolled repo, wire MCP from `.github/mcp/mcp.json.example`, follow `AGENTS.md`, implement, push a draft PR.

### B. Copilot cloud (GitHub)

1. Issue uses the Feature template (spec ref + acceptance).
2. Human adds label **`ready-for-agent`** (or Feature template includes it).
3. Workflow **Garage / Intake** assigns `copilot-swe-agent[bot]` via the Issues API (`agent_assignment`).
4. Copilot opens a **draft PR**; **Garage / Gate** runs.
5. Human merges (checkpoint 3).

Intake triage only labels issues — it does **not** implement.

### Secret (required for auto-assign)

Actions `GITHUB_TOKEN` **cannot** assign Copilot (billing is tied to a user). Set:

```bash
# Fine-grained PAT: Issues RW, Contents RW, Pull requests RW, Metadata R
# Classic: repo scope
gh secret set COPILOT_ASSIGN_TOKEN --repo OWNER/REPO
```

Optional fallback: `COPILOT_GITHUB_TOKEN` (same user-token rules).

Also required: **Copilot coding agent enabled** for the repo and token owner  
(Settings → Copilot → Coding agent / org policy). If GraphQL `suggestedActors` does not list `copilot-swe-agent`, assignment will fail until that is turned on.

### Config (`garage.config.json`)

```json
"intake": {
  "coding_agent": {
    "auto_assign": true,
    "label": "ready-for-agent",
    "base_branch": "main",
    "custom_instructions": ""
  }
}
```

Set `auto_assign: false` to keep the label as a human-only signal.

## Azure OpenAI (Actions LLM path)

Use when `llm.mode` is `auto` or `llm` (not `gh-aw`). Scripts read `GARAGE_LLM_*` first. Older `SDLC_LLM_*` and `TIER1_LLM_*` names still work.

```bash
REPO=bcgov/sdlc-pattern-test   # or kmandryk/sdlc-pattern-test

# APIM subscription key (or native Azure key)
gh secret set GARAGE_LLM_API_KEY --repo "$REPO"

# Full deployment URL (endpoint + /openai/deployments/{name})
gh secret set GARAGE_LLM_BASE_URL --repo "$REPO" \
  --body "https://ai-services-hub-test-apim.azure-api.net/sdpr-invoice-automation/openai/deployments/gpt-5.1-chat"

gh variable set GARAGE_LLM_API_STYLE --repo "$REPO" --body "azure-apim"
gh variable set GARAGE_LLM_API_VERSION --repo "$REPO" --body "2025-04-01-preview"
```

In `garage.config.json`:

```json
"llm": {
  "mode": "auto",
  "api_style": "azure-apim",
  "base_url": "https://ai-services-hub-test-apim.azure-api.net/sdpr-invoice-automation/openai/deployments/gpt-5.1-chat",
  "api_version": "2025-04-01-preview",
  "api_key_env": "GARAGE_LLM_API_KEY"
}
```

If `llm.mode` is `gh-aw`, Azure/APIM is unused for review (Copilot CLI runs instead).

## MCP

See `.github/mcp/mcp.json.example`. Required for UI work: Design System MCP. Recommended: `bcgov-sdlc`, GitHub; Figma when design-in-the-loop.

## gh-aw

```bash
# After enrol --with-gh-aw
gh aw compile   # produces garage-review.lock.yml and the other garage-*.lock.yml files
```

Set `llm.mode` carefully — avoid double comments from Actions + gh-aw on the same PR (prefer one).
