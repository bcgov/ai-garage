# BC Gov greenfield Spec Kit bundle

Week-zero starter for a **new public or internal service**. Copy into a repo, customize project-specific articles, open a PR for architecture guild review (checkpoint 0 / constitution).

## Install

```bash
# From a new service repository root:
cp -R /path/to/ai-sdlc/bcgov-agentic-glue/bundles/greenfield/.specify .specify
cp /path/to/ai-sdlc/bcgov-agentic-glue/bundles/greenfield/constitution.md .specify/memory/constitution.md
cp /path/to/ai-sdlc/bcgov-agentic-glue/bundles/greenfield/AGENTS.md ./AGENTS.md
cp -R /path/to/ai-sdlc/bcgov-agentic-glue/bundles/greenfield/presets .specify/presets
mkdir -p spec && cp -R /path/to/ai-sdlc/bcgov-agentic-glue/bundles/greenfield/spec/* spec/
```

If you use [Spec Kit](https://github.com/github/spec-kit) / `specify init`, merge these files over the generated defaults rather than re-initing blindly (Spec Kit can clobber templates).

## What's included

| File | Role |
| --- | --- |
| `constitution.md` | Non-negotiables + slots for project articles |
| `AGENTS.md` | Agent behaviour for this repo |
| `presets/compliance.md` | WCAG, DS, PIA, OpenShift constraints |
| `presets/greenfield.md` | Greenfield workflow expectations |
| `spec/` | Empty scaffold: `spec.md`, `plan.md`, `tasks.md`, `features/` |

## After copy

1. Fill `constitution.md` project articles (service name, ministry, data classification).
2. Connect MCP servers: BC Design System, Figma, GitHub, `bcgov-sdlc`.
3. Add the [checkpoint-gate](../../actions/checkpoint-gate/) workflow.
4. Constitution PR → architecture review once → merge.
