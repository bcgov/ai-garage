import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { runProvenance } from "../gate/provenance.mjs";
import { buildCriteriaIndex, writeCriteriaIndex } from "./criteria-index.mjs";

let activeGhRepo = null;

function git(args, root) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function gh(args) {
  try {
    const next = [...args];
    if (activeGhRepo && !next.includes("--repo")) next.push("--repo", activeGhRepo);
    return execFileSync("gh", next, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }).trim();
  } catch {
    return null;
  }
}

function resolveGhRepo(root) {
  const url = git(["remote", "get-url", "origin"], root);
  const match = url?.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : process.env.GITHUB_REPOSITORY || null;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

function firstCommitDate(root, file) {
  if (!existsSync(path.join(root, file))) return null;
  return git(["log", "--reverse", "--format=%aI", "-1", "--", file], root);
}

function commitCount(pr) {
  if (typeof pr.commitCount === "number") return pr.commitCount;
  if (Array.isArray(pr.commits)) return pr.commits.length;
  return pr.commits?.totalCount ?? 1;
}

function collectPrStats(planAt) {
  const out = {
    planToFirstPrDays: null,
    firstPassMergeRate: null,
    reworkCyclesPerPr: null,
  };
  const raw = gh([
    "pr", "list", "--state", "merged", "--limit", "30",
    "--json", "number,createdAt,mergedAt,commits,commitCount",
  ]);
  if (!raw) return out;
  try {
    const prs = JSON.parse(raw);
    if (!prs.length) return out;
    const counts = prs.map(commitCount);
    out.firstPassMergeRate =
      Math.round((counts.filter((count) => count <= 1).length / counts.length) * 1000) / 1000;
    out.reworkCyclesPerPr =
      Math.round((counts.reduce((sum, count) => sum + Math.max(0, count - 1), 0) / counts.length) * 100) / 100;
    if (planAt) {
      const allRaw = gh([
        "pr", "list", "--state", "all", "--limit", "30", "--json", "number,createdAt",
      ]);
      const all = allRaw ? JSON.parse(allRaw) : [];
      if (all.length) {
        const first = all.reduce((earliest, pr) =>
          !earliest || Date.parse(pr.createdAt) < Date.parse(earliest.createdAt) ? pr : earliest,
        );
        out.planToFirstPrDays = daysBetween(planAt, first.createdAt);
      }
    }
  } catch {
    // GitHub data is optional.
  }
  return out;
}

const CHECKPOINT_IDS = [
  "constitution_present", "constitution_platform_articles", "constitution_placeholders",
  "codeowners_present", "spec_present", "spec_structure", "spec_placeholders",
  "plan_present", "features_present",
];

function mapCheckToTaxonomy(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("checkpoint")) return "checkpoint_gate";
  if (value.includes("spec review") || value.includes("spec-review")) return "spec_review";
  if (value.includes("preflight")) return "preflight";
  return CHECKPOINT_IDS.find((id) => value.includes(id)) || name || "unknown";
}

function collectGateFailureTaxonomy() {
  const taxonomy = {};
  const runsRaw = gh([
    "run", "list", "--workflow", "Garage / Gate", "--limit", "100",
    "--json", "conclusion,databaseId",
  ]);
  if (runsRaw) {
    try {
      for (const run of JSON.parse(runsRaw).filter((entry) => entry.conclusion === "failure").slice(0, 25)) {
        const log = gh(["run", "view", String(run.databaseId), "--log"]);
        const matches = CHECKPOINT_IDS.filter((id) => log?.includes(`[FAIL] ${id}:`));
        for (const key of matches.length ? matches : ["checkpoint_gate"]) {
          taxonomy[key] = (taxonomy[key] || 0) + 1;
        }
      }
    } catch {
      // Ignore malformed GitHub output.
    }
  }
  const prsRaw = gh(["pr", "list", "--state", "merged", "--limit", "30", "--json", "number"]);
  if (prsRaw) {
    try {
      for (const pr of JSON.parse(prsRaw)) {
        const checksRaw = gh(["pr", "checks", String(pr.number), "--json", "name,state,bucket"]);
        if (!checksRaw) continue;
        const checks = JSON.parse(checksRaw);
        for (const check of Array.isArray(checks) ? checks : Object.values(checks)) {
          if (/^(fail|failure)$/i.test(String(check.state || check.bucket || ""))) {
            const key = mapCheckToTaxonomy(check.name);
            taxonomy[key] = (taxonomy[key] || 0) + 1;
          }
        }
      }
    } catch {
      // Ignore malformed GitHub output.
    }
  }
  return taxonomy;
}

function applyTaxonomyExcludes(taxonomy, cfg) {
  const excludes = cfg.measure.metrics.gate_taxonomy_exclude || [];
  const out = { ...taxonomy };
  const excluded = {};
  for (const key of Object.keys(out)) {
    if (excludes.some((value) => key.toLowerCase().includes(String(value).toLowerCase()))) {
      excluded[key] = out[key];
      delete out[key];
    }
  }
  if (Object.keys(excluded).length) out._excludedNoise = excluded;
  return out;
}

