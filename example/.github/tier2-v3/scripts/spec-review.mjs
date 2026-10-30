#!/usr/bin/env node
/**
 * Spec-aware PR review (heuristic + optional LLM).
 * Checks that implementation PRs reference spec/features and evidence file.
 * Env: PR_NUMBER or --pr N
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function loadConfig(root) {
  const p = path.join(root, "tier2-v3.config.json");
  if (!existsSync(p)) throw new Error("Missing tier2-v3.config.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadReviewPolicy(root) {
  const p = path.join(root, "REVIEW.md");
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const cfg = loadConfig(root);
if (cfg.spec_review?.enabled === false) {
  console.log("spec_review disabled");
  process.exit(0);
}

const reviewMode = String(cfg.spec_review?.mode || cfg.agent?.mode || "heuristic").toLowerCase();
if (reviewMode === "gh-aw" || reviewMode === "ghaw") {
  console.log(
    'Skipping Actions spec-review — mode is gh-aw. Use compiled tier2-v3-spec-review.lock.yml',
  );
  process.exit(0);
}

const pr = arg("pr") || process.env.PR_NUMBER;
if (!pr) {
  console.error("PR_NUMBER or --pr required");
  process.exit(1);
}

const prMeta = JSON.parse(
  gh(["pr", "view", String(pr), "--json", "title,body,files,labels,author,baseRefName"]),
);
const files = (prMeta.files || []).map((f) => f.path);
const implPrefixes = cfg.spec_review?.paths || cfg.checkpoints?.impl_path_prefixes || ["src/"];
const touchesImpl = files.some((f) => implPrefixes.some((p) => f.startsWith(p)));
const touchesSpec = files.some((f) => f.startsWith("spec/") || f.includes("constitution"));

const findings = [];
const body = `${prMeta.title || ""}\n${prMeta.body || ""}`;

if (touchesImpl) {
  if (!existsSync(path.join(root, "spec/spec.md"))) {
    findings.push({ severity: "error", code: "no_spec", message: "This pull request changes application code, and spec/spec.md is missing." });
  }
  if (!/spec\/|features\/|#\d+|TASK-/i.test(body) && !touchesSpec) {
    findings.push({
      severity: "warning",
      code: "no_spec_trace",
      message: "The description does not point at a spec section, a feature file, or a task. Add that link under Where this comes from.",
    });
  }
  const evidencePath = cfg.spec_review?.evidence_path || "docs/pr-evidence.md";
  const hasEvidenceInPr = files.includes(evidencePath);
  const evidenceOnDisk = existsSync(path.join(root, evidencePath));
  if (cfg.spec_review?.require_evidence && !hasEvidenceInPr && !evidenceOnDisk) {
    findings.push({
      severity: "warning",
      code: "no_evidence",
        message: `There is no ${evidencePath} yet. Add the evidence notes for this change.`,
    });
  }
  const featureDir = path.join(root, "spec/features");
  if (existsSync(featureDir)) {
    const features = execFileSync("ls", [featureDir], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.endsWith(".feature"));
    if (features.length === 0) {
      findings.push({ severity: "error", code: "no_features", message: "There are no feature files under spec/features yet, so there is nothing to review the change against." });
    }
  }
  const requireReceipt = cfg.spec_review?.require_receipt !== false;
  if (requireReceipt) {
    const hasReceiptSection = /##\s*review receipt/i.test(body);
    const hasChecked = /\*\*checked\*\*|^checked:/im.test(body);
    const hasCouldNot =
      /\*\*could not check\*\*|could not check|couldn't check/i.test(body);
    if (!hasReceiptSection || !hasChecked || !hasCouldNot) {
      findings.push({
        severity: "warning",
        code: "no_review_receipt",
        message:
          "The description needs a Review receipt with Checked, Could not check, and Residual risk, so the reviewer can say what they actually looked at.",
      });
    }
  }
}

// Optional LLM narrative (OpenAI-compatible or Azure OpenAI — same secrets as Tier 1)
let llmNote = "";
const mode = (cfg.spec_review?.mode || cfg.agent?.mode || "heuristic").toLowerCase();
const apiKey = process.env.TIER1_LLM_API_KEY || process.env.OPENAI_API_KEY;
if ((mode === "llm" || mode === "auto") && apiKey && touchesImpl) {
  try {
    const llm = cfg.agent?.llm || {};
    let base = (process.env.TIER1_LLM_BASE_URL || llm.base_url || "").replace(/\/$/, "");
    const deployment =
      process.env.TIER1_LLM_MODEL ||
      process.env.AZURE_OPENAI_DEPLOYMENT ||
      llm.model ||
      "gpt-4o-mini";
    if (!base && process.env.AZURE_OPENAI_ENDPOINT) {
      const ep = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
      base = /\/openai\/deployments\//i.test(ep)
        ? ep
        : `${ep}/openai/deployments/${deployment}`;
    }
    if (!base) base = "https://api.openai.com/v1";
    let apiStyle = (llm.api_style || process.env.TIER1_LLM_API_STYLE || "openai").toLowerCase();
    if (apiStyle === "azure" && /azure-api\.net/i.test(base)) apiStyle = "azure-apim";
    const isAzure = apiStyle === "azure" || apiStyle === "azure-apim";
    const headers = { "Content-Type": "application/json" };
    let url = `${base}/chat/completions`;
    const reviewPolicy = loadReviewPolicy(root);
    const systemPrompt =
      reviewPolicy ||
      "You review PRs against a BC Gov agentic SDLC. Comment briefly whether the change appears traced to spec/features and constitution constraints (WCAG, design system, PIA, OpenShift). Max 200 words.";
    const body = {
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `PR title: ${prMeta.title}\nBody:\n${prMeta.body}\nFiles:\n${files.join("\n")}\nFindings so far: ${JSON.stringify(findings)}`,
        },
      ],
    };
    if (isAzure) {
      const apiVersion =
        llm.api_version ||
        process.env.TIER1_LLM_API_VERSION ||
        process.env.AZURE_OPENAI_API_VERSION ||
        "2025-04-01-preview";
      url = `${base}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
      if (apiStyle === "azure-apim") {
        headers["Ocp-Apim-Subscription-Key"] = apiKey;
        headers["api-key"] = apiKey;
      } else {
        headers["api-key"] = apiKey;
      }
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
      body.model = deployment;
      body.temperature = llm.temperature ?? 0.2;
    }
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      llmNote = data.choices?.[0]?.message?.content || "";
    } else {
      console.warn(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  } catch (e) {
    console.warn("LLM review skipped:", e.message);
  }
}

const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warning");
const status = errors.length ? "FAIL" : warnings.length ? "WARN" : "PASS";

const DEFAULT_REDACTION = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /\b(?:password|secret|api[_-]?key)\s*[:=]\s*\S+/i,
  /\bghp_[a-zA-Z0-9]{20,}\b/,
];

function buildDenyList(cfg) {
  const extra = cfg.spec_review?.redaction_deny_patterns || [];
  return [...DEFAULT_REDACTION, ...extra.map((s) => new RegExp(s, "i"))];
}

function redactionCheck(text, denyList) {
  const hits = [];
  for (const re of denyList) {
    if (re.test(text)) hits.push(re.source.slice(0, 60));
  }
  return hits;
}

const whereToLook = touchesImpl
  ? "This pull request changes application code. Read the description's How to review this section, then open the files it names and compare them to the spec."
  : touchesSpec
    ? "This pull request changes the spec or the plan. Read What changed, then check that the spec says what will be built, in language a reviewer can test."
    : "This pull request does not change application code. Read What changed and confirm the notes match the files in the diff.";

const checkSummary =
  status === "PASS"
    ? "Automated checks found nothing that blocks a person from reviewing."
    : status === "WARN"
      ? "Automated checks found gaps. They do not replace the review below."
      : "Automated checks failed. Fix those before spending time on the rest of the review.";

const comment = [
  "### How to review this pull request",
  "",
  whereToLook,
  "",
  checkSummary,
  "",
  ...(findings.length
    ? ["What to fix or confirm:", "", ...findings.map((f) => `- ${f.message}`)]
    : ["Nothing else turned up in the automated checks."]),
  "",
  llmNote ? `## Notes\n\n${llmNote}\n` : "",
  "A person still has to merge this. The review receipt at the bottom of the description is where that person records what they checked.",
].join("\n");

const denyList = buildDenyList(cfg);
const redactionHits = redactionCheck(comment, denyList);
if (redactionHits.length) {
  console.error("Redaction guard blocked public PR comment — matched patterns:", redactionHits);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Spec review blocked (redaction)\n\nPublic comment withheld — ${redactionHits.length} deny-list match(es).\n`,
    );
  }
  process.exit(errors.length ? 1 : 2);
}

console.log(comment);

if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
  try {
    gh(["pr", "comment", String(pr), "--body", comment]);
    console.log("Commented on PR", pr);
  } catch (e) {
    console.warn("Could not comment:", e.message);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, comment + "\n");
}

process.exit(errors.length ? 1 : 0);
