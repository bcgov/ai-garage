import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createService } from "../scripts/sightline/service.mjs";

if (typeof process.getuid !== "function") {
  console.log("SKIP Sightline loopback service requires POSIX filesystem permissions");
} else {
  const root = mkdtempSync(path.join(os.tmpdir(), "sightline-service-"));
  const token = "synthetic-test-token-0123456789-abcdef";
  const dirs = Object.fromEntries(["service", "records", "output", "state"].map((name) => [name, path.join(root, name)]));
  for (const dir of Object.values(dirs)) mkdirSync(dir, { mode: 0o700 });
  for (const name of ["requests", "approvals", "targets", "recipes"]) mkdirSync(path.join(dirs.records, name), { mode: 0o700 });
  writeFileSync(path.join(dirs.service, "garage.config.json"), JSON.stringify({ version: 1, profile: "delivery", sightline: { enabled: true }, live_proof: { enabled: true } }));
  const config = { schema: "garage.sightline.service/v1", service_root: dirs.service, records_dir: dirs.records,
    output_dir: dirs.output, state_dir: dirs.state, verifier_image: "verifier:test", target_network: "isolated-lab", max_concurrent: 1 };
  let starts = 0;
  let worker;
  let workerArgs;
  const server = createService({ config, token, startWorker: (args) => { starts++; workerArgs = args; worker = new EventEmitter(); return worker; } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, value, authorized = true) => {
    const response = await fetch(`${base}${url}`, { method: value === undefined ? "GET" : "POST", headers: {
      ...(authorized ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json",
    }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    return [response.status, await response.json()];
  };
  try {
    const event = { repository: { full_name: "example/lab" }, issue: { number: 1, state: "open", title: "test", body: "Live-proof: required\nFinding-Id: VULN-001\nSECRET-DO-NOT-ECHO", labels: [] } };
    assert.equal((await request("/v1/pending", event, false))[0], 401);
    const [pendingCode, pending] = await request("/v1/pending", event);
    assert.equal(pendingCode, 200);
    assert.equal(pending.state, "awaiting_approval");
    assert.ok(!JSON.stringify(pending).includes("SECRET-DO-NOT-ECHO"));
    const record = { schema: "sightline.verification.request/v1", request_id: "request-1", subject: {
      repository: "example/lab", issue: 1, finding_id: "VULN-001", revision: "a".repeat(40),
    }, phase: "baseline", target_ref: "lab-1", recipe_ref: "recipe-1", approval_ref: "approval-1", verifier_ref: "verifier-1", implementer_ref: null };
    for (const [category, ref, value] of [["requests", "request-1", record], ["approvals", "approval-1", {}], ["targets", "lab-1", {}], ["recipes", "recipe-1", {}]]) {
      writeFileSync(path.join(dirs.records, category, `${ref}.json`), JSON.stringify(value));
    }
    const submission = { pending_ref: pending.pending_ref, request_ref: "request-1" };
    assert.equal((await request("/v1/runs", { ...submission, command: "do something" }))[0], 400);
    assert.equal((await request("/v1/runs", { ...submission, request_ref: "../outside" }))[0], 400);
    const [code, queued] = await request("/v1/runs", submission);
    assert.equal(code, 202);
    assert.equal(queued.state, "queued");
    assert.equal(starts, 1);
    assert.ok(workerArgs.includes("--approval"));
    assert.ok(!workerArgs.some((arg) => String(arg).includes("SECRET-DO-NOT-ECHO")));
    assert.equal((await request(`/v1/runs/${queued.job_id}`))[1].state, "queued");
    const duplicate = await request("/v1/runs", submission);
    assert.equal(duplicate[0], 200);
    assert.equal(duplicate[1].duplicate, true);
    assert.equal(starts, 1);
    const runDir = path.join(dirs.output, queued.job_id);
    mkdirSync(runDir, { mode: 0o700 });
    writeFileSync(path.join(runDir, "state.json"), JSON.stringify({ state: "confirmed", provider: "copilot-cli", advisory: "blocked" }));
    const unavailable = (await request(`/v1/runs/${queued.job_id}`))[1];
    assert.equal(unavailable.state, "blocked");
    assert.equal(unavailable.verification_status, "confirmed");
    unlinkSync(path.join(runDir, "state.json"));
    const another = { ...record, request_id: "request-2", subject: { ...record.subject, revision: "b".repeat(40) } };
    writeFileSync(path.join(dirs.records, "requests/request-2.json"), JSON.stringify(another));
    assert.equal((await request("/v1/runs", { ...submission, request_ref: "request-2" }))[0], 429);
    assert.throws(() => createService({ config, token }), /already locked/);
    writeFileSync(path.join(dirs.records, "targets/lab-1.json"), '{"changed":true}');
    assert.equal((await request("/v1/runs", submission))[0], 409);
    worker.emit("exit", 1);
    assert.equal((await request(`/v1/runs/${queued.job_id}`))[1].state, "failed");
    console.log("PASS authenticated Sightline service intake, queue, and duplicate handling");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
}
