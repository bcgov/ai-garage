#!/usr/bin/env node
/**
 * Migrate tier1.config.json + tier2-v3.config.json → garage.config.json.
 *   node migrate-config.mjs --root .          # print result + legacy file list
 *   node migrate-config.mjs --root . --apply  # write garage.config.json, delete legacy files/dirs
 */
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEGACY_WORKFLOWS = [
  "tier1-preflight.yml", "tier1-triage.yml", "tier1-docs-drift.yml", "tier1-ci-diagnose.yml", "tier1-demo-fail.yml",
  "tier1-triage.md", "tier1-triage.lock.yml", "tier1-docs-drift.md", "tier1-docs-drift.lock.yml", "tier1-ci-diagnose.md", "tier1-ci-diagnose.lock.yml",
  "tier2-v3-preflight.yml", "tier2-v3-checkpoint-gate.yml", "tier2-v3-spec-review.yml", "tier2-v3-assign-coding-agent.yml",
  "tier2-v3-harness-evals.yml", "tier2-v3-maintain.yml", "tier2-v3-metrics.yml", "tier2-v3-promote-intent.yml",
  "tier2-v3-spec-review.md", "tier2-v3-spec-review.lock.yml",
];

function pick(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function migrateConfig({ tier1, tier2 }) {
  const t1 = tier1 || {};
  const t2 = tier2 || {};
  const config = {
    version: 1,
    project: t2.project || t1.project || "my-service",
    profile: tier2 ? "delivery" : "intake",
  };

  const paths = {};
  if (pick(t2, "checkpoints", "impl_path_prefixes")) paths.impl = t2.checkpoints.impl_path_prefixes;
  if (pick(t2, "provenance", "test_path_prefixes")) paths.tests = t2.provenance.test_path_prefixes;
  if (pick(t1, "docs_drift", "doc_paths")) paths.docs = t1.docs_drift.doc_paths;
  if (pick(t2, "spec_review", "evidence_path")) paths.evidence = t2.spec_review.evidence_path;
  if (Object.keys(paths).length) config.paths = paths;

  const llmSrc = pick(t2, "agent", "llm") || pick(t1, "agent", "llm");
  const mode = pick(t2, "spec_review", "mode") || pick(t2, "agent", "mode") || pick(t1, "agent", "mode");
  if (llmSrc || mode) {
    config.llm = {};
    if (mode) config.llm.mode = mode;
    for (const k of ["api_style", "base_url", "api_version", "model", "temperature"]) {
      if (llmSrc?.[k] !== undefined) config.llm[k] = llmSrc[k];
    }
    config.llm.api_key_env = "GARAGE_LLM_API_KEY";
  }

  const intake = {};
  if (t1.triage) {
    const { promote_intent, intent_ready_label, ...triage } = t1.triage;
    intake.triage = triage;
  }
  if (t2.coding_agent) {
    const ca = t2.coding_agent;
    intake.coding_agent = {};
    if (ca.auto_assign !== undefined) intake.coding_agent.auto_assign = ca.auto_assign;
    if (ca.assign_label) intake.coding_agent.label = ca.assign_label;
    if (ca.base_branch) intake.coding_agent.base_branch = ca.base_branch;
    if (ca.custom_instructions) intake.coding_agent.custom_instructions = ca.custom_instructions;
  }
  if (Object.keys(intake).length) config.intake = intake;

  if (tier2) {
    const cp = t2.checkpoints || {};
    const sr = t2.spec_review || {};
    config.gate = {};
    for (const [from, to] of [["require_constitution", "require_constitution"], ["require_spec", "require_spec"], ["require_features", "require_features"], ["require_plan_on_impl_paths", "require_plan_on_impl"], ["strict_placeholders", "strict_placeholders"], ["require_impl_paths_on_evidence_prs", "evidence_requires_impl"]]) {
      if (cp[from] !== undefined) config.gate[to] = cp[from];
    }
    const review = {};
    if (sr.enabled !== undefined) review.enabled = sr.enabled;
    if (sr.require_evidence !== undefined) review.require_evidence = sr.require_evidence;
    if (sr.require_receipt !== undefined) review.require_receipt = sr.require_receipt;
    if (sr.redaction_deny_patterns) review.redaction_deny_patterns = sr.redaction_deny_patterns;
    if (Object.keys(review).length) config.gate.review = review;
    const dm = pick(t2, "triage", "direct_mode");
    if (dm) config.gate.risk_triage = { enabled: false, ...dm };
    if (t2.live_proof) config.live_proof = t2.live_proof;
  }

  const measure = {};
  if (t2.metrics) {
    measure.metrics = {};
    if (t2.metrics.enabled !== undefined) measure.metrics.enabled = t2.metrics.enabled;
    if (t2.metrics.gate_taxonomy_exclude) measure.metrics.gate_taxonomy_exclude = t2.metrics.gate_taxonomy_exclude;
    if (pick(t2, "metrics", "traceability", "stall_days") !== undefined) measure.metrics.stall_days = t2.metrics.traceability.stall_days;
  }
  if (t1.docs_drift) {
    measure.docs_drift = {};
    if (t1.docs_drift.enabled !== undefined) measure.docs_drift.enabled = t1.docs_drift.enabled;
    if (t1.docs_drift.open_pull_request !== undefined) measure.docs_drift.open_pull_request = t1.docs_drift.open_pull_request;
    measure.docs_drift.report_path = "docs/garage-docs-drift-report.md";
  }
  if (Object.keys(measure).length) config.measure = measure;

  if (t1.ci_diagnose) {
    const { ignore_workflows, ...rest } = t1.ci_diagnose;
    config.ci_diagnose = rest;
  }

  const legacyFiles = [];
  if (tier1) legacyFiles.push("tier1.config.json", ".github/tier1");
  if (tier2) legacyFiles.push("tier2-v3.config.json", ".github/tier2-v3", "maintain", "intent/.template.md", "docs/tier2-v3-metrics.json", "docs/triage-audit.jsonl");
  legacyFiles.push(...LEGACY_WORKFLOWS.map((w) => `.github/workflows/${w}`));
  return { config, legacyFiles };
}

function readJson(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf("--root");
  const root = path.resolve(i === -1 ? "." : process.argv[i + 1]);
  const apply = process.argv.includes("--apply");
  const tier1 = readJson(path.join(root, "tier1.config.json"));
  const tier2 = readJson(path.join(root, "tier2-v3.config.json"));
  if (!tier1 && !tier2) {
    console.log("No legacy config found — nothing to migrate.");
    process.exit(0);
  }
  const { config, legacyFiles } = migrateConfig({ tier1, tier2 });
  const present = legacyFiles.filter((f) => existsSync(path.join(root, f)));
  if (apply) {
    writeFileSync(path.join(root, "garage.config.json"), JSON.stringify(config, null, 2) + "\n");
    for (const f of present) rmSync(path.join(root, f), { recursive: true, force: true });
    console.log(`Wrote garage.config.json; removed ${present.length} legacy path(s):\n  ${present.join("\n  ")}`);
  } else {
    console.log(JSON.stringify(config, null, 2));
    console.log(`\nLegacy paths present (${present.length}) — re-run with --apply to write config and remove them:\n  ${present.join("\n  ")}`);
  }
}
