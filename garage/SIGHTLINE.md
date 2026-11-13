# Sightline integration: synthetic local pilot

This opt-in integration connects Garage's existing live-proof process to a
separate Sightline verification container. It is an experimental **local
synthetic-lab pilot**, not a production service or a replacement for human
review. Ordinary Garage issues and standalone Sightline use remain available.

The pilot verifier uses a bounded deterministic recipe. An optional separate
Copilot CLI container can explain sanitized results; its output is advisory and
does not execute the test or produce proof. This is not the full interactive
Sightline workflow. The real hosted Copilot credential and provider path have
not yet been validated.

## What happens

1. With both `live_proof.enabled` and `sightline.enabled` true, an open issue
   marked `live-proof` or `Live-proof: required` and containing exactly one
   `Finding-Id: VULN-001` produces an `awaiting_approval` intake record. The
   issue body supplies neither an endpoint nor a command. The Actions intake
   job writes a state summary. When the local service is explicitly configured,
   the job can also send the issue to that service to create a pending record.
   It is a snapshot: before running, the operator must recheck that the issue
   is still open and the request is still wanted. The local coordinator does
   not re-fetch issue state or cancel a run when a label is removed.
2. A trusted operator obtains a **separate**, authenticated approval for the
   exact phase, revision, lab, identity, routes, recipe and limits; and places
   the records in the service's controlled registry. A local client or the
   manual Garage workflow can submit references to those records. An issue
   label is never approval.
3. The coordinator snapshots the four input records privately and starts a
   non-root Sightline container on a dedicated Docker internal network. It
   passes no GitHub token or Docker socket to that container. Sightline runs a
   benign control and one approved synthetic probe, then persists a sanitized
   result. Repeated identical requests return the original state; a request
   with the same references but different input records is rejected. The
   coordinator resolves image tags and networks to their local IDs before
   launch and records the image IDs; those IDs do not certify an image's trust.
4. If Copilot is configured, a second non-root container on a **different**
   network receives only phase, run ID, status and control/probe outcomes.
   It stores a private advisory; it has no target, approval, or issue records
   and cannot change the verifier result. If this requested step fails, the
   coordinator returns a nonzero status and the service reports a blocked or
   failed run while retaining the separate verification result for inspection.
5. An authorized human reviews the protected result, approval, actual build,
   independence and disclosure policy. The local `export` command creates a
   draft `before.md` or `after.md`; the human decides whether and how to put
   it into the service repository. The command does not publish or merge it.
6. Garage's existing live-proof checks still apply. When Sightline is enabled,
   an additional check requires the reviewed proof's tested Git commit to be
   an ancestor of the current base (baseline) or PR head (candidate), with
   only that proof file changed since testing. Baseline and candidate drafts
   must also name the same recipe and recipe digest. Any other later change
   requires a new verification. The gate reruns on PR label and body changes.

The Git check is deliberately conservative and structural. It does **not**
authenticate an approval, reviewer or result, or prove the target actually
ran the recorded build. A label, passing gate, SHA, or `--human-reviewed` flag
is not a substitute for an independent reviewer and protected branch rules.

For isolated rehearsals only, `sightline.allow_simulated_proof: true` permits
records labeled `review-status: simulated` to be checked for structural
freshness. They produce a warning, never a human-review pass. The default is
false: simulated records fail freshness. Never enable this setting as a
substitute for authenticated approval or review in a real delivery workflow.
An operator can create a simulated draft with `sightline.mjs export-simulation`
and the required `--simulation-only` flag; this does not assert a human reviewer.

## Run the complete local test

From the AI Garage checkout, on a Linux/WSL host with Git, Node 22+, Python 3,
Bash and a running Docker daemon:

```sh
bash garage/tests/sightline-docker-e2e.sh /path/to/sightline-agent
```

The test creates a disposable service repository and synthetic issue; submits
them through the loopback API; runs a baseline and candidate using distinct containers; runs the real pinned Copilot
CLI against an isolated fake model without credentials; creates local proof drafts;
checks duplicate suppression, a pending approval, network and privilege
rejection, and Git freshness; and
removes its temporary containers, network, image tags and files. Base-image and
build-cache layers may remain. The lab's owner, reviewer and approvals are fabricated
test values, and its recorded revision is not deployment attestation.

