import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureLabel, gh } from "../lib/gh.mjs";
import { resolveAgentMode } from "../lib/agent-mode.mjs";
import { chatCompletion } from "../lib/llm.mjs";

function git(args, root) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listFiles(root, rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel.replace(/\\/g, "/")];
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git") continue;
      const absolute = path.join(dir, name);
      const relative = path.join(prefix, name).replace(/\\/g, "/");
      if (statSync(absolute).isDirectory()) walk(absolute, relative);
      else out.push(relative);
    }
  };
  walk(abs, rel.replace(/\/$/, ""));
  return out;
}

function latestCommitTs(root, files) {
  if (!files.length) return 0;
  try {
    const out = git(["log", "-1", "--format=%ct", "--", ...files], root);
    return out ? Number(out) : 0;
  } catch {
    return 0;
  }
}

async function llmDocHints(cfg, root, codeFiles, docFiles) {
  const samples = codeFiles.slice(0, 5).flatMap((file) => {
    try {
      return [`### ${file}\n\`\`\`\n${readFileSync(path.join(root, file), "utf8").slice(0, 1500)}\n\`\`\``];
    } catch {
      return [];
    }
  });
  const docs = docFiles.slice(0, 3).map((file) => {
    try {
      return `### ${file}\n${readFileSync(path.join(root, file), "utf8").slice(0, 1200)}`;
    } catch {
      return `### ${file}\n(unreadable)`;
    }
  });
  return chatCompletion(
    cfg,
    "Suggest concrete markdown doc edits from the supplied code. Do not invent APIs. Keep under 350 words.",
    ["Code samples:", ...samples, "", "Current docs:", ...docs].join("\n"),
  );
}

export async function runDocsDrift(root, cfg) {
  const settings = cfg.measure.docs_drift;
  const docFiles = (cfg.paths.docs || []).flatMap((entry) => listFiles(root, entry));
  const codeFiles = (cfg.paths.impl || []).flatMap((entry) => listFiles(root, entry));
  const reportPath = settings.report_path;
  if (!codeFiles.length) return { drifted: [], reportPath: null };

  const docTs = latestCommitTs(root, docFiles.length ? docFiles : ["README.md"]);
  const codeTs = latestCommitTs(root, codeFiles);
  const drifted = codeTs > docTs + 60 ? docFiles.length ? docFiles : cfg.paths.docs : [];
  const mode = resolveAgentMode(cfg);
  let source = "heuristic";
  let agentSection = "";
  if (drifted.length && mode === "llm") {
    const hints = await llmDocHints(cfg, root, codeFiles, docFiles);
    if (hints) {
      source = "llm";
      agentSection = `\n## Agent-suggested doc updates\n\n${hints}\n`;
    }
  }

  const report = [
    "# Docs drift report",
    "",
    `Project: **${cfg.project || "repo"}**`,
    `Generated: ${new Date().toISOString()}`,
    `Mode: \`${mode}\` · source: \`${source}\``,
    "",
    "| Signal | Value |",
    "| --- | --- |",
    `| Code paths | ${(cfg.paths.impl || []).join(", ")} |`,
    `| Doc paths | ${(cfg.paths.docs || []).join(", ")} |`,
    `| Latest code commit (unix) | ${codeTs || "n/a"} |`,
    `| Latest docs commit (unix) | ${docTs || "n/a"} |`,
    `| Drift detected | ${drifted.length ? "YES" : "no"} |`,
    agentSection,
    "## Recent code files (sample)",
    "",
    ...codeFiles.slice(0, 40).map((file) => `- \`${file}\``),
    "",
    "_Garage measure — timestamp drift detection; the model section is advisory only._",
    "",
  ].join("\n");
  console.log(report);

  if (!drifted.length) return { drifted, reportPath: null };
  mkdirSync(path.dirname(path.join(root, reportPath)), { recursive: true });
  writeFileSync(path.join(root, reportPath), report);
  if (process.argv.includes("--dry-run")) return { drifted, reportPath };

  if (settings.open_pull_request) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const branch = `garage/docs-drift-${date}`;
    try {
      git(["config", "user.name", "garage-bot"], root);
      git(["config", "user.email", "garage-bot@users.noreply.github.com"], root);
      git(["checkout", "-B", branch], root);
      git(["add", reportPath], root);
      git(["commit", "-m", `docs: drift report ${date}`], root);
      git(["push", "-u", "origin", branch, "--force"], root);
      ensureLabel("garage-docs-drift", "C5DEF5", "Docs may be behind code");
      gh([
        "pr", "create", "--draft", "--title", `docs: drift report ${date}`,
        "--body", `See \`${reportPath}\`. Update documentation or explain why no change is needed.`,
        "--label", "garage-docs-drift",
      ]);
    } catch (error) {
      console.error(`Docs drift PR failed: ${error.message}`);
    }
  }
  return { drifted, reportPath };
}
