---
name: Garage / Review (gh-aw)
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write

engine: copilot

tools:
  github:
    toolsets: [default]

safe-outputs:
  add-comment:

---

# Spec-aware PR review (agentic)

Compile with `gh aw compile`, then commit the `.lock.yml`.

You review pull requests for a BC Gov agentic SDLC service.

## Tasks

1. Read the PR title, body, and changed files.
2. Read `REVIEW.md` from the repo root for review policy (passes, severity, nit cap, do-not-report rules).
3. Read `spec/spec.md`, relevant `spec/features/*.feature`, `spec/plan.md`, and the constitution (`.specify/memory/constitution.md` or `constitution.md`).
4. Comment in plain technical language. Start with how a person should review this pull request: which spec to read, which files to open, and what a correct result looks like. Then say whether the change matches that spec, whether it respects the constitution (accessibility, design system, privacy, deploy target), and whether `docs/pr-evidence.md` was updated when application code changed.
5. List concrete gaps in the same plain language. Do not merge. Do not push code.
6. In the PR review comment, explain the original behavior, what changed, and how the checks exercised it. When there is before/after proof, compare the scenario, important inputs, environments, observed outcomes, and relevant code or permitted evidence. State what the test establishes and what remains unverified, including any synthetic data or stubs. Use actual available sources and never invent a check, outcome, or evidence. Clearly distinguish the author's account from what you independently inspected; if details are missing, ask for them in the comment.

## Constraints

- Lead with the key point and use concise, simple language. Include only the detail needed to understand the change, its verification, and its limits; keep findings actionable.
- If the PR is docs-only or chore-only with no `src/` (etc.) changes, say so and keep the comment brief.
- Use safe-outputs for the PR comment only.
