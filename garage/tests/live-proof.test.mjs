/**
 * Live-proof contract tests. No git, no GitHub.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assignBlockedByLiveProof,
  evaluateLiveProof,
  liveProofForcesPipeline,
} from "../scripts/gate/live-proof.mjs";

const enabled = {
  live_proof: {
    enabled: true,
    label: "live-proof",
    unavailable_label: "live-proof-unavailable",
    evidence_dir: "docs/live-proof",
  },
};

let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

function files(map) {
  return (rel) => (Object.prototype.hasOwnProperty.call(map, rel) ? map[rel] : null);
}

const before = "verdict: confirmed\n\nrequest shown\n";
const after = "verdict: closed\n\ncheck failed\n";

check(
  "disabled config skips the check",
  evaluateLiveProof({
    cfg: {},
    labels: ["live-proof"],
    title: "[RA VULN-001]",
    body: "",
    changedPaths: [],
    touchesImpl: false,
    readFile: files({}),
  }).length === 0,
);

const missingId = evaluateLiveProof({
  cfg: enabled,
  labels: ["live-proof"],
  title: "spec: something",
  body: "",
  changedPaths: ["spec/spec.md"],
  touchesImpl: false,
  readFile: files({}),
});
check("label without a finding id fails", missingId.some((r) => r.status === "fail"));

const specOk = evaluateLiveProof({
  cfg: enabled,
  labels: ["live-proof"],
  title: "[RA VULN-001] spec",
  body: "Finding-Id: VULN-001",
  changedPaths: ["spec/spec.md", "docs/live-proof/VULN-001/before.md"],
  touchesImpl: false,
  readFile: files({ "docs/live-proof/VULN-001/before.md": before }),
});
check(
  "spec pull request with a confirmed before recording passes",
  specOk.length === 1 && specOk[0].status === "pass",
);

const specMissing = evaluateLiveProof({
  cfg: enabled,
  labels: [],
  title: "spec",
  body: "Live-proof: required\nFinding-Id: VULN-001",
  changedPaths: ["spec/spec.md"],
  touchesImpl: false,
  readFile: files({}),
});
check("body line Live-proof: required is enough to demand before.md", specMissing.some((r) => r.status === "fail"));

const implOk = evaluateLiveProof({
  cfg: enabled,
  labels: ["live-proof"],
  title: "fix: VULN-001",
  body: "Finding-Id: VULN-001",
  changedPaths: ["src/query.ts", "docs/live-proof/VULN-001/after.md"],
  touchesImpl: true,
  readFile: files({
    "docs/live-proof/VULN-001/before.md": before,
    "docs/live-proof/VULN-001/after.md": after,
  }),
});
check(
  "implementation pull request with after.md in the diff passes",
  implOk.some((r) => r.status === "pass") && !implOk.some((r) => r.status === "fail"),
);

const implStale = evaluateLiveProof({
  cfg: enabled,
  labels: ["live-proof"],
  title: "fix: VULN-001",
  body: "Finding-Id: VULN-001",
  changedPaths: ["src/query.ts"],
  touchesImpl: true,
  readFile: files({
    "docs/live-proof/VULN-001/before.md": before,
    "docs/live-proof/VULN-001/after.md": after,
  }),
});
check("after.md already on the branch but not in this diff fails", implStale.some((r) => r.status === "fail"));

const unavailable = evaluateLiveProof({
  cfg: enabled,
  labels: ["live-proof-unavailable"],
  title: "spec",
  body: "Finding-Id: VULN-004",
  changedPaths: ["spec/spec.md"],
  touchesImpl: false,
  readFile: files({
    "spec/spec.md": "Live proof unavailable: VULN-004 — the database cannot be started locally.\n",
  }),
});
check("unavailable with a named reason passes", unavailable.some((r) => r.status === "pass"));

const unavailableThin = evaluateLiveProof({
  cfg: enabled,
  labels: ["live-proof-unavailable"],
  title: "spec",
  body: "Finding-Id: VULN-004",
  changedPaths: ["spec/spec.md"],
  touchesImpl: false,
  readFile: files({ "spec/spec.md": "Live proof unavailable: no\n" }),
});
check("unavailable without the finding id in the reason fails", unavailableThin.some((r) => r.status === "fail"));

check(
  "both labels fail",
  evaluateLiveProof({
    cfg: enabled,
    labels: ["live-proof", "live-proof-unavailable"],
    title: "[RA VULN-001]",
    body: "",
    changedPaths: [],
    touchesImpl: false,
    readFile: files({}),
  }).some((r) => r.status === "fail"),
);

check(
  "live-proof label forces pipeline when enabled",
  liveProofForcesPipeline(["src/a.ts"], ["live-proof"], enabled) === true,
);

check(
  "live-proof label does not force pipeline when disabled",
  liveProofForcesPipeline(["src/a.ts"], ["live-proof"], {}) === false,
);

check(
  "assign waits until before.md is on the base branch",
  assignBlockedByLiveProof({
    labels: ["ready-for-agent", "live-proof"],
    title: "[RA VULN-001]",
    body: "",
    beforeBodies: {},
    cfg: enabled,
  }).block === true,
);

check(
  "assign proceeds when the before verdict is confirmed",
  assignBlockedByLiveProof({
    labels: ["live-proof"],
    title: "Finding-Id: VULN-001",
    body: "",
    beforeBodies: { "VULN-001": before },
    cfg: enabled,
  }).block === false,
);

check(
  "assign ignores live proof when the feature is off",
  assignBlockedByLiveProof({
    labels: ["live-proof"],
    title: "[RA VULN-001]",
    body: "",
    beforeBodies: {},
    cfg: {},
  }).block === false,
);

// Wire-up: the checkpoint script must fail a labelled spec PR that has no recording.
const fixture = mkdtempSync(path.join(tmpdir(), "live-proof-"));
mkdirSync(path.join(fixture, "spec", "features"), { recursive: true });
writeFileSync(
  path.join(fixture, "constitution.md"),
  ["### P1", "### P2", "### P3", "### P4", "### P5", "### P6", "### P7", "### P8"].join("\n"),
);
writeFileSync(
  path.join(fixture, "spec", "spec.md"),
  "## Problem\n\n## Outcome\n\n## Scope\n",
);
writeFileSync(path.join(fixture, "spec", "plan.md"), "# Plan\n");
writeFileSync(
  path.join(fixture, "spec", "features", "vuln.feature"),
  "@R-1.1\nScenario: shown\n  Given a bug\n  When checked\n  Then it fails\n",
);
writeFileSync(
  path.join(fixture, "garage.config.json"),
  JSON.stringify({ version: 1, project: "fx", profile: "delivery", ...enabled }),
);
writeFileSync(path.join(fixture, "CODEOWNERS"), "/.github/ @platform\n");
writeFileSync(path.join(fixture, "REVIEW.md"), "## Review receipt\n");
writeFileSync(path.join(fixture, "spec", "tasks.md"), "# Tasks\n");

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "../scripts/gate.mjs");
const run = spawnSync(
  process.execPath,
  [script, "--root", fixture, "--changed-paths", "spec/spec.md", "--no-comment"],
  {
    env: {
      ...process.env,
      PR_TITLE: "[RA VULN-001] spec",
      PR_BODY: "Finding-Id: VULN-001",
      PR_LABELS: "live-proof",
    },
    encoding: "utf8",
  },
);
check(
  "gate fails when live proof is on and before.md is missing",
  run.status === 1 && String(run.stdout).includes("live_proof"),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
