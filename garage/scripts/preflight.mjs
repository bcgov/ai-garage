#!/usr/bin/env node
/** Garage / Preflight — config, scaffold, workflows. Profile-aware. */
import { existsSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./lib/config.mjs";
import { Results } from "./lib/report.mjs";
import { findConstitution } from "./gate/checkpoints.mjs";

const i = process.argv.indexOf("--root");
const root = path.resolve(i === -1 ? process.env.GITHUB_WORKSPACE || "." : process.argv[i + 1]);
const r = new Results();

let cfg;
try {
  cfg = loadConfig(root);
  r.ok("config", `garage.config.json (profile: ${cfg.profile})`);
} catch (e) {
  r.fail("config", e.message);
  r.toConsole("Garage preflight");
  process.exit(1);
}

const workflows = ["garage-preflight.yml", "garage-intake.yml", "garage-measure.yml", "garage-ci-diagnose.yml"];
if (cfg.gate.enabled) workflows.push("garage-gate.yml");
for (const w of workflows) {
  if (existsSync(path.join(root, ".github/workflows", w))) r.ok("workflow", w);
  else r.fail("workflow", `missing .github/workflows/${w}`);
}
for (const s of ["gate.mjs", "intake.mjs", "measure.mjs", "ci-diagnose.mjs", "lib/config.mjs"]) {
  if (existsSync(path.join(root, ".github/garage", s))) r.ok("script", s);
  else r.fail("script", `missing .github/garage/${s}`);
}

if (!existsSync(path.join(root, "AGENTS.md"))) r.fail("agents", "AGENTS.md missing");
else r.ok("agents", "AGENTS.md");

if (cfg.gate.enabled) {
  if (findConstitution(root)) r.ok("constitution", "present");
  else r.fail("constitution", "constitution.md missing");
  for (const f of ["spec/spec.md", "spec/plan.md", "spec/tasks.md", "REVIEW.md"]) {
    if (existsSync(path.join(root, f))) r.ok("scaffold", f);
    else r.fail("scaffold", `missing ${f}`);
  }
  if (existsSync(path.join(root, "spec/features"))) r.ok("scaffold", "spec/features/");
  else r.fail("scaffold", "missing spec/features/");
  if (cfg.intake.coding_agent.auto_assign) {
    r.ok("coding_agent", "auto_assign on — needs secret COPILOT_ASSIGN_TOKEN at runtime");
  }
}

if (
  existsSync(path.join(root, ".github/workflows/garage-review.md")) &&
  !existsSync(path.join(root, ".github/workflows/garage-review.lock.yml"))
) {
  r.warn("gh-aw", "garage-review.md present but no .lock.yml — run gh aw compile");
}
for (const legacy of ["tier1.config.json", "tier2-v3.config.json", "tier2-v2.config.json", "tier2.config.json"]) {
  if (existsSync(path.join(root, legacy))) {
    r.warn("legacy", `${legacy} still present — run node .github/garage/migrate-config.mjs --apply`);
  }
}

r.toConsole("Garage preflight");
r.writeStepSummary("Garage preflight");
process.exit(r.exitCode());
