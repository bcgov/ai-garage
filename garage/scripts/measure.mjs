#!/usr/bin/env node
/** Garage / Measure — weekly: criteria index, metrics, docs drift, rolling review issue. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./lib/config.mjs";
import { resolveAgentMode, skipIfGhAw } from "./lib/agent-mode.mjs";
import { writeCriteriaIndex } from "./measure/criteria-index.mjs";
import { collectMetrics } from "./measure/metrics.mjs";
import { runDocsDrift } from "./measure/docs-drift.mjs";
import { renderReviewIssue, upsertReviewIssue } from "./measure/review-issue.mjs";

const rootIndex = process.argv.indexOf("--root");
const root = path.resolve(
  rootIndex === -1 ? process.env.GITHUB_WORKSPACE || "." : process.argv[rootIndex + 1],
);
const dry = process.argv.includes("--dry-run");
const cfg = loadConfig(root);

if (cfg.measure.enabled === false) {
  console.log("measure disabled");
  process.exit(0);
}

let report = { generatedAt: new Date().toISOString() };
if (cfg.measure.metrics.enabled) {
  writeCriteriaIndex(root);
  report = collectMetrics(root, cfg);
  const out = path.join(root, cfg.measure.metrics.artifact_path);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}

let drift = { drifted: [], reportPath: null };
if (
  cfg.measure.docs_drift.enabled &&
  !skipIfGhAw(resolveAgentMode(cfg), "docs drift")
) {
  drift = await runDocsDrift(root, cfg);
}

const issue = renderReviewIssue(report, drift);
if (dry || !(process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) {
  console.log(`\n${issue.title}\n\n${issue.body}`);
} else if (cfg.measure.review_issue.enabled) {
  const result = upsertReviewIssue(cfg, issue);
  console.log(`Review issue #${result.number} ${result.action}`);
}
