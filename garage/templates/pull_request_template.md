## What changed

<!-- A few sentences in plain technical language.
     Say what is different, and why.
     Name the screen, endpoint, or file a reviewer would recognize.
     If this fixes a finding, name it (for example VULN-001). -->

## Change and verification walkthrough

<!-- Write for a reviewer who has not followed the work. Lead with the key
     behavior and use concise, simple language; give only the detail needed to
     understand the change, the evidence, and its limits.
     Before: what behavior or problem could someone see, and under what conditions?
     Change: what now happens, and how does the change address that behavior?
     Verification: for each meaningful check, say what was actually run, against
     which version/environment, its important inputs and steps, and the observed
     result. For a before/after proof, explain the same check and outcome in both.
     Limits: what the checks demonstrate, what they do not, and what was not run.
     Link relevant code, specs, and approved evidence. Describe stubs and synthetic
     data where used. Do not include sensitive data or expose restricted evidence.
     State when a test was not run or its result is unknown; do not invent evidence.
     The gate repeats this author-provided section in its PR comment but does not
     independently verify its claims. -->

## How to review this

<!-- Ordered steps for the person reviewing. Be specific.
     1. Which spec or feature to read, and what "done" means there.
     2. Which files to open, and what to compare.
     3. What command to run, and what a correct result looks like.
     4. If live proof applies: open the before recording, then the after recording.
        Explain what the same check observed in each run and its limitations. -->

1. Read …
2. Open …
3. Run …

## Where this comes from

- Spec or feature: <!-- spec/features/….feature or a section of spec/spec.md -->
- Scenario: <!-- the behaviour this pull request is supposed to satisfy -->
- Finding-Id: <!-- VULN-001, or "none" -->

## Live proof

Live-proof: not-applicable

<!-- Change the line above to one of: required | unavailable | not-applicable
     Also add the GitHub label live-proof or live-proof-unavailable.
     required: Finding-Id must be set.
       A spec pull request needs docs/live-proof/<id>/before.md with `verdict: confirmed`.
       An implementation pull request also needs after.md in this diff with `verdict: closed`.
     unavailable: spec/spec.md contains `Live proof unavailable: FINDING-ID — reason`. -->

## Review receipt

<!-- The reviewer fills this in before merge. The author leaves the headings.
     Do not mark this pull request approved in this section. -->

**Checked:** <!-- what you opened and compared -->

**Could not check:** <!-- what you did not run or could not see -->

**Residual risk:** <!-- anything you are accepting or leaving for a later change -->
