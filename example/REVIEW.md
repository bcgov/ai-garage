# Review instructions

## How to write the review

Write in plain technical language. Say which files you opened, what you compared them to, and whether the change does what the spec says. Say what you could not check. A concrete sentence is more useful than a process label.

The pull request description should already contain **How to review this**. Follow those steps, then write down where they were wrong or incomplete.

## Passes
Run three passes; tag each finding:
- **Bugs** — logic errors, broken edge cases, subtle regressions
- **Security** — injection, auth gaps, PII in logs, secrets in git
- **Compliance** — matches spec/spec.md, spec/plan.md, constitution P1–P8, and B.C. Design System usage

## Important vs nit
**Important** = would break behaviour, leak data, or breach policy.
Style and naming are nits.

## Cap the nits
At most five nits per review; summarize the rest as a count.

## Do not report
- Generated paths listed in spec/plan.md
- Anything CI already enforces (checkpoint gate, linters)
- Placeholder tokens when `strict_placeholders` is false

## Review receipt (required for checkpoint 3)

Before approving merge, state explicitly:

1. **Checked** — which criterion IDs (`@R-xx.y`), spec sections, and scenarios you verified against the PR.
2. **Could not check** — what you did not have time, access, or environment to verify (e.g. production-only behaviour, full a11y audit).
3. **Residual risk** — anything you are accepting on trust or deferring to a follow-up issue.
4. **Live proof** — when the pull request is marked `live-proof`, say whether you looked at `docs/live-proof/<id>/after.md` and whether `verdict: closed` matches the code change. When it is marked `live-proof-unavailable`, say whether the reason in `spec/spec.md` is enough to proceed without a recording.

A receipt without "could not check" is incomplete. Nits alone do not satisfy checkpoint 3.
