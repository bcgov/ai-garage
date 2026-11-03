/**
 * Structural harness checks not covered by checkpoints.mjs.
 * (Constitution P1–P8 and @R-xx.y presence are checked in checkpoints.mjs.)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Results } from "../lib/report.mjs";

export function runStructural(ctx) {
  const { root } = ctx;
  const r = new Results();

  const reviewPath = path.join(root, "REVIEW.md");
  if (!existsSync(reviewPath)) {
    r.fail("review_policy", "REVIEW.md missing — copy from pack bundle");
  } else {
    const body = readFileSync(reviewPath, "utf8");
    if (!/##\s*Review receipt/i.test(body)) {
      r.fail("review_receipt_section", "REVIEW.md missing ## Review receipt section");
    } else if (!/checked/i.test(body) || !/could not check/i.test(body)) {
      r.fail("review_receipt_fields", "REVIEW.md receipt must mention Checked and Could not check");
    } else {
      r.ok("review_policy", "REVIEW.md has review receipt section and fields");
    }
  }

  const agentsPath = path.join(root, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    r.fail("agents_present", "AGENTS.md missing");
  } else {
    const body = readFileSync(agentsPath, "utf8");
    const forbidsMerge = /must not self-merge|never self-merge|do not merge|no agent self-merge|human.*merge|checkpoint 3/i.test(body);
    if (!forbidsMerge) r.fail("agents_no_self_merge", "AGENTS.md should forbid agent self-merge / require human merge");
    else r.ok("agents_no_self_merge", "AGENTS.md forbids self-merge / requires human ship");
  }

  const indexPath = path.join(root, "spec/criteria-index.json");
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, "utf8"));
      if (!Array.isArray(idx.criteria)) r.fail("criteria_index", "criteria-index.json missing criteria array");
      else r.ok("criteria_index", `criteria-index.json: ${idx.criteria.length} criteria`);
    } catch (e) {
      r.fail("criteria_index", `criteria-index.json parse error: ${e.message}`);
    }
  }

  return r;
}
