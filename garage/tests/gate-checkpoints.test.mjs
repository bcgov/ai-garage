import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, eq, done } from "./helper.mjs";
import { loadConfig } from "../scripts/lib/config.mjs";
import { runCheckpoints } from "../scripts/gate/checkpoints.mjs";
import { runStructural } from "../scripts/gate/structural.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const okRoot = path.join(here, "fixtures/repo-ok");
const bareRoot = path.join(here, "fixtures/repo-bare");
const ids = (r) => Object.fromEntries(r.items.map((i) => [i.id, i.status]));

check("repo-ok passes all checkpoints on a src change", () => {
  const cfg = loadConfig(okRoot);
  const r = runCheckpoints({ root: okRoot, cfg, changedPaths: ["src/a.ts"], triageMode: "pipeline", prTitle: "", prBody: "" });
  eq(r.failed().length, 0, JSON.stringify(r.failed()));
  eq(ids(r).plan_present, "pass");
  eq(ids(r).criterion_ids, "pass");
});

check("repo-bare fails constitution + spec, fails plan/features on impl change", () => {
  const cfg = loadConfig(bareRoot);
  const r = runCheckpoints({ root: bareRoot, cfg, changedPaths: ["src/a.ts"], triageMode: "pipeline", prTitle: "", prBody: "" });
  const s = ids(r);
  eq(s.constitution_present, "fail");
  eq(s.spec_present, "fail");
  eq(s.plan_present, "fail");
  eq(s.features_present, "fail");
});

check("direct mode downgrades plan/features to warn", () => {
  const cfg = loadConfig(bareRoot);
  const r = runCheckpoints({ root: bareRoot, cfg, changedPaths: ["src/a.ts"], triageMode: "direct", prTitle: "", prBody: "" });
  eq(ids(r).plan_present, "warn");
  eq(ids(r).features_present, "warn");
});

check("docs-only change does not require plan", () => {
  const cfg = loadConfig(bareRoot);
  const r = runCheckpoints({ root: bareRoot, cfg, changedPaths: ["docs/x.md"], triageMode: "pipeline", prTitle: "", prBody: "" });
  eq(ids(r).plan_present, "warn");
});

check("evidence-only impl-shaped PR fails", () => {
  const cfg = loadConfig(okRoot);
  const r = runCheckpoints({ root: okRoot, cfg, changedPaths: ["docs/pr-evidence.md"], triageMode: "pipeline", prTitle: "fix: LOG-002", prBody: "Closes #5" });
  eq(ids(r).evidence_only_impl, "fail");
});

check("structural: repo-ok passes; repo-bare fails review/agents", () => {
  const cfg = loadConfig(okRoot);
  eq(runStructural({ root: okRoot, cfg }).failed().length, 0);
  const s = ids(runStructural({ root: bareRoot, cfg }));
  eq(s.review_policy, "fail");
  eq(s.agents_present, "fail");
});

done();
