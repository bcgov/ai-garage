import { check, eq, done } from "./helper.mjs";
import { migrateConfig } from "../scripts/migrate-config.mjs";

const tier1 = { version: 1, project: "svc", agent: { mode: "auto", llm: { api_style: "azure-apim", base_url: "https://x/openai/deployments/d", api_version: "2025-04-01-preview", model: "d", api_key_env: "TIER1_LLM_API_KEY" } }, triage: { enabled: true, min_body_length: 120, promote_intent: true, intent_ready_label: "intent-ready" }, docs_drift: { enabled: true, doc_paths: ["docs/", "README.md"], code_paths: ["src/", "lib/"], report_path: "docs/tier1-docs-drift-report.md" }, ci_diagnose: { enabled: true, max_log_chars: 8000 } };
const tier2 = { version: 1, project: "svc", tier: 2, pack_version: 3, include_tier1: true, checkpoints: { strict_placeholders: true, impl_path_prefixes: ["src/", "lib/", ".github/workflows/"], require_impl_paths_on_evidence_prs: false }, spec_review: { mode: "gh-aw", evidence_path: "docs/evidence.md", require_receipt: true }, coding_agent: { auto_assign: false, assign_label: "go-agent", base_branch: "development" }, metrics: { enabled: true, gate_taxonomy_exclude: ["activation"] }, triage: { enabled: true, direct_mode: { max_files: 5 } }, provenance: { test_path_prefixes: ["e2e/"] } };

check("both configs → delivery profile", () => {
  const { config } = migrateConfig({ tier1, tier2 });
  eq(config.version, 1);
  eq(config.profile, "delivery");
  eq(config.project, "svc");
  eq(config.paths.impl, ["src/", "lib/", ".github/workflows/"]);
  eq(config.paths.tests, ["e2e/"]);
  eq(config.paths.docs, ["docs/", "README.md"]);
  eq(config.paths.evidence, "docs/evidence.md");
  eq(config.llm.mode, "gh-aw", "spec_review.mode wins over agent.mode");
  eq(config.llm.api_style, "azure-apim");
  eq(config.intake.triage.min_body_length, 120);
  eq(config.intake.triage.promote_intent, undefined, "intent dropped");
  eq(config.intake.coding_agent.auto_assign, false);
  eq(config.intake.coding_agent.label, "go-agent");
  eq(config.intake.coding_agent.base_branch, "development");
  eq(config.gate.strict_placeholders, true);
  eq(config.gate.evidence_requires_impl, false);
  eq(config.gate.risk_triage.enabled, false, "risk triage ships disabled regardless");
  eq(config.gate.risk_triage.max_files, 5);
  eq(config.measure.metrics.gate_taxonomy_exclude, ["activation"]);
  eq(config.measure.docs_drift.report_path, "docs/garage-docs-drift-report.md", "report path reset to new name");
  eq(config.ci_diagnose.max_log_chars, 8000);
  eq(config.tier, undefined);
  eq(config.include_tier1, undefined);
});

check("tier1 only → intake profile", () => {
  const { config, legacyFiles } = migrateConfig({ tier1, tier2: null });
  eq(config.profile, "intake");
  eq(legacyFiles.includes("tier1.config.json"), true);
});

check("live_proof is copied when the old config has it", () => {
  const { config } = migrateConfig({
    tier2: { live_proof: { enabled: true, evidence_dir: "docs/live-proof" } },
  });
  eq(config.live_proof.enabled, true);
  eq(config.live_proof.evidence_dir, "docs/live-proof");
});

check("legacy file list includes workflows and script dirs", () => {
  const { legacyFiles } = migrateConfig({ tier1, tier2 });
  for (const f of ["tier1.config.json", "tier2-v3.config.json", ".github/tier1", ".github/tier2-v3", ".github/workflows/tier1-triage.yml", ".github/workflows/tier2-v3-checkpoint-gate.yml", ".github/workflows/tier2-v3-maintain.yml", "maintain", "intent/.template.md"]) {
    if (!legacyFiles.includes(f)) throw new Error(`missing ${f}`);
  }
});

done();
