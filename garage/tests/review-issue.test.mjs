import { check, eq, done } from "./helper.mjs";
import { renderReviewIssue } from "../scripts/measure/review-issue.mjs";

const report = {
  generatedAt: "2026-09-15T06:00:00Z",
  specToPlanDays: 1.5,
  planToFirstPrDays: 0.5,
  firstPassMergeRate: 0.8,
  reworkCyclesPerPr: 0.4,
  gateFailureTaxonomy: { plan_present: 2 },
  traceabilityQuality: {
    criterionIdCoverage: { coverageRate: 0.9 },
    provenanceCoverage: { coverageRate: 0.5 },
    implPrTraceability: { specTraceMissRate: 0, reviewReceiptMissRate: 0.25 },
  },
};

check("renders title with date and a table", () => {
  const { title, body } = renderReviewIssue(report, { drifted: ["docs/api.md"] });
  eq(title, "[garage] Weekly review — 2026-09-15");
  if (!/\| firstPassMergeRate \| 0\.8 \|/.test(body)) throw new Error("missing metric row");
  if (!/docs\/api\.md/.test(body)) throw new Error("missing drift");
  if (!/<!-- garage-review -->/.test(body)) throw new Error("missing marker");
});

check("handles null metrics and no drift", () => {
  const { body } = renderReviewIssue(
    { generatedAt: "2026-01-01T00:00:00Z" },
    { drifted: [] },
  );
  if (!/No docs drift detected/.test(body)) throw new Error("expected no-drift line");
});

done();
