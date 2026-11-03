/**
 * Spec-aware PR review — heuristic findings + optional LLM narrative + redaction guard.
 * Pure module: does not call gh or post comments (gate.mjs does).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Results } from "../lib/report.mjs";
import { anyMatch, normalize } from "../lib/paths.mjs";
import { chatCompletion } from "../lib/llm.mjs";
import { resolveAgentMode } from "../lib/agent-mode.mjs";
import { listFeatures } from "./checkpoints.mjs";

const DEFAULT_REDACTION = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /\b(?:password|secret|api[_-]?key)\s*[:=]\s*\S+/i,
  /\bghp_[a-zA-Z0-9]{20,}\b/,
];

export function redactionHits(text, cfg) {
  const extra = (cfg.gate?.review?.redaction_deny_patterns || []).map(
    (pattern) => new RegExp(pattern, "i"),
  );
  return [...DEFAULT_REDACTION, ...extra]
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source.slice(0, 60));
}

export async function runReview(ctx) {
  const { root, cfg } = ctx;
  const files = (ctx.files || []).map(normalize);
  const results = new Results();
  const review = cfg.gate.review;
  if (review.enabled === false) return { results, narrative: "" };

  const touchesImpl = anyMatch(files, cfg.paths.impl);
  const touchesSpec = files.some((file) => file.startsWith("spec/") || file.includes("constitution"));
  const body = `${ctx.prTitle || ""}\n${ctx.prBody || ""}`;
  if (!touchesImpl) return { results, narrative: "" };

  if (!existsSync(path.join(root, "spec/spec.md"))) {
    results.fail("no_spec", "Implementation PR but spec/spec.md missing");
  }
  if (!/spec\/|features\/|#\d+|TASK-/i.test(body) && !touchesSpec) {
    results.warn("no_spec_trace", "PR body should link a spec section, feature file, or task id");
  }

  const evidencePath = normalize(cfg.paths.evidence);
  if (
    review.require_evidence &&
    !files.includes(evidencePath) &&
    !existsSync(path.join(root, evidencePath))
  ) {
    results.warn(
      "no_evidence",
      `Missing ${evidencePath} — generate with node .github/garage/evidence.mjs --finding ID --append`,
    );
  }
  if (existsSync(path.join(root, "spec/features")) && listFeatures(root).length === 0) {
    results.fail("no_features", "No spec/features/*.feature files");
  }
  if (review.require_receipt !== false) {
    const hasSection = /##\s*review receipt/i.test(body);
    const hasChecked = /\*\*checked\*\*|^checked:/im.test(body);
    const hasCouldNot = /\*\*could not check\*\*|could not check|couldn't check/i.test(body);
    if (!hasSection || !hasChecked || !hasCouldNot) {
      results.warn(
        "no_review_receipt",
        "Implementation PR should include a review receipt (Checked / Could not check / Residual risk) per REVIEW.md",
      );
    }
  }

  let narrative = "";
  if (resolveAgentMode(cfg) === "llm") {
    try {
      const policyPath = path.join(root, "REVIEW.md");
      const system = existsSync(policyPath)
        ? readFileSync(policyPath, "utf8")
        : "You review PRs against a BC Gov agentic SDLC. Comment briefly whether the change appears traced to spec/features and constitution constraints (WCAG, design system, PIA, OpenShift). Max 200 words.";
      const user = `PR title: ${ctx.prTitle || ""}\nBody:\n${ctx.prBody || ""}\nFiles:\n${files.join(
        "\n",
      )}\nFindings so far: ${JSON.stringify(results.items)}`;
      narrative = (await chatCompletion(cfg, system, user)) || "";
    } catch (error) {
      console.warn("LLM review skipped:", error.message);
    }
  }

  return { results, narrative };
}
