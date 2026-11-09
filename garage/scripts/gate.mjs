#!/usr/bin/env node
/**
 * Garage / Gate — one PR check: checkpoints + structural + provenance + review (+ optional risk triage).
 * One comment (upserted by marker), one step summary, one exit code.
 *
 *   node gate.mjs --root . --changed-paths src/a.ts,docs/b.md --pr 12 --pr-title "…" --pr-body "…"
 *   node gate.mjs --root . --changed-paths src/a.ts --no-comment        # local dry run
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig } from "./lib/config.mjs";
import { anyMatch, normalize } from "./lib/paths.mjs";
import { Results } from "./lib/report.mjs";
import { gh } from "./lib/gh.mjs";
import { resolveAgentMode } from "./lib/agent-mode.mjs";
import { runCheckpoints } from "./gate/checkpoints.mjs";
import { runStructural } from "./gate/structural.mjs";
import { runProvenance } from "./gate/provenance.mjs";
import { runReview, redactionHits, reviewWalkthrough } from "./gate/review.mjs";
import { evaluateLiveProof, liveProofForcesPipeline, parseLabelList } from "./gate/live-proof.mjs";
import { triageChange } from "./gate/risk-triage.mjs";
import { evaluateSightlineFreshness } from "./sightline/freshness.mjs";

const MARKER = "<!-- garage-gate -->";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const root = path.resolve(arg("root", process.env.GITHUB_WORKSPACE || "."));
const cfg = loadConfig(root);
const pr = arg("pr", process.env.PR_NUMBER);
const prTitle = arg("pr-title", process.env.PR_TITLE || "");
const prBody = arg("pr-body", process.env.PR_BODY || "");
const noComment = has("no-comment");
const asJson = has("json");

function changedPathsFromArgsOrGit() {
  const raw = arg("changed-paths", process.env.CHANGED_PATHS || "");
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  const base = process.env.BASE_SHA || arg("base-ref", "");
  if (!base) return [];
  try {
    return execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

if (cfg.gate.enabled === false) {
  console.log(`Garage gate disabled (profile: ${cfg.profile}) — nothing to check.`);
  process.exit(0);
}

const changedPaths = changedPathsFromArgsOrGit();
let triageMode = "pipeline";
let triageReasons = [];
if (cfg.gate.risk_triage.enabled) {
  const triage = triageChange({
    root,
    cfg,
    paths: changedPaths,
    baseRef: process.env.BASE_SHA || "",
  });
  triageMode = triage.mode;
  triageReasons = triage.reasons || [];
}
const prLabels = parseLabelList(process.env.PR_LABELS || "");
if (liveProofForcesPipeline(changedPaths, prLabels, cfg, prBody)) {
  triageMode = "pipeline";
  triageReasons.push("live proof label or recording — full pipeline required");
}

const ctx = {
  root,
  cfg,
  changedPaths,
  triageMode,
  prTitle,
  prBody,
  files: changedPaths,
};
const all = new Results();
all.merge(runCheckpoints(ctx));
all.merge(runStructural(ctx));
all.merge(runProvenance(ctx));
const { results: reviewResults, narrative } = await runReview(ctx);
all.merge(reviewResults);

const normPaths = changedPaths.map(normalize);
const touchesImpl = anyMatch(normPaths, cfg.paths.impl);
const touchesSpec = normPaths.some((file) => file.startsWith("spec/") || file.includes("constitution"));
const live = new Results();
for (const item of evaluateLiveProof({
  cfg,
  labels: prLabels,
  title: prTitle,
  body: prBody,
  changedPaths,
  touchesImpl,
  readFile(rel) {
    const file = path.join(root, rel);
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  },
})) {
  if (item.status === "fail") live.fail(item.id, item.message);
  else live.ok(item.id, item.message);
}
all.merge(live);

const freshness = new Results();
for (const item of evaluateSightlineFreshness({
  cfg, root, labels: prLabels, title: prTitle, body: prBody, touchesImpl,
  baseSha: process.env.BASE_SHA || arg("base-ref", ""),
  headSha: process.env.PR_HEAD_SHA || arg("head-ref", ""),
  readFile(rel) {
    const file = path.join(root, rel);
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  },
})) {
  if (item.status === "fail") freshness.fail(item.id, item.message);
  else freshness.ok(item.id, item.message);
}
all.merge(freshness);

const whereToLook = touchesImpl
  ? "This pull request changes application code. Read the description's How to review this section, then open the files it names and compare them to the spec."
  : touchesSpec
    ? "This pull request changes the spec or the plan. Read What changed, then check that the spec says what will be built, in language a reviewer can test."
    : "This pull request does not change application code. Read What changed and confirm the notes match the files in the diff.";
const checkSummary =
  all.status() === "PASS"
    ? "Automated checks found nothing that blocks a person from reviewing."
    : all.status() === "WARN"
      ? "Automated checks found gaps. They do not replace the review below."
      : "Automated checks failed. Fix those before spending time on the rest of the review.";

const title = `Garage gate${triageMode === "direct" ? " · direct mode" : ""}`;
const sections = [
  MARKER,
  "### How to review this pull request",
  "",
  whereToLook,
  "",
  checkSummary,
  "",
  all.toMarkdown(title),
];
if (triageReasons.length) {
  sections.push(`_Risk triage → **${triageMode}**: ${triageReasons.join("; ")}_\n`);
}
if (touchesImpl) {
  const walkthrough = reviewWalkthrough(prBody);
  sections.push(walkthrough
    ? `## Change and verification walkthrough\n\n_The following is supplied by the PR author; the gate has not verified these claims._\n\n${walkthrough}\n`
    : "## Change and verification walkthrough\n\nThe PR description does not yet provide a walkthrough. The author should describe the original behavior, the change, the checks and their actual outcomes, and what remains unverified.\n");
}
if (narrative) sections.push(`## Agent notes\n\n${narrative}\n`);
sections.push(
  "A person still has to merge this. The review receipt at the bottom of the description is where that person records what they checked.",
);
let comment = sections.join("\n");

const hits = redactionHits(comment, cfg);
if (hits.length) {
  console.error("Redaction guard: comment withheld — matched", hits);
  comment = `${MARKER}\n### Garage gate · \`${all.status()}\`\n\nPublic comment withheld by redaction guard (${hits.length} match). See workflow step summary.\n`;
}

if (asJson) {
  console.log(JSON.stringify({ status: all.status(), triageMode, items: all.items }, null, 2));
} else {
  all.toConsole(title);
}
all.writeStepSummary(title);

if (!noComment && pr && (process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) {
  if (resolveAgentMode(cfg) === "gh-aw" && cfg.gate.review.enabled) {
    console.log(
      "llm.mode is gh-aw — compiled garage-review.lock.yml owns the narrative; posting checks only.",
    );
  }
  try {
    const existing = JSON.parse(
      gh(["api", `repos/{owner}/{repo}/issues/${pr}/comments`, "--paginate"], {
        ignoreError: true,
      }) || "[]",
    ).find((candidate) => typeof candidate.body === "string" && candidate.body.startsWith(MARKER));
    if (existing) {
      gh([
        "api",
        "--method",
        "PATCH",
        `repos/{owner}/{repo}/issues/comments/${existing.id}`,
        "-f",
        `body=${comment}`,
      ]);
    } else {
      gh(["pr", "comment", String(pr), "--body", comment]);
    }
    console.log(existing ? "Updated gate comment" : "Posted gate comment");
  } catch (error) {
    console.warn("Could not comment:", error.message);
  }
}

process.exit(all.exitCode());
