import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, checkAsync, eq, done } from "./helper.mjs";
import { loadConfig } from "../scripts/lib/config.mjs";
import { runReview, redactionHits } from "../scripts/gate/review.mjs";
import { runProvenance } from "../scripts/gate/provenance.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const okRoot = path.join(here, "fixtures/repo-ok");
const ids = (r) => Object.fromEntries(r.items.map((i) => [i.id, i.status]));
delete process.env.GARAGE_LLM_API_KEY;
delete process.env.TIER1_LLM_API_KEY;
delete process.env.OPENAI_API_KEY;

await checkAsync("impl PR without spec trace or receipt warns", async () => {
  const cfg = loadConfig(okRoot);
  const { results } = await runReview({
    root: okRoot,
    cfg,
    files: ["src/a.ts"],
    prTitle: "feat: x",
    prBody: "no links here",
  });
  const s = ids(results);
  eq(s.no_spec_trace, "warn");
  eq(s.no_review_receipt, "warn");
});

await checkAsync("impl PR with trace + receipt passes", async () => {
  const cfg = loadConfig(okRoot);
  const body =
    "See spec/features/example-happy-path.feature\n\n## Review receipt\n**Checked** R-01.1\n**Could not check** prod";
  const { results } = await runReview({
    root: okRoot,
    cfg,
    files: ["src/a.ts", "docs/pr-evidence.md"],
    prTitle: "feat: x",
    prBody: body,
  });
  eq(results.failed().length + results.warned().length, 0, JSON.stringify(results.items));
});

await checkAsync("docs-only PR produces no findings", async () => {
  const cfg = loadConfig(okRoot);
  const { results } = await runReview({
    root: okRoot,
    cfg,
    files: ["docs/x.md"],
    prTitle: "docs",
    prBody: "",
  });
  eq(results.items.length, 0);
});

check("redaction catches ghp_ token and email", () => {
  const cfg = loadConfig(okRoot);
  eq(redactionHits("token ghp_abcdefghijklmnopqrstuvwxyz1234", cfg).length, 1);
  eq(redactionHits("mail me a@b.ca", cfg).length, 1);
  eq(redactionHits("clean text", cfg).length, 0);
});

check("provenance passes fixture with header", () => {
  const cfg = loadConfig(okRoot);
  const s = ids(runProvenance({ root: okRoot, cfg }));
  eq(s.provenance_headers, "pass");
});

done();
