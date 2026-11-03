/**
 * Maintain one rolling weekly review issue.
 * The newest open labelled issue carrying MARKER is updated; otherwise one is created.
 */
import { gh, ensureLabel } from "../lib/gh.mjs";

const MARKER = "<!-- garage-review -->";

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (typeof v === "object") return `\`${JSON.stringify(v)}\``;
  return String(v);
}

export function renderReviewIssue(report, drift) {
  const date = String(report.generatedAt || new Date().toISOString()).slice(0, 10);
  const tq = report.traceabilityQuality || {};
  const rows = [
    ["specToPlanDays", report.specToPlanDays],
    ["planToFirstPrDays", report.planToFirstPrDays],
    ["firstPassMergeRate", report.firstPassMergeRate],
    ["reworkCyclesPerPr", report.reworkCyclesPerPr],
    ["gateFailureTaxonomy", report.gateFailureTaxonomy],
    ["criterionIdCoverage", tq.criterionIdCoverage?.coverageRate],
    ["provenanceCoverage", tq.provenanceCoverage?.coverageRate],
    ["specTraceMissRate", tq.implPrTraceability?.specTraceMissRate],
    ["reviewReceiptMissRate", tq.implPrTraceability?.reviewReceiptMissRate],
  ];
  const drifted = drift?.drifted || [];
  const body = [
    MARKER,
    `Weekly review generated ${report.generatedAt || ""}. Metrics artifact: workflow run artifact \`garage-metrics\`.`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${key} | ${fmt(value)} |`),
    "",
    "## Docs drift",
    drifted.length
      ? drifted.map((file) => `- \`${file}\``).join("\n")
      : "No docs drift detected.",
    "",
    "## Triage",
    "- [ ] Reviewed by: ",
    "- [ ] Action items filed as issues (or none)",
    "",
    "_Close this issue after review; next week's run opens a fresh one._",
  ].join("\n");
  return { title: `[garage] Weekly review — ${date}`, body };
}

export function upsertReviewIssue(cfg, { title, body }) {
  const label = cfg.measure.review_issue.label;
  ensureLabel(label, "0E8A16", "Weekly metrics review");
  const open = JSON.parse(
    gh(
      ["issue", "list", "--label", label, "--state", "open", "--json", "number,body", "--limit", "5"],
      { ignoreError: true },
    ) || "[]",
  );
  const existing = open.find(
    (issue) => typeof issue.body === "string" && issue.body.startsWith(MARKER),
  );
  if (existing) {
    gh(["issue", "edit", String(existing.number), "--title", title, "--body", body]);
    return { number: existing.number, action: "updated" };
  }
  const url = gh(["issue", "create", "--title", title, "--body", body, "--label", label]);
  return { number: Number(url.split("/").pop()), action: "created" };
}
