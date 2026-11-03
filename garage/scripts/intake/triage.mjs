/**
 * SDLC issue triage — heuristic and/or LLM.
 */
import { loadConfig, repoRoot } from "../lib/config.mjs";
import { ensureLabel, gh } from "../lib/gh.mjs";
import { resolveAgentMode, skipIfGhAw } from "../lib/agent-mode.mjs";
import { chatCompletion, parseJsonLoose } from "../lib/llm.mjs";

export async function runTriage(issueNumber) {
  const cfg = loadConfig(repoRoot());
  const triage = cfg.intake.triage;
  if (!triage?.enabled) {
    console.log("intake.triage disabled in garage.config.json");
    return;
  }

  const mode = resolveAgentMode(cfg);
  console.log(`agent.mode resolved: ${mode}`);
  if (skipIfGhAw(mode, "issue triage")) return;

  const raw = gh([
    "issue",
    "view",
    String(issueNumber),
    "--json",
    "title,body,labels,number",
  ]);
  const issue = JSON.parse(raw);
  const allowedLabels = [
    ...(triage.label_rules || []).map((rule) => rule.label),
    triage.default_label,
    triage.needs_detail_label,
  ].filter(Boolean);

  const heuristic = heuristicTriage(cfg, issue);
  let decision = { ...heuristic, source: "heuristic" };
  if (mode === "llm") {
    const llmDecision = await llmTriage(cfg, issue, allowedLabels, heuristic);
    if (llmDecision) decision = { ...llmDecision, source: "llm" };
    else console.warn("LLM triage failed — using heuristic");
  }

  const existing = new Set((issue.labels || []).map((label) => label.name));
  const toAdd = (decision.labels || []).filter(
    (label) => allowedLabels.includes(label) && !existing.has(label),
  );

  for (const label of new Set(toAdd)) {
    ensureLabel(label);
    gh(["issue", "edit", String(issueNumber), "--add-label", label]);
    console.log(`Added label: ${label}`);
  }

  if (decision.comment) {
    const header = `### Garage intake triage (${cfg.project || "repo"}) · \`${decision.source}\`\n\n`;
    gh(["issue", "comment", String(issueNumber), "--body", header + decision.comment]);
    console.log("Posted comment");
  }

  console.log(JSON.stringify({ issue: issue.number, mode, decision, labelsAdded: toAdd }, null, 2));
}

export function heuristicTriage(cfg, issue) {
  const triage = cfg.intake.triage;
  const text = `${issue.title || ""}\n${issue.body || ""}`.toLowerCase();
  const bodyLen = (issue.body || "").trim().length;
  const labels = [];
  for (const rule of triage.label_rules || []) {
    if (text.includes(String(rule.match).toLowerCase())) labels.push(rule.label);
  }
  if (labels.length === 0 && triage.default_label) labels.push(triage.default_label);

  const needsDetail = bodyLen < (triage.min_body_length ?? 80);
  if (needsDetail && triage.needs_detail_label) labels.push(triage.needs_detail_label);

  let comment = null;
  if (needsDetail) {
    comment = [
      "Thanks for the issue. Please add enough detail for someone to act on it:",
      "",
      "- **Problem** — what is going wrong?",
      "- **Expected** — what should happen?",
      "- **Actual** — what happens instead?",
      "- **Steps** — how to reproduce (if applicable)",
      "",
      `_Heuristic · body length ${bodyLen} < ${triage.min_body_length}_`,
    ].join("\n");
  }
  return { labels: [...new Set(labels)], needsDetail, comment };
}

export async function llmTriage(cfg, issue, allowedLabels, fallback) {
  const system = `You triage GitHub issues for a BC Gov service repo.
Return JSON only: {"labels":string[],"needsDetail":boolean,"comment":string|null}
Rules:
- labels must be chosen from: ${allowedLabels.join(", ")}
- needsDetail true if reproduction/expected/actual are missing
- comment: short markdown asking for missing info, or null if issue is complete
- Prefer precision over many labels (1-3 labels)`;

  const user = `Title: ${issue.title}\n\nBody:\n${issue.body || "(empty)"}\n\nHeuristic suggestion: ${JSON.stringify(fallback)}`;
  const content = await chatCompletion(cfg, system, user, { json: true });
  const parsed = parseJsonLoose(content);
  if (!parsed || !Array.isArray(parsed.labels)) return null;
  return {
    labels: parsed.labels.filter((label) => allowedLabels.includes(label)),
    needsDetail: Boolean(parsed.needsDetail),
    comment: parsed.comment || (parsed.needsDetail ? fallback.comment : null),
  };
}
