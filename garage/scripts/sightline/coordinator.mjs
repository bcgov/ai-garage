/** Local, opt-in Sightline coordinator. The operator is the trust boundary. */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { effectiveLabels, extractFindingIds, liveProofConfig } from "../gate/live-proof.mjs";

const PENDING = "garage.sightline.pending/v1";
const RESULT = "sightline.verification.result/v1";
const MAX_INPUT = 65_536;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function readJson(file) {
  const bytes = readFileSync(file);
  if (bytes.length > MAX_INPUT) throw new Error("input exceeds size limit");
  return JSON.parse(bytes.toString("utf8"));
}

export function pendingFromIssue(cfg, event) {
  if (cfg?.sightline?.enabled !== true) return { state: "disabled" };
  if (cfg?.live_proof?.enabled !== true) throw new Error("live proof must be enabled with Sightline");
  const issue = event?.issue;
  const repository = event?.repository?.full_name;
  if (!issue || issue.state !== "open" || !Number.isSafeInteger(issue.number) || issue.number < 1 ||
      typeof repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    throw new Error("invalid issue event");
  }
  const lp = liveProofConfig(cfg);
  const labels = (Array.isArray(issue.labels) ? issue.labels : []).map((label) => typeof label === "string" ? label : label?.name).filter(Boolean);
  const all = effectiveLabels(labels, issue.body, lp).map((label) => String(label).toLowerCase());
  const required = all.includes(lp.label.toLowerCase());
  const unavailable = all.includes(lp.unavailable_label.toLowerCase());
  if (required && unavailable) throw new Error("conflicting live-proof choices");
  if (!required) return { state: "not_requested" };
  const ids = extractFindingIds(`${issue.title || ""}\n${issue.body || ""}`);
  if (ids.length !== 1) throw new Error("exactly one finding ID is required");
  return { schema: PENDING, state: "awaiting_approval", repository, issue: issue.number, finding_id: ids[0] };
}

export function validatePendingAndRequest(pending, request) {
  if (pending?.schema !== PENDING || pending.state !== "awaiting_approval" ||
      request?.schema !== "sightline.verification.request/v1" ||
      pending.repository !== request.subject?.repository || pending.issue !== request.subject?.issue ||
      pending.finding_id !== request.subject?.finding_id || !REVISION.test(request.subject?.revision || "") ||
      !["baseline", "candidate"].includes(request.phase)) {
    throw new Error("request does not match the pending issue");
  }
  for (const key of ["target_ref", "recipe_ref", "approval_ref", "verifier_ref"]) {
    if (!IDENTIFIER.test(request[key] || "")) throw new Error("invalid request reference");
  }
  if (request.phase === "candidate" && (!IDENTIFIER.test(request.implementer_ref || "") || request.implementer_ref === request.verifier_ref)) {
    throw new Error("candidate needs a separate verifier");
  }
}

export function jobKey(request) {
  const subject = request.subject;
  return hash(JSON.stringify([subject.repository, subject.issue, subject.finding_id, subject.revision, request.phase,
    request.target_ref, request.recipe_ref, request.approval_ref, request.verifier_ref, request.implementer_ref]));
}

function sourceFile(file) {
  const resolved = realpathSync(file);
  if (!lstatSync(resolved).isFile()) throw new Error("input must be a file");
  const bytes = readFileSync(resolved);
  if (bytes.length > MAX_INPUT) throw new Error("input exceeds size limit");
  return bytes;
}

function privateWrite(file, contents) {
  writeFileSync(file, contents, { mode: 0o600, flag: "wx" });
}

function updateState(jobDirectory, state) {
  const temporary = path.join(jobDirectory, `state-${randomUUID()}.tmp`);
  privateWrite(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, path.join(jobDirectory, "state.json"));
}

function docker(args, options = {}) {
  return spawnSync("docker", args, { encoding: "utf8", timeout: 330_000, maxBuffer: 65_536, ...options });
}

function localImageId(image) {
  const inspected = docker(["image", "inspect", "--format", "{{.Id}}", image]);
  const id = (inspected.stdout || "").trim();
  if (inspected.status !== 0 || !/^sha256:[0-9a-f]{64}$/.test(id)) throw new Error("reviewed local image unavailable");
  return id;
}

function localNetworkId(network) {
  const inspected = docker(["network", "inspect", "--format", "{{.Id}}", network]);
  const id = (inspected.stdout || "").trim();
  if (inspected.status !== 0 || !/^[0-9a-f]{64}$/.test(id)) throw new Error("approved local network unavailable");
  return id;
}

