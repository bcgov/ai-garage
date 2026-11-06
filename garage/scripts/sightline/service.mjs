/** Local-only authenticated API around the trusted, per-run coordinator. */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/config.mjs";
import { jobKey, pendingFromIssue, validatePendingAndRequest } from "./coordinator.mjs";

const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const JOB = /^[0-9a-f]{64}$/;
const INPUT_LIMIT = 65_536;
const BODY_LIMIT = 32_768;
const cli = fileURLToPath(new URL("../sightline.mjs", import.meta.url));

function digest(value) { return createHash("sha256").update(value).digest("hex"); }
function privateWrite(file, value) { writeFileSync(file, value, { mode: 0o600, flag: "wx" }); }
function parseRecord(bytes) {
  if (bytes.length > INPUT_LIMIT) throw new Error("input too large");
  return JSON.parse(bytes.toString("utf8"));
}
function readStored(root, category, reference) {
  if (!REF.test(reference || "")) throw new Error("invalid reference");
  const directory = realpathSync(path.join(root, category));
  if (path.dirname(directory) !== root) throw new Error("invalid record directory");
  const file = realpathSync(path.join(directory, `${reference}.json`));
  if (path.dirname(file) !== directory || !lstatSync(file).isFile()) throw new Error("invalid record");
  const data = readFileSync(file);
  if (data.length > INPUT_LIMIT) throw new Error("input too large");
  return data;
}
function writeState(directory, value) {
  const temporary = path.join(directory, `state-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
  privateWrite(temporary, `${JSON.stringify(value)}\n`);
  renameSync(temporary, path.join(directory, "state.json"));
}
function send(res, code, value) {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(`${JSON.stringify(value)}\n`);
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function authorized(header, token) {
  if (typeof header !== "string" || !header.startsWith("Bearer ") || header.length > 512) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function createWorker(args) {
  const env = { PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" };
  for (const key of ["COPILOT_GITHUB_TOKEN", "COPILOT_MODEL"]) if (process.env[key]) env[key] = process.env[key];
  return spawn(process.execPath, [cli, ...args], { env, stdio: "ignore" });
}

/** The service binds loopback only; its token and filesystem are operator-controlled. */
export function createService({ config, token, startWorker = createWorker }) {
  if (typeof token !== "string" || token.length < 32 || token.length > 256) throw new Error("a service token of 32 to 256 characters is required");
  if (config?.schema !== "garage.sightline.service/v1" || !Number.isInteger(config.max_concurrent) || config.max_concurrent < 1 || config.max_concurrent > 4) throw new Error("invalid service config");
  const imageName = /^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$/;
  const networkName = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
  if (!imageName.test(config.verifier_image || "") || !networkName.test(config.target_network || "") ||
      Boolean(config.copilot_image) !== Boolean(config.copilot_network) ||
      (config.copilot_image && (!imageName.test(config.copilot_image) || !networkName.test(config.copilot_network))) ||
      (config.synthetic_provider === true && !config.copilot_image)) throw new Error("invalid service image or network");
  const serviceRoot = realpathSync(config.service_root);
  const recordsRoot = realpathSync(config.records_dir);
  const outputRoot = realpathSync(config.output_dir);
  const stateRoot = realpathSync(config.state_dir);
  for (const directory of [serviceRoot, recordsRoot, outputRoot, stateRoot]) {
    if (!lstatSync(directory).isDirectory() || /[,\r\n]/.test(directory)) throw new Error("invalid service directory");
  }
  if (typeof process.getuid !== "function" || [recordsRoot, outputRoot, stateRoot].some((directory) => {
    const info = lstatSync(directory);
    return info.uid !== process.getuid() || (info.mode & 0o077) !== 0;
  })) throw new Error("record, output, and state directories must be private and owned by the service user");
  const cfg = loadConfig(serviceRoot);
  if (cfg.sightline?.enabled !== true || cfg.live_proof?.enabled !== true) throw new Error("Sightline and live proof must be enabled");
  const pendingDir = path.join(stateRoot, "pending");
  const queueDir = path.join(stateRoot, "queue");
  mkdirSync(pendingDir, { mode: 0o700, recursive: true });
  mkdirSync(queueDir, { mode: 0o700, recursive: true });
  if (lstatSync(pendingDir).isSymbolicLink() || lstatSync(queueDir).isSymbolicLink()) throw new Error("state directories cannot be symlinks");
  const active = new Set();
  const lockPath = path.join(stateRoot, "service.lock");
  const lockId = randomUUID();
  try { privateWrite(lockPath, lockId); } catch (error) {
    if (error.code === "EEXIST") throw new Error("service state directory is already locked; inspect any interrupted run");
    throw error;
  }
  function releaseLock() {
    if (active.size !== 0) return;
    try { if (readFileSync(lockPath, "utf8") === lockId) unlinkSync(lockPath); } catch { /* retain uncertain locks for operator review */ }
  }
  const providerConfig = digest(JSON.stringify([config.verifier_image, config.target_network, config.copilot_image || "", config.copilot_network || "", config.synthetic_provider === true, config.synthetic_provider === true ? "synthetic-stub" : process.env.COPILOT_MODEL || ""]));

  function current(jobId) {
    const queueFile = path.join(queueDir, jobId, "state.json");
    if (!existsSync(queueFile)) return null;
    const queued = parseRecord(readFileSync(queueFile));
    const resultFile = path.join(outputRoot, jobId, "state.json");
    if (existsSync(resultFile)) {
      const result = parseRecord(readFileSync(resultFile));
      let state = result.state === "running" && !active.has(jobId) ? "interrupted" : result.state;
      const verificationStatus = result.state;
      if (["confirmed", "not_reproduced"].includes(result.state) && result.provider === "copilot-cli" && result.advisory !== "completed") {
        state = result.advisory === "blocked" ? "blocked" : "failed";
      }
      return { job_id: jobId, state, phase: result.phase, provider: result.provider,
        ...(state !== verificationStatus ? { verification_status: verificationStatus } : {}),
        ...(result.run_id ? { run_id: result.run_id } : {}), ...(result.advisory ? { advisory: result.advisory } : {}),
        ...(result.verifier_image_id ? { verifier_image_id: result.verifier_image_id } : {}),
        ...(result.copilot_image_id ? { copilot_image_id: result.copilot_image_id } : {}) };
    }
    return { job_id: jobId, state: active.has(jobId) ? queued.state : queued.state === "queued" ? "interrupted" : queued.state };
  }

  async function handle(req, res) {
    if (!authorized(req.headers.authorization, token)) return send(res, 401, { error: "unauthorized" });
    try {
      if (req.method === "POST" && req.url === "/v1/pending") {
        const pending = pendingFromIssue(cfg, await body(req));
        if (pending.state !== "awaiting_approval") return send(res, 200, { state: pending.state });
        const serialized = `${JSON.stringify(pending)}\n`;
        const reference = `pending-${digest(serialized)}`;
        try { privateWrite(path.join(pendingDir, `${reference}.json`), serialized); } catch (error) { if (error.code !== "EEXIST") throw error; }
        return send(res, 200, { pending_ref: reference, state: pending.state });
      }
      if (req.method === "POST" && req.url === "/v1/runs") {
        const request = await body(req);
        if (!request || typeof request !== "object" || Array.isArray(request) || Object.keys(request).sort().join(",") !== "pending_ref,request_ref") return send(res, 400, { error: "invalid request" });
        const pendingBytes = readStored(stateRoot, "pending", request.pending_ref);
        const requestBytes = readStored(recordsRoot, "requests", request.request_ref);
        const pending = parseRecord(pendingBytes);
        const record = parseRecord(requestBytes);
        validatePendingAndRequest(pending, record);
        const inputs = {
          pending: pendingBytes, request: requestBytes,
          approval: readStored(recordsRoot, "approvals", record.approval_ref),
          target: readStored(recordsRoot, "targets", record.target_ref),
          recipe: readStored(recordsRoot, "recipes", record.recipe_ref),
        };
        const id = jobKey(record);
        const directory = path.join(queueDir, id);
        if (existsSync(directory)) {
          for (const [name, bytes] of Object.entries(inputs)) {
            const previous = path.join(directory, `${name}.json`);
            if (!existsSync(previous) || !readFileSync(previous).equals(bytes)) return send(res, 409, { error: "records changed for existing request" });
          }
          const metadata = parseRecord(readFileSync(path.join(directory, "metadata.json")));
          if (metadata.provider_config !== providerConfig) return send(res, 409, { error: "provider settings changed for existing request" });
          return send(res, 200, { ...current(id), duplicate: true });
        }
        if (active.size >= config.max_concurrent) return send(res, 429, { error: "service busy" });
        try { mkdirSync(directory, { mode: 0o700 }); } catch (error) { if (error.code === "EEXIST") return send(res, 409, { error: "request is being prepared" }); throw error; }
        for (const [name, bytes] of Object.entries(inputs)) privateWrite(path.join(directory, `${name}.json`), bytes);
        privateWrite(path.join(directory, "metadata.json"), JSON.stringify({ provider_config: providerConfig }));
        writeState(directory, { state: "queued" });
        const args = ["run", "--pending", path.join(directory, "pending.json"), "--request", path.join(directory, "request.json"),
          "--approval", path.join(directory, "approval.json"), "--target", path.join(directory, "target.json"), "--recipe", path.join(directory, "recipe.json"),
          "--output-dir", outputRoot, "--image", config.verifier_image, "--network", config.target_network];
        if (config.copilot_image && config.copilot_network) args.push("--copilot-image", config.copilot_image, "--copilot-network", config.copilot_network);
        if (config.synthetic_provider === true) args.push("--synthetic-provider");
        active.add(id);
        try {
          const worker = startWorker(args);
          const finish = (state) => {
            active.delete(id);
            try { writeState(directory, { state }); } catch { /* preserve the private job for investigation */ }
            if (!server.listening) releaseLock();
          };
          worker.once("error", () => finish("failed"));
          worker.once("exit", () => finish(existsSync(path.join(outputRoot, id, "state.json")) ? "finished" : "failed"));
        } catch {
          active.delete(id);
          writeState(directory, { state: "failed" });
          return send(res, 503, { job_id: id, state: "failed" });
        }
        return send(res, 202, { job_id: id, state: "queued" });
      }
      const match = req.method === "GET" && req.url?.match(/^\/v1\/runs\/([0-9a-f]{64})$/);
      if (match && JOB.test(match[1])) {
        const state = current(match[1]);
        return state ? send(res, 200, state) : send(res, 404, { error: "unknown job" });
      }
      return send(res, 404, { error: "unknown endpoint" });
    } catch {
      // Do not reveal issue text, filesystem paths, credentials or child output.
      return send(res, 400, { error: "request could not be processed" });
    }
  }

  const server = http.createServer((req, res) => { void handle(req, res); });
  server.on("close", releaseLock);
  server.on("error", releaseLock);
  return server;
}
