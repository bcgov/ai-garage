# Garage and Sightline integration: decisions and open work

## Agreed direction

Each project has its own Sightline instance. Garage starts a fresh one-shot Docker verifier. Recipes belong under `knowledge/apps/<app>/recipes/`, are selected only after human review, and cannot authorize a run. Sightline returns observations; Garage derives a provisional assessment for human review. A baseline that fails to reproduce the finding cannot establish a fix. Stage 06 stays post-merge.

For future unattended operation, design toward GitHub approval followed by a short-lived signed grant. The approver must be the registered application owner or recorded delegate. Sightline must independently verify issuer, signature, audience, expiry, and scope (repository, PR, both SHAs, recipe digest, target, data and limits). GitHub approval alone and JSON fields do not authenticate a run. The signing issuer, identity mapping, key rotation, replay protection and revocation need design and testing. Until then unattended approval remains disabled; the current pilot is synthetic only.

## Later discussions

- Execution environment: define reproducible baseline and candidate builds, attest the running revision, isolate target and verifier, and identify dependencies and synthetic data.
- Evidence storage: choose location, access control, retention and redaction rules, and decide how the PR links to immutable evidence.
- Ad hoc scripts: decide which scripts can run, who reviews them, and how isolation and limits apply.

## Remaining implementation

- Implement reviewed recipe selection and bind results to an exact recipe digest.
- Implement the combined immutable premerge verification artifact and Sightline event reference; preserve machine-readable individual results.
- Implement conservative Garage comparison and PR summary with explicit limitations.
- Design and implement the signed authorization system before unattended use.
- Verify the complete cross-repository workflow and agree with the maintainer on PR boundaries.
