import assert from "node:assert/strict";
import { pendingFromIssue, reviewedEvidence, simulatedEvidence, validateResult } from "../scripts/sightline/coordinator.mjs";

const config = { sightline: { enabled: true }, live_proof: { enabled: true } };
const event = {
  repository: { full_name: "example/synthetic-lab" },
  issue: { number: 1, state: "open", title: "Synthetic finding", body: "Finding-Id: VULN-001\nLive-proof: required", labels: [] },
};
const pending = pendingFromIssue(config, event);
assert.equal(pending.state, "awaiting_approval");
assert.equal(pending.finding_id, "VULN-001");
assert.equal(pending.repository, "example/synthetic-lab");
assert.equal(pendingFromIssue({}, event).state, "disabled");
assert.equal(pendingFromIssue(config, { ...event, issue: { ...event.issue, body: "Ordinary issue" } }).state, "not_requested");
assert.throws(() => pendingFromIssue({ sightline: { enabled: true } }, event));
assert.throws(() => pendingFromIssue(config, { ...event, issue: { ...event.issue, state: "closed" } }));
assert.throws(() => pendingFromIssue(config, { ...event, issue: { ...event.issue, body: "Live-proof: required" } }));
assert.throws(() => pendingFromIssue(config, { ...event, issue: { ...event.issue, body: "Live-proof: required\nFinding-Id: VULN-001\nFinding-Id: VULN-002" } }));
assert.throws(() => pendingFromIssue(config, { ...event, issue: { ...event.issue, labels: [{ name: "live-proof-unavailable" }] } }));
const untrusted = pendingFromIssue(config, { ...event, issue: { ...event.issue, body: `${event.issue.body}\nTarget: https://example.invalid\nCommand: dangerous` } });
assert.deepEqual(untrusted, pending); // Issue text cannot supply a target or command.

const subject = { repository: pending.repository, issue: pending.issue, finding_id: pending.finding_id, revision: "a".repeat(40) };
const baseline = {
  schema: "sightline.verification.result/v1", run_id: "00000000-0000-4000-8000-000000000001",
  subject, phase: "baseline", status: "confirmed",
  request_id: "request-1", target_ref: "lab-1", recipe_ref: "recipe-1", approval_ref: "approval-1",
  verifier_ref: "verifier-1", implementer_ref: null, target_sha256: "a".repeat(64), recipe_sha256: "b".repeat(64),
  checks: [{ kind: "control", outcome: "passed" }, { kind: "probe", outcome: "observed" }],
};
const proof = (result, revision = subject.revision) => reviewedEvidence({ pending, result, reviewer: "reviewer-1", revision });
assert.match(proof(baseline), /^verdict: confirmed\n/);
const simulation = simulatedEvidence({ pending, result: baseline, revision: subject.revision });
assert.match(simulation, /review-status: simulated/);
assert.doesNotMatch(simulation, /reviewed-by:/);
assert.throws(() => simulatedEvidence({ pending, result: { ...baseline, status: "inconclusive" }, revision: subject.revision }));
const candidate = { ...baseline, phase: "candidate", implementer_ref: "implementer-1", status: "not_reproduced", checks: [{ kind: "control", outcome: "passed" }, { kind: "probe", outcome: "not_observed" }] };
assert.match(proof(candidate), /^verdict: closed\n/);
assert.throws(() => proof(candidate, "b".repeat(40))); // Wrong tested revision is stale.
assert.throws(() => proof({ ...candidate, checks: [{ kind: "control", outcome: "failed" }, candidate.checks[1]] }));
assert.throws(() => proof({ ...candidate, status: "inconclusive" }));
assert.throws(() => proof({ ...candidate, subject: { ...subject, issue: 2 } }));
assert.throws(() => proof({ ...candidate, implementer_ref: candidate.verifier_ref }));
assert.throws(() => proof({ ...candidate, recipe_sha256: "" }));
assert.throws(() => reviewedEvidence({ pending, result: candidate, revision: subject.revision }));
const request = { schema: "sightline.verification.request/v1", request_id: baseline.request_id, subject,
  phase: "baseline", target_ref: baseline.target_ref, recipe_ref: baseline.recipe_ref,
  approval_ref: baseline.approval_ref, verifier_ref: baseline.verifier_ref, implementer_ref: null };
const approval = { scope: { target_sha256: baseline.target_sha256, recipe_sha256: baseline.recipe_sha256 } };
assert.doesNotThrow(() => validateResult(pending, request, approval, baseline));
assert.throws(() => validateResult(pending, request, approval, { ...baseline, phase: "candidate" }));
assert.throws(() => validateResult(pending, request, approval, { ...baseline, subject: { ...subject, revision: "b".repeat(40) } }));
assert.throws(() => validateResult(pending, request, approval, { ...baseline, target_sha256: "b".repeat(64) }));
assert.throws(() => validateResult(pending, request, approval, { ...baseline, checks: [{ kind: "control", outcome: "failed" }] }));
console.log("PASS Sightline intake and reviewed evidence checks");
