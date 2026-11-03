import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, eq, done } from "./helper.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const gate = path.join(here, "../scripts/gate.mjs");
const okRoot = path.join(here, "fixtures/repo-ok");
const bareRoot = path.join(here, "fixtures/repo-bare");

function run(args) {
  try {
    return {
      code: 0,
      out: execFileSync("node", [gate, ...args], {
        encoding: "utf8",
        env: { ...process.env, GITHUB_TOKEN: "", GH_TOKEN: "" },
      }),
    };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

check("repo-ok exits 0 and prints PASS/WARN", () => {
  const r = run(["--root", okRoot, "--changed-paths", "src/a.ts", "--no-comment"]);
  eq(r.code, 0, r.out);
  if (!/Garage gate/.test(r.out)) throw new Error("missing header");
});

check("repo-bare exits 1 on impl change", () => {
  const r = run(["--root", bareRoot, "--changed-paths", "src/a.ts", "--no-comment"]);
  eq(r.code, 1, r.out);
});

check("--json emits machine-readable results", () => {
  const r = run(["--root", okRoot, "--changed-paths", "docs/a.md", "--no-comment", "--json"]);
  const parsed = JSON.parse(r.out.slice(r.out.indexOf("{")));
  eq(typeof parsed.status, "string");
  eq(Array.isArray(parsed.items), true);
});

check("gate disabled (intake profile) exits 0 with skip message", () => {
  const r = run([
    "--root",
    path.join(here, "fixtures/repo-intake"),
    "--changed-paths",
    "src/a.ts",
    "--no-comment",
  ]);
  eq(r.code, 0, r.out);
  if (!/gate disabled/i.test(r.out)) throw new Error("expected skip");
});

done();
