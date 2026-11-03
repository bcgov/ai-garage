import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { check, eq, throws, done } from "./helper.mjs";
import { loadConfig, applyProfile, DEFAULTS } from "../scripts/lib/config.mjs";

function tmpWith(json) {
  const dir = mkdtempSync(path.join(tmpdir(), "sdlc-cfg-"));
  writeFileSync(path.join(dir, "garage.config.json"), JSON.stringify(json));
  return dir;
}

check("loadConfig throws when missing", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sdlc-cfg-"));
  throws(() => loadConfig(dir), /Missing .*garage\.config\.json/);
  rmSync(dir, { recursive: true, force: true });
});

check("loadConfig rejects wrong version", () => {
  const dir = tmpWith({ version: 2, project: "x" });
  throws(() => loadConfig(dir), /version/);
  rmSync(dir, { recursive: true, force: true });
});

check("loadConfig deep-merges DEFAULTS", () => {
  const dir = tmpWith({ version: 1, project: "x", gate: { strict_placeholders: true } });
  const cfg = loadConfig(dir);
  eq(cfg.gate.strict_placeholders, true, "override");
  eq(cfg.gate.require_spec, DEFAULTS.gate.require_spec, "default kept");
  eq(cfg.paths.impl, DEFAULTS.paths.impl, "paths default");
  rmSync(dir, { recursive: true, force: true });
});

check("applyProfile intake disables gate + coding agent + metrics", () => {
  const cfg = applyProfile({ ...structuredClone(DEFAULTS), profile: "intake" });
  eq(cfg.gate.enabled, false, "gate");
  eq(cfg.intake.coding_agent.auto_assign, false, "assign");
  eq(cfg.measure.metrics.enabled, false, "metrics");
  eq(cfg.measure.docs_drift.enabled, true, "docs drift stays");
});

check("applyProfile delivery leaves config as-is", () => {
  const cfg = applyProfile({ ...structuredClone(DEFAULTS), profile: "delivery" });
  eq(cfg.gate.enabled, true, "gate");
  eq(cfg.intake.coding_agent.auto_assign, true, "assign");
});

check("applyProfile rejects unknown profile", () => {
  throws(() => applyProfile({ ...structuredClone(DEFAULTS), profile: "tier2" }), /profile/);
});

done();
