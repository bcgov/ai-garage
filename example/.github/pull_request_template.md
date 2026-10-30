## What changed

<!-- A few sentences in plain technical language.
     Say what is different, and why.
     Name the screen, endpoint, or file a reviewer would recognize.
     If this fixes a finding, name it (for example VULN-001). -->

## How to review this

<!-- Ordered steps for the person reviewing. Be specific.
     1. Which spec or feature to read, and what "done" means there.
     2. Which files to open, and what to compare.
     3. What command to run, and what a correct result looks like.
     4. If live proof applies: open the before recording, then the after recording.
        The first shows the bug. The second shows that same check failing. -->

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
