#!/usr/bin/env node
/** Operator-driven local bridge. It never posts issues or publishes evidence. */
import { appendFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "./lib/config.mjs";
import { pendingFromIssue, readJson, reviewedEvidence, runJob } from "./sightline/coordinator.mjs";

function options(args, allowed, flags = []) {
  const values = {};
  while (args.length) {
    const name = args.shift();
    if (!name.startsWith("--") || !allowed.includes(name.slice(2)) || Object.hasOwn(values, name.slice(2))) throw new Error("invalid option");
    const key = name.slice(2);
    if (flags.includes(key)) values[key] = true;
    else {
      const value = args.shift();
      if (!value || value.startsWith("--")) throw new Error("missing option value");
      values[key] = value;
    }
  }
  return values;
}

function required(values, names) {
  for (const name of names) if (!values[name]) throw new Error(`missing --${name}`);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "prepare") {
    const values = options(args, ["root", "event", "output"]);
    required(values, ["root", "event"]);
    const pending = pendingFromIssue(loadConfig(values.root), readJson(values.event));
    if (values.output && pending.state === "awaiting_approval") writeFileSync(values.output, `${JSON.stringify(pending, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify(pending));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Sightline intake: ${pending.state}. Issue labels are not approval.\n`);
  } else if (command === "run") {
    const names = ["pending", "request", "approval", "target", "recipe", "output-dir", "image", "network"];
    const values = options(args, [...names, "copilot-image", "copilot-network", "synthetic-provider", "profile"], ["synthetic-provider"]);
    required(values, names);
    const state = runJob({ pending: readJson(values.pending), requestFile: values.request, approvalFile: values.approval,
      targetFile: values.target, recipeFile: values.recipe, outputDir: values["output-dir"], image: values.image, network: values.network,
      copilotImage: values["copilot-image"], copilotNetwork: values["copilot-network"], syntheticProvider: values["synthetic-provider"] === true, profile: values.profile });
    console.log(JSON.stringify(state));
    if (!["confirmed", "not_reproduced"].includes(state.state) || (state.provider === "copilot-cli" && state.advisory !== "completed")) process.exitCode = 2;
  } else if (command === "export") {
    const names = ["pending", "result", "reviewer", "revision", "output", "human-reviewed"];
    const values = options(args, names, ["human-reviewed"]);
    required(values, names);
    const evidence = reviewedEvidence({ pending: readJson(values.pending), result: readJson(values.result), reviewer: values.reviewer, revision: values.revision });
    writeFileSync(values.output, evidence, { mode: 0o600, flag: "wx" });
    console.log("Reviewed proof draft saved locally; publication and merge require separate human review.");
  } else {
    throw new Error("expected prepare, run, or export");
  }
} catch (error) {
  // File contents and child-process output are intentionally not echoed.
  console.error(`Sightline coordination stopped: ${error.message}`);
  process.exitCode = 1;
}
