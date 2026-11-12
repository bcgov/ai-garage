import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateSightlineFreshness } from "../scripts/sightline/freshness.mjs";

const root = mkdtempSync(path.join(os.tmpdir(), "sightline-freshness-"));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (file, body) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), body); };
const proof = (phase, revision, verdict, digest = "a".repeat(64)) => `verdict: ${verdict}\nfinding-id: VULN-001\nphase: ${phase}\ntested-revision: ${revision}\nrecipe-ref: recipe-1\nrecipe-sha256: ${digest}\nrun-id: 00000000-0000-4000-8000-000000000001\nreviewed-by: reviewer-1\n`;
try {
  git("init");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "user.name", "Synthetic Test");
  put("src/app.txt", "baseline\n");
  git("add", ".");
  git("commit", "-m", "synthetic baseline");
  const baseline = git("rev-parse", "HEAD");
  put("docs/live-proof/VULN-001/before.md", proof("baseline", baseline, "confirmed"));
  git("add", ".");
  git("commit", "-m", "reviewed baseline proof");
  const baseSha = git("rev-parse", "HEAD");
  put("src/app.txt", "candidate\n");
  git("add", ".");
  git("commit", "-m", "synthetic candidate");
  const candidate = git("rev-parse", "HEAD");
  put("docs/live-proof/VULN-001/after.md", proof("candidate", candidate, "closed"));
  git("add", ".");
  git("commit", "-m", "reviewed candidate proof");
  const headSha = git("rev-parse", "HEAD");
  const args = {
    cfg: { sightline: { enabled: true }, live_proof: { enabled: true } }, root,
    labels: ["live-proof"], title: "", body: "Finding-Id: VULN-001", touchesImpl: true,
    baseSha, headSha, readFile: (file) => readFileSync(path.join(root, file), "utf8"),
  };
  assert.deepEqual(evaluateSightlineFreshness(args).map((item) => item.status), ["pass", "pass"]);
  const simulate = (text) => text.replace(/reviewed-by: reviewer-1/, "review-status: simulated");
  put("docs/live-proof/VULN-001/before.md", simulate(proof("baseline", baseline, "confirmed")));
  put("docs/live-proof/VULN-001/after.md", simulate(proof("candidate", candidate, "closed")));
  assert.deepEqual(evaluateSightlineFreshness(args).map((item) => item.status), ["fail", "fail"]);
  assert.deepEqual(evaluateSightlineFreshness({ ...args, cfg: { sightline: { enabled: true, allow_simulated_proof: true }, live_proof: { enabled: true } } }).map((item) => item.status), ["warn", "warn"]);
  put("docs/live-proof/VULN-001/before.md", proof("baseline", baseline, "confirmed"));
  put("docs/live-proof/VULN-001/after.md", proof("candidate", candidate, "closed", "b".repeat(64)));
  assert.ok(evaluateSightlineFreshness(args).some((item) => item.status === "fail"));
  put("docs/live-proof/VULN-001/after.md", proof("candidate", candidate, "closed"));
  assert.ok(evaluateSightlineFreshness({ ...args, headSha: "" }).some((item) => item.status === "fail"));
  put("src/app.txt", "changed after test\n");
  git("add", ".");
  git("commit", "-m", "change after proof");
  assert.ok(evaluateSightlineFreshness({ ...args, headSha: git("rev-parse", "HEAD") }).some((item) => item.status === "fail"));
  assert.deepEqual(evaluateSightlineFreshness({ ...args, cfg: { live_proof: { enabled: true } } }), []);
  console.log("PASS Sightline proof freshness against real Git commits");
} finally {
  rmSync(root, { recursive: true, force: true });
}
