/**
 * Risk-tiered ceremony: direct vs pipeline mode for the Garage gate.
 * Conservative by default — pipeline when uncertain. Pure module: no argv, no audit JSONL.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const FALLBACK = {
  max_files: 3,
  max_reference_count: 2,
  require_additive: true,
  allowed_prefixes: ["src/", "apps/"],
};

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

function isGitRepo(root) {
  return existsSync(path.join(root, ".git"));
}

function pathAllowed(p, allowedPrefixes) {
  const norm = p.replace(/\\/g, "/");
  return allowedPrefixes.some((prefix) => norm.startsWith(prefix));
}

function countReferences(paths, root) {
  if (!isGitRepo(root)) {
    return { skipped: true, count: null, importers: [] };
  }

  const changedSet = new Set(paths.map((p) => p.replace(/\\/g, "/")));
  const importers = new Set();

  for (const raw of paths) {
    const rel = raw.replace(/\\/g, "/");
    const base = path.basename(rel, path.extname(rel));
    const withoutExt = rel.replace(/\.[^./\\]+$/, "");
    const searchTerms = [...new Set([withoutExt, `${path.dirname(rel)}/${base}`, base])].filter(
      Boolean,
    );

    for (const term of searchTerms) {
      const out = git(
        [
          "grep",
          "-l",
          "-F",
          term,
          "--",
          "*.ts",
          "*.tsx",
          "*.js",
          "*.jsx",
          "*.mjs",
          "*.vue",
          "*.py",
          "*.go",
        ],
        root,
      );
      if (!out) continue;
      for (const line of out.split("\n").filter(Boolean)) {
        const norm = line.replace(/\\/g, "/");
        if (!changedSet.has(norm)) importers.add(norm);
      }
    }
  }

  return { skipped: false, count: importers.size, importers: [...importers] };
}

function checkAdditive(paths, root, baseRef) {
  if (!isGitRepo(root)) {
    return { additive: null, skipped: true, reason: "git unavailable" };
  }
  if (paths.length === 0) {
    return { additive: true, skipped: false };
  }

  const args = ["diff", "--numstat"];
  if (baseRef) args.push(`${baseRef}...HEAD`);
  args.push("--", ...paths);

  const out = git(args, root);
  if (out === null) {
    return { additive: null, skipped: true, reason: "git diff unavailable" };
  }

  for (const line of out.split("\n").filter(Boolean)) {
    const [del, , file] = line.split("\t");
    const deletions = parseInt(del, 10);
    if (deletions > 0) {
      return {
        additive: false,
        skipped: false,
        reason: `deletions in ${file || "changed file"}`,
        deletions,
      };
    }
  }

  return { additive: true, skipped: false };
}

function featureFiles(root) {
  const dir = path.join(root, "spec/features");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".feature"))
    .map((f) => path.join(dir, f));
}

export function parseHighTierTagLines(body) {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^@[\w:-]+/.test(trimmed) && /@tier:high\b/i.test(trimmed)) return true;
  }
  return false;
}

function listHighTierCriterionIds(root) {
  const ids = new Set();
  for (const file of featureFiles(root)) {
    try {
      const body = readFileSync(file, "utf8");
      if (!parseHighTierTagLines(body)) continue;
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (!/^@[\w:-]+/.test(trimmed) || !/@tier:high\b/i.test(trimmed)) continue;
        for (const m of trimmed.matchAll(/@R-(\d+\.\d+)/g)) {
          ids.add(`R-${m[1]}`);
        }
        for (let j = i + 1; j < lines.length; j++) {
          const t = lines[j].trim();
          if (!t) continue;
          if (/^\s*Scenario(?: Outline)?:/.test(lines[j])) break;
          if (t.startsWith("@")) {
            for (const m of t.matchAll(/@R-(\d+\.\d+)/g)) ids.add(`R-${m[1]}`);
          } else if (!t.startsWith("#")) break;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return ids;
}

function hasHighTierCriteria(root, changedPaths = null) {
  if (!changedPaths || changedPaths.length === 0) return false;

  const normalized = changedPaths.map((p) => p.replace(/\\/g, "/"));

  for (const rel of normalized) {
    if (!rel.startsWith("spec/features/") || !rel.endsWith(".feature")) continue;
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    try {
      if (parseHighTierTagLines(readFileSync(abs, "utf8"))) return true;
    } catch {
      /* ignore */
    }
  }

  const highIds = listHighTierCriterionIds(root);
  if (highIds.size === 0) return false;

  for (const rel of normalized) {
    for (const id of highIds) {
      if (rel.includes(id) || rel.includes(`@${id}`)) return true;
    }
    const abs = path.join(root, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    try {
      const text = readFileSync(abs, "utf8");
      for (const id of highIds) {
        if (text.includes(`@${id}`) || text.includes(id) || text.includes(`criterion: ${id}`)) {
          return true;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return false;
}

/**
 * @param {{ root?: string, cfg?: object, paths?: string[], baseRef?: string|null, referenceCount?: number, additive?: boolean, highTier?: boolean }} input
 * @returns {{ mode: 'direct'|'pipeline', reasons: string[] }}
 */
export function triageChange(input = {}) {
  const root = path.resolve(input.root || ".");
  const rt = { ...FALLBACK, ...(input.cfg?.gate?.risk_triage || {}) };
  const {
    max_files,
    max_reference_count,
    require_additive,
    allowed_prefixes,
  } = rt;

  const normalized = [...new Set((input.paths || []).map((p) => p.replace(/\\/g, "/").trim()).filter(Boolean))];
  const reasons = [];

  if (normalized.length === 0) {
    reasons.push("no implementation paths changed — default pipeline");
    return { mode: "pipeline", reasons };
  }

  if (typeof input.highTier === "boolean") {
    if (input.highTier) {
      reasons.push("@tier:high criterion present — full pipeline required");
      return { mode: "pipeline", reasons };
    }
  } else if (hasHighTierCriteria(root, normalized)) {
    reasons.push("@tier:high criterion present — full pipeline required");
    return { mode: "pipeline", reasons };
  }

  if (normalized.length > max_files) {
    reasons.push(`file count ${normalized.length} exceeds max_files ${max_files}`);
    return { mode: "pipeline", reasons };
  }

  const disallowed = normalized.filter((p) => !pathAllowed(p, allowed_prefixes));
  if (disallowed.length > 0) {
    reasons.push(`paths outside allowed_prefixes: ${disallowed.join(", ")}`);
    return { mode: "pipeline", reasons };
  }

  let referenceCount;
  if (typeof input.referenceCount === "number") {
    referenceCount = input.referenceCount;
  } else {
    const ref = countReferences(normalized, root);
    if (ref.skipped) {
      reasons.push("git unavailable for reference count — default pipeline");
      return { mode: "pipeline", reasons };
    }
    referenceCount = ref.count;
  }

  if (referenceCount > max_reference_count) {
    reasons.push(
      `reference count ${referenceCount} exceeds max_reference_count ${max_reference_count}`,
    );
    return { mode: "pipeline", reasons };
  }

  if (require_additive) {
    let additive;
    let additiveDetail;
    if (typeof input.additive === "boolean") {
      additive = input.additive;
      additiveDetail = { overridden: true };
    } else {
      const add = checkAdditive(normalized, root, input.baseRef);
      additiveDetail = add;
      if (add.skipped || add.additive === null) {
        reasons.push(
          add.reason
            ? `${add.reason} — default pipeline`
            : "additive check inconclusive — default pipeline",
        );
        return { mode: "pipeline", reasons };
      }
      additive = add.additive;
    }

    if (!additive) {
      reasons.push(additiveDetail?.reason || "non-additive change detected");
      return { mode: "pipeline", reasons };
    }
  }

  reasons.push("all direct-mode criteria met");
  return { mode: "direct", reasons };
}