function runAdvisory(jobDirectory, result, image, network, syntheticProvider) {
  if (!["confirmed", "not_reproduced", "inconclusive"].includes(result.status)) return "not_run";
  const directory = path.join(jobDirectory, "advisory");
  const input = path.join(jobDirectory, "advisory-input");
  mkdirSync(directory, { mode: 0o700 });
  mkdirSync(input, { mode: 0o700 });
  const checks = result.checks.map((check) => {
    const clean = { kind: check.kind, outcome: check.outcome };
    if (Object.hasOwn(check, "http_status")) clean.http_status = check.http_status;
    return clean;
  });
  const facts = { schema: "sightline.verification.facts/v1", run_id: result.run_id, phase: result.phase, status: result.status, checks };
  privateWrite(path.join(input, "facts.json"), `${JSON.stringify(facts)}\n`);
  const containerName = `garage-sightline-agent-${randomUUID()}`;
  const args = ["run", "--rm", "--name", containerName, "--pull=never", "--network", network,
    "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128",
    "--memory", "1g", "--cpus", "1", "--user", `${process.getuid()}:${process.getgid()}`,
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--mount", `type=bind,src=${input},dst=/input,readonly`,
    "--mount", `type=bind,src=${directory},dst=/output`];
  if (syntheticProvider) args.push("--env", "SIGHTLINE_SYNTHETIC_PROVIDER=1", "--env", "COPILOT_MODEL=synthetic-stub");
  else {
    if (process.env.COPILOT_GITHUB_TOKEN) args.push("--env", "COPILOT_GITHUB_TOKEN");
    if (process.env.COPILOT_MODEL) args.push("--env", "COPILOT_MODEL");
  }
  args.push(image, "--facts", "/input/facts.json", "--output-dir", "/output");
  try {
    const run = docker(args);
    const summary = JSON.parse((run.stdout || "").trim().split("\n").at(-1));
    const advisory = readJson(path.join(directory, "advisory.json"));
    if (advisory.schema !== "sightline.verification.advisory/v1" || advisory.provider !== "copilot-cli" || advisory.status !== summary.status) return "failed";
    if (advisory.status === "blocked" && run.status === 3) return "blocked";
    if (advisory.status !== "completed" || advisory.run_id !== result.run_id || run.status !== 0 || typeof advisory.text !== "string" || !advisory.text) return "failed";
    return "completed";
  } catch {
    return "failed";
  } finally {
    docker(["rm", "-f", containerName], { stdio: "ignore", timeout: 15_000 });
  }
}

export function validateResult(pending, request, approval, result) {
  if (result?.schema !== RESULT || !UUID.test(result.run_id || "") ||
      !["blocked", "inconclusive", "confirmed", "not_reproduced"].includes(result.status)) throw new Error("invalid verifier result");
  if (result.status === "blocked") return;
  validatePendingAndRequest(pending, { ...request, subject: result.subject, phase: result.phase });
  if (result.phase !== request.phase || result.subject.revision !== request.subject.revision) throw new Error("result phase or revision differs from request");
  for (const key of ["request_id", "target_ref", "recipe_ref", "approval_ref", "verifier_ref", "implementer_ref"]) {
    if (result[key] !== request[key]) throw new Error("result does not match request");
  }
  if (result.target_sha256 !== approval?.scope?.target_sha256 || result.recipe_sha256 !== approval?.scope?.recipe_sha256) {
    throw new Error("result does not match approved contents");
  }
  if (result.status === "confirmed" || result.status === "not_reproduced") {
    const expected = result.status === "confirmed" ? "observed" : "not_observed";
    if (!Array.isArray(result.checks) || result.checks.length !== 2 || result.checks[0]?.kind !== "control" ||
        result.checks[0]?.outcome !== "passed" || result.checks[1]?.kind !== "probe" || result.checks[1]?.outcome !== expected) {
      throw new Error("result lacks the required control or probe");
    }
  }
}

