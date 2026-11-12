import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
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

if (process.platform !== "win32") {
  check("gate publishes the author walkthrough and withholds redaction hits", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "garage-review-comment-"));
    try {
      const capture = path.join(tmp, "capture");
      writeFileSync(path.join(tmp, "gh"), '#!/bin/sh\nif [ "$1" = api ]; then echo "[]"; else printf "%s\\n" "$@" > "$CAPTURE"; fi\n', { mode: 0o755 });
      const env = { ...process.env, PATH: `${tmp}:${process.env.PATH}`, GH_TOKEN: "test", GITHUB_TOKEN: "test", CAPTURE: capture };
      const invoke = (body) => execFileSync("node", [gate, "--root", okRoot, "--changed-paths", "src/a.ts", "--pr", "12", "--pr-body", body], { encoding: "utf8", env });
      invoke("## Change and verification walkthrough\nBefore: old behavior. After: corrected. Test: local demo passed. Limits: production not checked.");
      const comment = readFileSync(capture, "utf8");
      if (!comment.includes("local demo passed") || !comment.includes("gate has not verified")) throw new Error(comment);
      invoke("## Change and verification walkthrough\nContact: test@example.com");
      const redacted = readFileSync(capture, "utf8");
      if (!redacted.includes("withheld by redaction guard") || redacted.includes("test@example.com")) throw new Error(redacted);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
}

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
