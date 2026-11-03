#!/usr/bin/env node
/** Garage / Intake — `triage` (labels + comment) and `assign` (label → Copilot coding agent). */
import { runTriage } from "./intake/triage.mjs";
import { runAssign } from "./intake/assign.mjs";

const sub = process.argv[2];
const i = process.argv.indexOf("--issue");
const issue = i === -1 ? process.env.ISSUE_NUMBER : process.argv[i + 1];
if (!issue) {
  console.error("ISSUE_NUMBER or --issue required");
  process.exit(1);
}
if (sub === "triage") await runTriage(issue);
else if (sub === "assign") await runAssign(issue);
else {
  console.error("usage: intake.mjs <triage|assign> --issue N");
  process.exit(1);
}