/** Run exactly once for a given approved issue/phase/revision/recipe tuple. */
export function runJob({ pending, requestFile, approvalFile, targetFile, recipeFile, outputDir, image, network, copilotImage, copilotNetwork, syntheticProvider = false, profile = "http" }) {
  if (!["http", "browser"].includes(profile)) throw new Error("unsupported verifier profile");
  if (typeof process.getuid !== "function" || process.getuid() === 0 || process.getgid() === 0) throw new Error("a non-root POSIX coordinator is required");
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(network || "") ||
      !/^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$/.test(image || "")) throw new Error("invalid trusted image or network");
  if (Boolean(copilotImage) !== Boolean(copilotNetwork) || (syntheticProvider && !copilotImage)) throw new Error("Copilot image and network must be supplied together");
  if (copilotImage && (!/^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$/.test(copilotImage) || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(copilotNetwork))) throw new Error("invalid Copilot image or network");
  const root = realpathSync(outputDir);
  if (!lstatSync(root).isDirectory() || /[,\r\n]/.test(root)) throw new Error("invalid output directory");
  const sources = Object.fromEntries(Object.entries({ request: requestFile, approval: approvalFile, target: targetFile, recipe: recipeFile }).map(([name, file]) => [name, sourceFile(file)]));
  const request = JSON.parse(sources.request.toString("utf8"));
  validatePendingAndRequest(pending, request);
  const inspected = docker(["network", "inspect", "--format", "{{json .Internal}}", network]);
  if (inspected.status !== 0 || inspected.stdout.trim() !== "true") throw new Error("an existing internal Docker network is required");
  const targetId = localNetworkId(network);
  const verifierImageId = localImageId(image);
  const seccomp = fileURLToPath(new URL("./browser-seccomp.json", import.meta.url));
  const launchProfile = profile === "browser" ? hash(readFileSync(seccomp)) : "http-v1";
  let providerNetworkId = null;
  let copilotImageId = null;
  if (copilotImage) {
    providerNetworkId = localNetworkId(copilotNetwork);
    copilotImageId = localImageId(copilotImage);
    if (targetId === providerNetworkId) throw new Error("Copilot requires a separate provider network");
    if (syntheticProvider) {
      const providerNetwork = docker(["network", "inspect", "--format", "{{json .Internal}}", copilotNetwork]);
      if (providerNetwork.status !== 0 || providerNetwork.stdout.trim() !== "true") throw new Error("synthetic Copilot requires an internal network");
    }
  }
  const providerConfig = copilotImage ? hash(JSON.stringify([copilotImageId, providerNetworkId, syntheticProvider, syntheticProvider ? "synthetic-stub" : process.env.COPILOT_MODEL || ""])) : null;
  const jobId = jobKey(request);
  const jobDirectory = path.join(root, jobId);
  try {
    mkdirSync(jobDirectory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    // A reference is not permission to silently substitute different records.
    for (const [name, bytes] of Object.entries(sources)) {
      const previous = path.join(jobDirectory, "input", `${name}.json`);
      if (!existsSync(previous) || !readFileSync(previous).equals(bytes)) throw new Error("duplicate request has different records; a new approval is required");
    }
    const stateFile = path.join(jobDirectory, "state.json");
    const existing = existsSync(stateFile) ? readJson(stateFile) : { job_id: jobId, state: "interrupted" };
    if (existing.verifier_image_id !== verifierImageId || (existing.launch_profile || "http-v1") !== launchProfile || (existing.provider || "none") !== (copilotImage ? "copilot-cli" : "none") || (existing.provider_config_sha256 || null) !== providerConfig) throw new Error("duplicate request has different provider or launch settings");
    return { ...existing, duplicate: true };
  }
  const runs = path.join(jobDirectory, "runs");
  const input = path.join(jobDirectory, "input");
  mkdirSync(runs, { mode: 0o700 });
  mkdirSync(input, { mode: 0o700 });
  for (const [name, bytes] of Object.entries(sources)) privateWrite(path.join(input, `${name}.json`), bytes);
  const state = { schema: "garage.sightline.job/v1", job_id: jobId, state: "running", phase: request.phase, provider: copilotImage ? "copilot-cli" : "none", verifier_image_id: verifierImageId };
  state.launch_profile = launchProfile;
  if (providerConfig) state.provider_config_sha256 = providerConfig;
  if (copilotImageId) state.copilot_image_id = copilotImageId;
  updateState(jobDirectory, state);
  const containerName = `garage-sightline-${randomUUID()}`;
  const browserArgs = profile === "browser" ? ["--security-opt", `seccomp=${seccomp}`, "--pids-limit", "256", "--memory", "1g", "--cpus", "2", "--shm-size", "256m", "--tmpfs", "/tmp:rw,nosuid,size=256m"] :
    ["--pids-limit", "64", "--memory", "128m", "--cpus", "1", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m"];
  const args = ["run", "--rm", "--name", containerName, "--pull=never", "--network", targetId,
    "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", ...browserArgs,
    "--user", `${process.getuid()}:${process.getgid()}`,
    "--mount", `type=bind,src=${input},dst=/input,readonly`,
    "--mount", `type=bind,src=${runs},dst=/output`, verifierImageId, "verify", "--request", "/input/request.json",
    "--approval", "/input/approval.json", "--target", "/input/target.json", "--recipe", "/input/recipe.json", "--output-dir", "/output"];
  let result;
  try {
    const run = docker(args);
    const summary = JSON.parse((run.stdout || "").trim().split("\n").at(-1));
    if (!UUID.test(summary.run_id || "")) throw new Error("invalid run identifier");
    result = readJson(path.join(runs, summary.run_id, "result.json"));
    if (result.schema !== RESULT || result.run_id !== summary.run_id || result.status !== summary.status) throw new Error("invalid result");
    validateResult(pending, request, result.status === "blocked" ? null : JSON.parse(sources.approval.toString("utf8")), result);
    const expectedExit = result.status === "blocked" ? 3 : result.status === "inconclusive" ? 2 : ["confirmed", "not_reproduced"].includes(result.status) ? 0 : -1;
    if (run.status !== expectedExit) throw new Error("inconsistent verifier exit");
    state.state = result.status;
    state.run_id = result.run_id;
    if (copilotImage) state.advisory = runAdvisory(jobDirectory, result, copilotImageId, providerNetworkId, syntheticProvider);
  } catch {
    state.state = "failed";
  } finally {
    docker(["rm", "-f", containerName], { stdio: "ignore", timeout: 15_000 });
  }
  updateState(jobDirectory, state);
  return state;
}

/** Convert a reviewed result into the existing Garage proof format, locally. */
export function reviewedEvidence({ pending, result, reviewer, revision }) {
  if (pending?.schema !== PENDING || pending.state !== "awaiting_approval" ||
      !IDENTIFIER.test(reviewer || "") || !REVISION.test(revision || "") || result?.schema !== RESULT ||
      result.subject?.repository !== pending?.repository || result.subject?.issue !== pending?.issue ||
      result.subject?.finding_id !== pending?.finding_id || result.subject?.revision !== revision || !UUID.test(result.run_id || "")) {
    throw new Error("result does not match reviewed issue and revision");
  }
  for (const key of ["request_id", "target_ref", "recipe_ref", "approval_ref", "verifier_ref"]) {
    if (!IDENTIFIER.test(result[key] || "")) throw new Error("result lacks execution references");
  }
  if (!/^[0-9a-f]{64}$/.test(result.target_sha256 || "") || !/^[0-9a-f]{64}$/.test(result.recipe_sha256 || "") ||
      (result.phase === "candidate" && (!IDENTIFIER.test(result.implementer_ref || "") || result.implementer_ref === result.verifier_ref))) {
    throw new Error("result lacks approved record digests or independent verifier");
  }
  const checks = result.checks;
  if (!Array.isArray(checks) || checks.length !== 2 || checks[0]?.kind !== "control" || checks[0]?.outcome !== "passed" || checks[1]?.kind !== "probe") {
    throw new Error("result lacks a passing control and probe");
  }
  const before = result.phase === "baseline" && result.status === "confirmed" && checks[1].outcome === "observed";
  const after = result.phase === "candidate" && result.status === "not_reproduced" && checks[1].outcome === "not_observed";
  if (!before && !after) throw new Error("result cannot support a proof verdict");
  return `verdict: ${before ? "confirmed" : "closed"}\nfinding-id: ${pending.finding_id}\nphase: ${result.phase}\ntested-revision: ${revision}\nrecipe-ref: ${result.recipe_ref}\nrecipe-sha256: ${result.recipe_sha256}\nrun-id: ${result.run_id}\nreviewed-by: ${reviewer}\n\nA reviewer must confirm the protected result, authorization, target identity, and disclosure policy.\n`;
}

/** Create a simulation-only draft with no claim that a human reviewed it. */
export function simulatedEvidence({ pending, result, revision }) {
  const draft = reviewedEvidence({ pending, result, reviewer: "simulation-placeholder", revision });
  return draft.replace("reviewed-by: simulation-placeholder", "review-status: simulated") +
    "\nSIMULATION ONLY: no human review or actual approval is asserted. Do not use for real delivery.\n";
}