function countCriterionIdCoverage(root) {
  const dir = path.join(root, "spec/features");
  if (!existsSync(dir)) {
    return { scenarioCount: 0, taggedCount: 0, coverageRate: null, missingScenarios: [] };
  }
  let scenarioCount = 0;
  let taggedCount = 0;
  const missingScenarios = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".feature"))) {
    const lines = readFileSync(path.join(dir, file), "utf8").split("\n");
    for (let index = 0; index < lines.length; index++) {
      if (!/^\s*Scenario(?: Outline)?:/.test(lines[index])) continue;
      scenarioCount += 1;
      let tagged = false;
      for (let previous = index - 1; previous >= 0; previous--) {
        const line = lines[previous].trim();
        if (!line) continue;
        if (line.startsWith("#")) break;
        if (/@R-\d+\.\d+/.test(line)) tagged = true;
        if (!line.startsWith("@")) break;
      }
      if (tagged) taggedCount += 1;
      else missingScenarios.push(`${file}: ${lines[index].trim()}`);
    }
  }
  return {
    scenarioCount,
    taggedCount,
    coverageRate: scenarioCount ? Math.round((taggedCount / scenarioCount) * 1000) / 1000 : null,
    missingScenarios: missingScenarios.slice(0, 10),
  };
}

function loadCriteriaIndex(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "spec/criteria-index.json"), "utf8"));
  } catch {
    return buildCriteriaIndex(root);
  }
}

function isGitRepo(root) {
  return existsSync(path.join(root, ".git"));
}

function deriveCoverageStates(root, cfg) {
  const criteria = loadCriteriaIndex(root).criteria || [];
  let hints = "";
  for (const file of ["spec/tasks.md", cfg.paths.evidence]) {
    try {
      hints += readFileSync(path.join(root, file), "utf8");
    } catch {
      // Optional evidence.
    }
  }
  const coverage = {};
  for (const criterion of criteria) {
    let state = isGitRepo(root) ? "specified" : "accepted";
    if (hints.includes(`@${criterion.id}`) || hints.includes(criterion.id)) state = "implemented";
    coverage[criterion.id] = state;
  }
  return coverage;
}

function firstCriterionCommitDate(root, id) {
  return git(["log", "--reverse", "--format=%aI", "-1", "-S", `@${id}`, "--", "spec/features"], root);
}

function summarizeCoverageStates(root, states, stallDays) {
  const stateCounts = { specified: 0, accepted: 0, implemented: 0, verified: 0 };
  const stalledCriteria = [];
  const orphanCriteria = [];
  for (const [id, state] of Object.entries(states)) {
    stateCounts[state] = (stateCounts[state] || 0) + 1;
    if (state === "specified" || state === "accepted") {
      orphanCriteria.push(id);
      const at = firstCriterionCommitDate(root, id);
      const age = at ? daysBetween(at, new Date().toISOString()) : null;
      if (age !== null && age >= stallDays) {
        stalledCriteria.push({ id, state, daysSinceSpecified: age });
      }
    }
  }
  return {
    stateCounts,
    stalledCriteria: stalledCriteria.sort((a, b) => b.daysSinceSpecified - a.daysSinceSpecified).slice(0, 20),
    orphanCriteria: orphanCriteria.slice(0, 20),
    stallThresholdDays: stallDays,
  };
}

function prTouchesImpl(files, prefixes) {
  return (files || []).some((file) => prefixes.some((prefix) => (file.path || file).startsWith(prefix)));
}

function hasSpecTrace(body) {
  return /spec\/|features\/|#\d+|TASK-|@R-\d+\.\d+/i.test(body);
}

