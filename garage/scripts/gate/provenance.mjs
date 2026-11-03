/**
 * Verify acceptance tests declare criterion provenance.
 * Pure module: no argv, output, or process.exit.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Results } from "../lib/report.mjs";

const PROVENANCE_RE = /criterion:\s*@?R-\d+\.\d+/i;
const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.tsx", ".spec.js"];

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, acc);
    else acc.push(file);
  }
  return acc;
}

function isTestFile(rel) {
  const normalized = rel.replace(/\\/g, "/");
  return (
    normalized.includes("/acceptance/") ||
    normalized.includes("/e2e/") ||
    TEST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function knownCriterionIds(root) {
  const indexPath = path.join(root, "spec/criteria-index.json");
  if (!existsSync(indexPath)) return null;
  try {
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    if (!Array.isArray(index.criteria)) return new Set();
    return new Set(index.criteria.map((criterion) => String(criterion.id || "").toUpperCase()));
  } catch {
    return new Set();
  }
}

export function runProvenance({ root, cfg }) {
  const results = new Results();
  const files = new Set();

  for (const prefix of cfg.paths.tests) {
    for (const absolute of walk(path.join(root, prefix))) {
      const relative = path.relative(root, absolute).replace(/\\/g, "/");
      if (isTestFile(relative)) files.add(relative);
    }
  }

  if (files.size === 0) {
    results.ok("provenance_headers", "No acceptance/e2e test files found");
    return results;
  }

  const missing = [];
  const declaredIds = new Set();
  for (const relative of files) {
    const text = readFileSync(path.join(root, relative), "utf8");
    if (!PROVENANCE_RE.test(text)) {
      missing.push(relative);
      continue;
    }
    const match = text.match(/criterion:\s*@?(R-\d+\.\d+)/i);
    if (match) declaredIds.add(match[1].toUpperCase());
  }

  if (missing.length) {
    const examples = missing.slice(0, 3).join(", ");
    results.warn(
      "provenance_headers",
      `${missing.length} test file(s) missing criterion provenance: ${examples}${missing.length > 3 ? "…" : ""}`,
    );
  } else {
    results.ok("provenance_headers", `${files.size} test file(s) declare criterion provenance`);
  }

  const knownIds = knownCriterionIds(root);
  if (knownIds !== null) {
    const unknown = [...declaredIds].filter((id) => !knownIds.has(id));
    if (unknown.length) {
      results.warn(
        "provenance_unknown_ids",
        `Unknown criterion ID(s): ${unknown.slice(0, 3).join(", ")}${unknown.length > 3 ? "…" : ""}`,
      );
    }
  }

  return results;
}