The Sightline checkout's `verification/README.md` explains the container,
request, result, and narrower standalone demo.

### Browser checks

The local coordinator also supports an explicitly selected `browser` profile.
Build Sightline's `containers/verification/Dockerfile.verifier-browser` and supply that image with
`--profile browser` to `sightline.mjs run`, or set `verifier_profile` to
`browser` in the trusted local service configuration. The default remains
`http`. Selection is an operator setting, never an issue-supplied command.
The browser profile uses more memory, a larger temporary area and the bundled
Playwright seccomp profile so that Chromium's own sandbox can run. The
coordinator records a digest of that profile and rejects a duplicate job if
its launch profile changes. The browser image and syscall profile require
security review before deployment. The local Docker network and browser
routing are not sufficient network isolation for a shared service.

```sh
bash garage/tests/sightline-browser-docker-e2e.sh /path/to/sightline-agent
```

This covers synthetic before/after checks and duplicate suppression through
the Garage coordinator. Sightline also provides a repeatable historical
restitution frontend example with stubbed local services. These tests do not
authenticate approvals or reviewers, attest the running build, or publish
proof; those remain separate responsibilities.

## Operator interface

Set the following in an enrolled service's `garage.config.json` only for the
approved pilot:

```json
{
  "live_proof": { "enabled": true },
  "sightline": { "enabled": true }
}
```

### Local service

The optional service is a **loopback-only pilot**, not a production API. It
accepts a bearer token from `GARAGE_SIGHTLINE_TOKEN`, binds to `127.0.0.1`,
and starts the existing coordinator in a child process. The operator owns the
private registry, output and state directories. They must be owned by the
non-root service user with mode `0700`; create `requests`, `approvals`,
`targets`, and `recipes` subdirectories in the registry. The service does not
authenticate the contents of those files or verify the identity of the person
who placed them there.

Create a private service configuration with concrete local paths and reviewed
image/network names:

```json
{
  "schema": "garage.sightline.service/v1",
  "port": 8787,
  "service_root": "/secure/service-checkout",
  "records_dir": "/secure/registry",
  "output_dir": "/secure/results",
  "state_dir": "/secure/state",
  "verifier_image": "sightline-verifier:reviewed",
  "target_network": "approved-synthetic-lab",
  "copilot_image": "sightline-copilot:reviewed",
  "copilot_network": "separate-provider-network",
  "synthetic_provider": false,
  "max_concurrent": 1
}
```

Omit both Copilot fields for a model-free run. The target network must be an
existing Docker internal network; the optional provider network must be a
different network with independently enforced egress restrictions. The
`synthetic_provider` switch is for the fake-model test only. Build the two
images from the Sightline checkout with `docker build -f containers/verification/Dockerfile.verifier`
and `docker build -f containers/verification/Dockerfile.copilot`, assigning the reviewed tags used in
the configuration.

Provide a strong, unique service token of 32–256 characters through a secure
environment, and start the service on the same Linux host as Docker:

```sh
node .github/garage/sightline-service.mjs --config /secure/service.json
```

Set `GARAGE_SIGHTLINE_PORT` to the configured port in the client environment.
The client uses only loopback and reads the same service token from its
environment. To create a pending record and later submit an already-approved
request:

```sh
node .github/garage/sightline-client.mjs pending --event /secure/issue-event.json
node .github/garage/sightline-client.mjs run --pending-ref <pending-ref> --request-ref <request-ref>
node .github/garage/sightline-client.mjs status --job-id <job-id>
```

The request reference resolves to `requests/<request-ref>.json`. Its
`approval_ref`, `target_ref`, and `recipe_ref` resolve to files of the same
name under `approvals/`, `targets/`, and `recipes/`; issue text cannot supply
those records or arbitrary file paths. A run returns a job ID immediately and
the status endpoint reports queued, running, confirmed, not reproduced,
blocked, inconclusive, failed, or interrupted. The separate verifier run ID
appears after a result exists. Private result and advisory files stay on the
service host. Duplicate submissions use the same job and do not repeat a test;
changed records for an existing request are rejected.