function hasReviewReceipt(body) {
  return /##\s*review receipt/i.test(body) &&
    (/\*\*checked\*\*|^checked:/im.test(body)) &&
    (/\*\*could not check\*\*|could not check|couldn't check/i.test(body));
}

function collectImplPrTraceability(root, cfg) {
  const out = {
    implPrsSampled: 0, specTraceMissRate: null, reviewReceiptMissRate: null,
    specTraceMissCount: 0, reviewReceiptMissCount: 0,
  };
  const raw = gh(["pr", "list", "--state", "merged", "--limit", "30", "--json", "number,title,body"]);
  if (!raw) return out;
  try {
    const localEvidence = existsSync(path.join(root, cfg.paths.evidence))
      ? readFileSync(path.join(root, cfg.paths.evidence), "utf8") : "";
    for (const pr of JSON.parse(raw)) {
      const filesRaw = gh(["pr", "view", String(pr.number), "--json", "files"]);
      if (!filesRaw || !prTouchesImpl(JSON.parse(filesRaw).files, cfg.paths.impl)) continue;
      out.implPrsSampled += 1;
      const body = `${pr.title || ""}\n${pr.body || ""}\n${localEvidence}`;
      if (!hasSpecTrace(body)) out.specTraceMissCount += 1;
      if (!hasReviewReceipt(body)) out.reviewReceiptMissCount += 1;
    }
  } catch {
    return out;
  }
  if (out.implPrsSampled) {
    out.specTraceMissRate = Math.round((out.specTraceMissCount / out.implPrsSampled) * 1000) / 1000;
    out.reviewReceiptMissRate = Math.round((out.reviewReceiptMissCount / out.implPrsSampled) * 1000) / 1000;
  }
  return out;
}

export function collectTraceabilityQuality(root, cfg) {
  const criterionIds = countCriterionIdCoverage(root);
  const provenanceItems = runProvenance({ root, cfg }).items
    .filter((item) => item.id === "provenance_headers");
  const passed = provenanceItems.filter((item) => item.status === "pass");
  const warned = provenanceItems.filter((item) => item.status === "warn");
  const total = passed.length + warned.length;
  const missing = warned.map((item) => ({ file: null, reason: item.message }));
  let coverageStates = {};
  try {
    coverageStates = deriveCoverageStates(root, cfg);
  } catch {
    // Keep an empty summary for malformed local artifacts.
  }
  return {
    criterionIdCoverage: criterionIds,
    provenanceCoverage: {
      testFileCount: total,
      validCount: passed.length,
      coverageRate: total ? Math.round((passed.length / total) * 1000) / 1000 : null,
      invalidFiles: missing.slice(0, 10),
      missing: missing.slice(0, 10),
      skipped: false,
    },
    coverageSummary: summarizeCoverageStates(root, coverageStates, cfg.measure.metrics.stall_days),
    implPrTraceability: collectImplPrTraceability(root, cfg),
  };
}

function humanCommentCount(prNumber) {
  const raw = gh(["pr", "view", String(prNumber), "--json", "comments"]);
  if (!raw) return null;
  try {
    return (JSON.parse(raw).comments || []).filter((comment) => {
      const author = comment.author?.login || "";
      return author && !/\[bot\]$/i.test(author) && author !== "github-actions";
    }).length;
  } catch {
    return null;
  }
}

function collectCostOfJudgment() {
  const out = { reviewTurnsPerCheckpointPr: null, medianDaysAtCheckpoint: null };
  const raw = gh([
    "pr", "list", "--state", "all", "--limit", "50",
    "--json", "number,title,createdAt,mergedAt,labels,comments",
  ]);
  if (!raw) return out;
  try {
    const checkpointPrs = JSON.parse(raw).filter((pr) => {
      const title = String(pr.title || "").toLowerCase();
      const labels = (pr.labels || []).map((label) =>
        String(typeof label === "string" ? label : label.name).toLowerCase(),
      );
      return labels.some((label) =>
        label.includes("checkpoint") ||
        label === "docs(spec)" ||
        label === "docs(plan)" ||
        label.startsWith("intent/"),
      ) ||
        /^intent[:/]/i.test(pr.title || "") ||
        ((title.includes("spec") || title.includes("plan")) &&
          !title.includes("implement") &&
          labels.some((label) => label.includes("spec") || label.includes("plan")));
    });
    const turns = checkpointPrs
      .map((pr) => humanCommentCount(pr.number))
      .filter((count) => typeof count === "number");
    if (turns.length) {
      out.reviewTurnsPerCheckpointPr =
        Math.round((turns.reduce((sum, count) => sum + count, 0) / turns.length) * 100) / 100;
    }
    const dwell = checkpointPrs
      .filter((pr) => pr.mergedAt && pr.createdAt)
      .map((pr) => daysBetween(pr.createdAt, pr.mergedAt))
      .sort((a, b) => a - b);
    if (dwell.length) out.medianDaysAtCheckpoint = dwell[Math.floor(dwell.length / 2)];
  } catch {
    // GitHub data is optional.
  }
  return out;
}

export function collectMetrics(root = process.cwd(), cfg) {
  activeGhRepo = resolveGhRepo(root);
  const report = {
    generatedAt: new Date().toISOString(),
    specToPlanDays: null,
    planToFirstPrDays: null,
    firstPassMergeRate: null,
    gateFailureTaxonomy: {},
    reworkCyclesPerPr: null,
    coverageStates: {},
    costOfJudgment: collectCostOfJudgment(),
    traceabilityQuality: null,
  };
  try {
    writeCriteriaIndex(root);
  } catch {
    // Non-fatal for read-only roots.
  }
  const specAt = firstCommitDate(root, "spec/spec.md");
  const planAt = firstCommitDate(root, "spec/plan.md");
  if (specAt && planAt) report.specToPlanDays = daysBetween(specAt, planAt);
  try {
    report.coverageStates = deriveCoverageStates(root, cfg);
    report.traceabilityQuality = collectTraceabilityQuality(root, cfg);
    Object.assign(report, collectPrStats(planAt));
    report.gateFailureTaxonomy = applyTaxonomyExcludes(collectGateFailureTaxonomy(), cfg);
    report.costOfJudgment = collectCostOfJudgment();
  } catch {
    // GitHub and partial repositories are supported.
  }
  return report;
}
