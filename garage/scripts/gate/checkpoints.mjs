/**
 * Checkpoint gate — spec / plan / features / constitution / evidence checks.
 * Pure module: no argv, no process.exit. Orchestrated by ../gate.mjs.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Results } from "../lib/report.mjs";
import { anyMatch, normalize } from "../lib/paths.mjs";

export function findConstitution(root) {
  for (const c of ["constitution.md", ".specify/memory/constitution.md", "spec/constitution.md"]) {
    if (existsSync(path.join(root, c))) return c;
  }
  return null;
}

export function listFeatures(root) {
  const dir = path.join(root, "spec/features");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".feature"));
}

function read(root, rel) {
  const p = path.join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function runCheckpoints(ctx) {
  const { root, cfg } = ctx;
  const changedPaths = (ctx.changedPaths || []).map(normalize);
  const isDirectMode = (ctx.triageMode || "pipeline") === "direct";
  const strictPlaceholders = cfg.gate.strict_placeholders === true || process.env.GARAGE_STRICT_PLACEHOLDERS === "1" || process.env.SDLC_STRICT_PLACEHOLDERS === "1";
  const implPrefixes = cfg.paths.impl;
  const evidencePath = normalize(cfg.paths.evidence);
  const results = new Results();
  const ok = (id, m) => results.ok(id, m);
  const warn = (id, m) => results.warn(id, m);
  const fail = (id, m) => results.fail(id, m);

  const touchesImplPaths = () => {
    if (changedPaths.length > 0) return anyMatch(changedPaths, implPrefixes);
    return implPrefixes.some((p) => existsSync(path.join(root, p.replace(/\/$/, ""))));
  };

  function auditCriterionIds() {
    const features = listFeatures(root);
    if (features.length === 0) return;

    const missing = [];
    for (const file of features) {
      const body = read(root, `spec/features/${file}`) || "";
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*Scenario(?: Outline)?:/.test(lines[i])) continue;
        let hasId = false;
        for (let j = i - 1; j >= 0; j--) {
          const line = lines[j].trim();
          if (!line) continue;
          if (line.startsWith("#")) break;
          if (/@R-\d+\.\d+/.test(line)) {
            hasId = true;
            break;
          }
          if (!line.startsWith("@")) break;
        }
        if (!hasId) missing.push(`${file}: ${lines[i].trim()}`);
      }
    }

    if (missing.length) {
      warn(
        "criterion_ids",
        `${missing.length} scenario(s) missing @R-xx.y tags: ${missing.slice(0, 3).join("; ")}${missing.length > 3 ? "…" : ""}`,
      );
    } else {
      ok("criterion_ids", "All scenarios carry @R-xx.y criterion IDs");
    }
  }

  /** Evidence-only impl PRs (LOG-002 class): claim a fix but only touch docs/pr-evidence.md. */
  function auditEvidenceOnlyImpl() {
    if (changedPaths.length === 0) return;
    if (cfg.gate.evidence_requires_impl === false) return;

    const touchesEvidence = changedPaths.some((p) => normalize(p) === evidencePath);
    if (!touchesEvidence) return;

    const touchesImpl = touchesImplPaths();
    if (touchesImpl) {
      ok("evidence_with_impl", "PR updates evidence and touches implementation paths");
      return;
    }

    const titleBody = `${ctx.prTitle || ""} ${ctx.prBody || ""}`;
    const looksLikeImpl =
      /\b(fix|feat|implement)\b/i.test(titleBody) ||
      /\[\s*RA\s+[A-Z]+-\d+\s*\]/i.test(titleBody) ||
      /\b(Closes|Fixes)\s+#\d+/i.test(titleBody);

    const onlyDocsOrSpecMeta = changedPaths.every((p) => {
      const n = normalize(p);
      return (
        n === evidencePath ||
        n.startsWith("docs/") ||
        n.startsWith("spec/") ||
        n === "README.md" ||
        n === "AGENTS.md"
      );
    });

    if (looksLikeImpl && onlyDocsOrSpecMeta) {
      fail(
        "evidence_only_impl",
        `Implementation-shaped PR updates ${evidencePath} but touches no implementation paths ` +
          `(${implPrefixes.join(", ")}). Evidence without a code/workflow diff is not a fix ` +
          `(agentic-b LOG-002 lesson). Include the finding Location paths in this PR.`,
      );
    } else if (!touchesImpl && touchesEvidence) {
      warn(
        "evidence_without_impl",
        "PR updates pr-evidence without implementation paths — ok for docs/backfill; not for claiming a code fix",
      );
    }
  }

  /** Prefer signed features+plan when touching impl paths (trilogy order). */
  function auditTrilogyOrder() {
    if (!touchesImplPaths()) return;

    const features = listFeatures(root);
    const plan = read(root, "spec/plan.md");
    if (!plan || features.length === 0) {
      warn(
        "trilogy_order",
        "Implementation paths changed — ensure signed spec features and plan exist before merge (spec → plan → implement)",
      );
    } else {
      ok("trilogy_order", "Impl paths changed with plan + feature files present");
    }
  }

  if (cfg.gate.require_constitution) {
    const constitutionPath = findConstitution(root);
    if (!constitutionPath) {
      fail("constitution_present", "No constitution.md found (tried root, .specify/memory/, spec/).");
    } else {
      ok("constitution_present", `Found ${constitutionPath}`);
      const body = read(root, constitutionPath) || "";
      const required = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const missing = required.filter((p) => !body.includes(`### ${p}`) && !body.includes(`## ${p}`));
      if (missing.length) {
        fail(
          "constitution_platform_articles",
          `Constitution missing platform article markers: ${missing.join(", ")} (expected ### P1 … ### P8)`,
        );
      } else {
        ok("constitution_platform_articles", "Platform articles P1–P8 markers present");
      }
      if (/\{\{[A-Z0-9_]+\}\}/.test(body)) {
        (strictPlaceholders ? fail : warn)(
          "constitution_placeholders",
          "Constitution still contains {{PLACEHOLDER}} tokens — fill before production use",
        );
      }
    }
  }

  const codeowners = read(root, "CODEOWNERS");
  if (!codeowners || !/\/\.github\//.test(codeowners)) {
    warn("codeowners_present", "CODEOWNERS missing or does not protect .github/ — gates are agent-modifiable");
  } else {
    ok("codeowners_present", "CODEOWNERS protects enforcement paths");
  }

  if (cfg.gate.require_spec) {
    const spec = read(root, "spec/spec.md");
    if (!spec) {
      fail("spec_present", "spec/spec.md is missing");
    } else {
      ok("spec_present", "spec/spec.md present");
      for (const heading of ["## Problem", "## Outcome", "## Scope"]) {
        if (!spec.includes(heading)) warn("spec_structure", `spec.md missing recommended heading: ${heading}`);
      }
      if (/\{\{[A-Z0-9_]+\}\}/.test(spec)) {
        (strictPlaceholders ? fail : warn)("spec_placeholders", "spec.md still contains {{PLACEHOLDER}} tokens");
      }
    }
  }

  const needsPlan = touchesImplPaths();
  if (cfg.gate.require_plan_on_impl) {
    const plan = read(root, "spec/plan.md");
    if (!plan) {
      if (needsPlan) {
        (isDirectMode ? warn : fail)(
          "plan_present",
          isDirectMode
            ? "spec/plan.md missing (direct mode — warn only; full pipeline requires plan)"
            : changedPaths.length
              ? "spec/plan.md missing but this PR touches implementation paths — required for checkpoint 2"
              : "spec/plan.md missing but implementation directories exist — required for checkpoint 2",
        );
      } else {
        warn("plan_present", "spec/plan.md missing (ok only before architecture work starts)");
      }
    } else {
      ok("plan_present", "spec/plan.md present");
    }
  }

  if (cfg.gate.require_features) {
    const features = listFeatures(root);
    if (features.length === 0) {
      if (needsPlan) {
        (isDirectMode ? warn : fail)(
          "features_present",
          isDirectMode
            ? "No spec/features/*.feature files (direct mode — warn only)"
            : "No spec/features/*.feature files — acceptance criteria required",
        );
      } else {
        warn("features_present", "No feature files yet");
      }
    } else {
      ok("features_present", `${features.length} feature file(s): ${features.join(", ")}`);
      auditCriterionIds();
    }
  }

  auditEvidenceOnlyImpl();
  auditTrilogyOrder();
  return results;
}
