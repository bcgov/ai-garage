import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateLiveProof } from "../scripts/gate/live-proof.mjs";
import { evaluateSightlineFreshness } from "../scripts/sightline/freshness.mjs";

const [root, baseSha, headSha, expected] = process.argv.slice(2);
const cfg = { sightline: { enabled: true }, live_proof: { enabled: true } };
const readFile = (file) => readFileSync(path.join(root, file), "utf8");
const common = { cfg, labels: ["live-proof"], title: "Synthetic fix", body: "Finding-Id: VULN-001", touchesImpl: true, readFile };
const oldGate = evaluateLiveProof({ ...common, changedPaths: ["src/lab-mode", "docs/live-proof/VULN-001/after.md"] });
assert.ok(oldGate.every((item) => item.status === "pass"));
const freshness = evaluateSightlineFreshness({ ...common, root, baseSha, headSha });
assert.equal(freshness.some((item) => item.status === "fail"), expected === "stale");
console.log(`PASS Garage gate ${expected === "stale" ? "rejects stale" : "accepts reviewed synthetic"} proof`);
