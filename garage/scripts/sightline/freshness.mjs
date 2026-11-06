/** Conservative commit freshness check for opt-in Sightline proof drafts. */
import { execFileSync } from "node:child_process";
import { effectiveLabels, extractFindingIds, liveProofConfig } from "../gate/live-proof.mjs";

const REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

function field(body, name) {
  const matches = [...String(body || "").matchAll(new RegExp(`^${name}:[ \\t]*([^\\r\\n]+?)[ \\t]*$`, "gim"))];
  return matches.length === 1 ? matches[0][1] : "";
}

function metadata(body, id, phase) {
  const revision = field(body, "tested-revision");
  const recipe = field(body, "recipe-ref");
  const digest = field(body, "recipe-sha256");
  if (field(body, "finding-id") !== id || field(body, "phase") !== phase || !REVISION.test(revision) ||
      !UUID.test(field(body, "run-id")) || !IDENTIFIER.test(field(body, "reviewed-by")) ||
      !IDENTIFIER.test(recipe) || !/^[0-9a-f]{64}$/.test(digest)) return null;
  return { revision, recipe, digest };
}

function onlyProofSince(root, tested, current, allowedFile) {
  if (!REVISION.test(current || "")) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", tested, current], { cwd: root, stdio: "ignore" });
    const output = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", tested, current, "--"], { cwd: root });
    const files = output.toString("utf8").split("\0").filter(Boolean);
    return files.every((file) => file === allowedFile);
  } catch {
    return false;
  }
}

export function evaluateSightlineFreshness({ cfg, root, labels, title, body, touchesImpl, readFile, baseSha, headSha }) {
  if (cfg?.sightline?.enabled !== true || cfg?.live_proof?.enabled !== true) return [];
  const lp = liveProofConfig(cfg);
  const all = effectiveLabels(labels, body, lp).map((label) => String(label).toLowerCase());
  if (!all.includes(lp.label.toLowerCase()) || all.includes(lp.unavailable_label.toLowerCase())) return [];
  if (!/^[A-Za-z0-9._/-]+$/.test(lp.evidence_dir) || lp.evidence_dir.split("/").some((part) => part === ".." || part === "." || !part)) {
    return [{ status: "fail", id: "sightline_freshness", message: "Sightline evidence directory is invalid." }];
  }
  const ids = extractFindingIds(`${title || ""}\n${body || ""}`);
  if (!ids.length) return []; // The existing live-proof check reports the missing finding.
  const results = [];
  for (const id of ids) {
    let baseline;
    for (const [phase, name, current] of [["baseline", "before.md", baseSha], ...(touchesImpl ? [["candidate", "after.md", headSha]] : [])]) {
      const file = `${lp.evidence_dir}/${id}/${name}`;
      const tested = metadata(readFile(file), id, phase);
      const sameRecipe = phase === "baseline" || (baseline && tested && baseline.recipe === tested.recipe && baseline.digest === tested.digest);
      if (phase === "baseline") baseline = tested;
      if (!tested || !sameRecipe || !onlyProofSince(root, tested.revision, current, file)) {
        results.push({ status: "fail", id: "sightline_freshness", message: `${id}: ${phase} proof metadata is missing or stale for the current commit.` });
      } else {
        results.push({ status: "pass", id: "sightline_freshness", message: `${id}: ${phase} proof points to an ancestor with only its proof file changed since testing; human review remains required.` });
      }
    }
  }
  return results;
}
