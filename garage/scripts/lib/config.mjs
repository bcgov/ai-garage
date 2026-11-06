import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const CONFIG_FILE = "garage.config.json";

export const DEFAULTS = {
  version: 1,
  project: "my-service",
  profile: "delivery",
  paths: {
    impl: ["src/", "apps/", "services/", "packages/", "server/", "deploy/", ".github/workflows/"],
    tests: ["tests/acceptance/", "tests/e2e/", "e2e/"],
    docs: ["docs/", "README.md"],
    evidence: "docs/pr-evidence.md",
  },
  llm: {
    mode: "auto",
    api_style: "openai",
    base_url: "",
    api_version: "2025-04-01-preview",
    model: "gpt-4o-mini",
    api_key_env: "GARAGE_LLM_API_KEY",
    temperature: 0.2,
  },
  intake: {
    triage: {
      enabled: true,
      min_body_length: 80,
      label_rules: [
        { match: "bug", label: "bug" },
        { match: "broken", label: "bug" },
        { match: "error", label: "bug" },
        { match: "feature", label: "enhancement" },
        { match: "enhance", label: "enhancement" },
        { match: "docs", label: "documentation" },
        { match: "readme", label: "documentation" },
        { match: "security", label: "security" },
        { match: "a11y", label: "accessibility" },
        { match: "accessibility", label: "accessibility" },
        { match: "deploy", label: "ops" },
        { match: "pipeline", label: "ops" },
      ],
      default_label: "needs-triage",
      needs_detail_label: "needs-detail",
    },
    coding_agent: {
      auto_assign: true,
      label: "ready-for-agent",
      base_branch: "main",
      custom_instructions: "",
    },
  },
  gate: {
    enabled: true,
    require_constitution: true,
    require_spec: true,
    require_features: true,
    require_plan_on_impl: true,
    strict_placeholders: false,
    evidence_requires_impl: true,
    review: {
      enabled: true,
      require_evidence: true,
      require_receipt: true,
      redaction_deny_patterns: [],
    },
    risk_triage: {
      enabled: false,
      max_files: 3,
      max_reference_count: 2,
      require_additive: true,
      allowed_prefixes: ["src/", "apps/"],
    },
  },
  live_proof: {
    enabled: false,
    label: "live-proof",
    unavailable_label: "live-proof-unavailable",
    evidence_dir: "docs/live-proof",
    before_verdict: "confirmed",
    after_verdict: "closed",
  },
  sightline: { enabled: false },
  measure: {
    enabled: true,
    metrics: {
      enabled: true,
      artifact_path: "docs/garage-metrics.json",
      stall_days: 14,
      gate_taxonomy_exclude: ["activation", "agent"],
    },
    docs_drift: {
      enabled: true,
      open_pull_request: true,
      report_path: "docs/garage-docs-drift-report.md",
    },
    review_issue: { enabled: true, label: "garage:review" },
  },
  ci_diagnose: {
    enabled: true,
    watch_workflows: ["CI", "Tests", "Build", "test"],
    ignore_workflows: ["Garage / Gate", "Garage / Intake", "Garage / Measure", "Garage / CI diagnose", "Garage / Preflight"],
    known_residuals: [],
    max_log_chars: 12000,
  },
};

const PROFILES = ["intake", "delivery"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function applyProfile(cfg) {
  const profile = cfg.profile || "delivery";
  if (!PROFILES.includes(profile)) {
    throw new Error(`Unknown profile "${profile}" — expected one of ${PROFILES.join(", ")}`);
  }
  if (profile === "intake") {
    cfg.gate.enabled = false;
    cfg.intake.coding_agent.auto_assign = false;
    cfg.measure.metrics.enabled = false;
  }
  return cfg;
}

export function repoRoot() {
  return process.env.GITHUB_WORKSPACE || process.env.GARAGE_ROOT || process.env.SDLC_ROOT || process.cwd();
}

export function loadConfig(root = repoRoot()) {
  const p = path.join(root, CONFIG_FILE);
  if (!existsSync(p)) {
    throw new Error(`Missing ${p}. Run garage/enrol.sh or copy garage.config.example.json → ${CONFIG_FILE}.`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8"));
  if (raw.version !== 1) throw new Error(`Unsupported ${CONFIG_FILE} version: ${raw.version}`);
  return applyProfile(deepMerge(structuredClone(DEFAULTS), raw));
}

/** Non-throwing variant for scripts that must run even before enrol finishes. */
export function tryLoadConfig(root = repoRoot()) {
  try {
    return loadConfig(root);
  } catch {
    return applyProfile(structuredClone(DEFAULTS));
  }
}