For GitHub Actions, configure `GARAGE_SIGHTLINE_RUNNER` to a dedicated trusted
runner on the service host, `GARAGE_SIGHTLINE_PORT` to its loopback port, and
the `GARAGE_SIGHTLINE_TOKEN` repository/environment secret. Intake then
creates pending records; the manual **Garage / Sightline run** workflow submits
an existing pending reference and separately prepared request reference. The
workflow checks out the protected default branch, receives no test target from
the issue, and does not publish evidence. Leave these settings unset to keep
the service integration off. Use a dedicated runner with an appropriate trust
and cleanup model; a self-hosted runner is not automatically isolated.

The service stores local queue state but has no durable distributed scheduler,
revocation or cancellation mechanism. A state-directory lock prevents a second
service instance from starting; an abrupt stop can leave that lock and an
`interrupted` job. Inspect protected state and confirm no worker is running
before an operator clears a stale lock or obtains any required fresh approval
to retry. The service token authenticates the caller, not the approval or
reviewer. Keep the token, service configuration and private records out of
issue bodies, logs, and public repositories.

### Direct local coordinator

To recreate a pending record locally from a GitHub issue event saved as JSON:

```sh
node .github/garage/sightline.mjs prepare --root . --event /secure/issue-event.json \
  --output /secure/pending.json
```

After independent approval, the trusted operator supplies the separate files,
an already-built verifier image, an existing dedicated **internal** Docker
network, and an existing private output directory:

```sh
node .github/garage/sightline.mjs run --pending /secure/pending.json \
  --request /secure/request.json --approval /secure/approval.json \
  --target /secure/target.json --recipe /secure/recipe.json \
  --output-dir /secure/runs --image sightline-verifier:reviewed \
  --network approved-synthetic-lab
```

To request a Copilot advisory, also supply `--copilot-image <reviewed-image>`
and `--copilot-network <separate-provider-network>`. Set an approved,
short-lived `COPILOT_GITHUB_TOKEN` in the trusted coordinator's environment;
the token is passed only to the Copilot container, not the verifier or target.
The Docker daemon and its administrators can inspect a running container's
environment. Configure and verify restricted provider egress, host access and
credential handling before a real hosted run. The local test instead uses the
explicit `--synthetic-provider` switch and a fixed fake model on an internal
network; never use that switch for real verification.

The resulting advisory is stored separately under
`/secure/runs/<job-id>/advisory/advisory.json`; treat it as private, untrusted
model output. It is not proof and is not automatically published. This pilot
does not include an advisory-only retry; investigate an interrupted job before
arranging a fresh approved run.

On a successful baseline or candidate, inspect the protected result under
`/secure/runs/<job-id>/runs/<run-id>/result.json`. An operator who has actually
reviewed it can make a local draft, passing the *full tested commit ID*:

```sh
node .github/garage/sightline.mjs export --pending /secure/pending.json \
  --result /secure/runs/<job-id>/runs/<run-id>/result.json \
  --reviewer reviewer-id --revision <tested-commit-id> \
  --output /secure/before.md --human-reviewed
```

Use a distinct approved candidate request and `after.md` output for the fix.
The baseline must have a passed control and `confirmed` result; the candidate
must have a passed control and `not_reproduced` result. An unavailable target,
failed control, timeout, missing approval, stale revision, or malformed record
cannot produce a successful draft. A candidate verifier reference must differ
from the implementer reference; the coordinator cannot authenticate either.

Inputs and results may contain sensitive target or finding information. The
output directory and approval source must be private and access-controlled;
decide retention and what may be committed before adopting the process. Do not
put a real finding into a public repo merely because the draft contains no raw
traffic. The local coordinator's job directory retains snapshots of its input
records for review. A crash can leave an interrupted job; inspect it and arrange
a fresh approval rather than deleting state to force an automatic rerun.

The pilot does not provide an authenticated approval service, deployed-build
attestation, a durable scheduler, a production-ready API, production isolation, automatic
issue comments, a full tool-using agent, or autonomous proof publication. Do not connect it to a real
environment until those controls and the Sightline workflow changes are
reviewed and approved by the responsible owners.
