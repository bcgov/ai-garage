import { check, eq, done } from "./helper.mjs";
import { heuristicTriage } from "../scripts/intake/triage.mjs";
import { DEFAULTS, applyProfile } from "../scripts/lib/config.mjs";

const cfg = applyProfile(structuredClone(DEFAULTS));

check("thin issue → needs-detail", () => {
  const d = heuristicTriage(cfg, { title: "broken", body: "it broke", labels: [] });
  eq(d.needsDetail, true);
  if (!d.labels.includes("needs-detail")) throw new Error("expected needs-detail");
});

check("well-formed bug issue → bug, not needs-detail", () => {
  const body = "## Problem\nThe export button errors.\n\n## Expected\nCSV downloads.\n\n## Actual\n500.\n\n## Steps\n1. click export";
  const d = heuristicTriage(cfg, { title: "bug: export broken", body, labels: [] });
  eq(d.needsDetail, false);
  if (!d.labels.includes("bug")) throw new Error("expected bug label");
});

done();
