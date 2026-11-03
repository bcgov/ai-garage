import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, eq, done } from "./helper.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pf = path.join(here, "../scripts/preflight.mjs");

function run(root) {
  try {
    return { code: 0, out: execFileSync("node", [pf, "--root", root], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

check("repo-bare fails (no spec, no workflows)", () => {
  eq(run(path.join(here, "fixtures/repo-bare")).code, 1);
});
check("repo-intake fails only because workflows are absent (no spec required)", () => {
  const r = run(path.join(here, "fixtures/repo-intake"));
  eq(r.code, 1);
  if (/missing spec\//.test(r.out)) throw new Error("intake profile must not require spec scaffold");
});

done();
