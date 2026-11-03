#!/usr/bin/env node
/**
 * Table-driven tests for gate/risk-triage.mjs (no git required).
 */
import { triageChange, parseHighTierTagLines } from "../scripts/gate/risk-triage.mjs";
import { check, eq, done } from "./helper.mjs";

const baseCfg = {
  gate: {
    risk_triage: {
      enabled: true,
      max_files: 3,
      max_reference_count: 2,
      require_additive: true,
      allowed_prefixes: ["src/", "apps/"],
    },
  },
  paths: { impl: ["src/", "apps/"] },
};

function mergeCfg(override = {}) {
  return {
    ...baseCfg,
    gate: {
      ...baseCfg.gate,
      risk_triage: { ...baseCfg.gate.risk_triage, ...(override.gate?.risk_triage || {}) },
    },
    paths: { ...baseCfg.paths, ...(override.paths || {}) },
  };
}

const tagCases = [
  {
    name: "parseHighTierTagLines ignores comment mentions",
    body: "  # Add @tier:high when needed\n  @R-00.1\n  Scenario: x",
    want: false,
  },
  {
    name: "parseHighTierTagLines detects real tag",
    body: "  @tier:high @R-00.1\n  Scenario: x",
    want: true,
  },
];

for (const tc of tagCases) {
  check(tc.name, () => {
    eq(parseHighTierTagLines(tc.body), tc.want);
  });
}

const cases = [
  {
    name: "empty paths → pipeline",
    paths: [],
    wantMode: "pipeline",
    wantReasonIncludes: "no implementation paths",
  },
  {
    name: "single allowed path, low refs, additive → direct",
    paths: ["src/foo.ts"],
    opts: { referenceCount: 0, additive: true },
    wantMode: "direct",
  },
  {
    name: "too many files → pipeline",
    paths: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
    opts: { referenceCount: 0, additive: true },
    wantMode: "pipeline",
    wantReasonIncludes: "file count",
  },
  {
    name: "exactly max_files (3) → direct",
    paths: ["src/a.ts", "src/b.ts", "src/c.ts"],
    opts: { referenceCount: 1, additive: true },
    wantMode: "direct",
  },
  {
    name: "path outside allowed_prefixes → pipeline",
    paths: ["deploy/k8s.yaml"],
    opts: { referenceCount: 0, additive: true },
    wantMode: "pipeline",
    wantReasonIncludes: "allowed_prefixes",
  },
  {
    name: "spec path outside allowed → pipeline",
    paths: ["spec/spec.md"],
    opts: { referenceCount: 0, additive: true },
    wantMode: "pipeline",
    wantReasonIncludes: "allowed_prefixes",
  },
  {
    name: "reference count too high → pipeline",
    paths: ["src/foo.ts"],
    opts: { referenceCount: 5, additive: true },
    wantMode: "pipeline",
    wantReasonIncludes: "reference count",
  },
  {
    name: "reference count at threshold (2) → direct",
    paths: ["src/foo.ts"],
    opts: { referenceCount: 2, additive: true },
    wantMode: "direct",
  },
  {
    name: "non-additive → pipeline",
    paths: ["src/foo.ts"],
    opts: { referenceCount: 0, additive: false },
    wantMode: "pipeline",
    wantReasonIncludes: "non-additive",
  },
  {
    name: "apps/ prefix allowed → direct",
    paths: ["apps/web/main.ts"],
    opts: { referenceCount: 0, additive: true },
    wantMode: "direct",
  },
  {
    name: "custom allowed_prefixes",
    paths: ["lib/util.ts"],
    cfg: { gate: { risk_triage: { allowed_prefixes: ["lib/"] } } },
    opts: { referenceCount: 0, additive: true },
    wantMode: "direct",
  },
  {
    name: "custom max_files=1 blocks two files",
    paths: ["src/a.ts", "src/b.ts"],
    cfg: { gate: { risk_triage: { max_files: 1 } } },
    opts: { referenceCount: 0, additive: true },
    wantMode: "pipeline",
    wantReasonIncludes: "file count",
  },
  {
    name: "mixed allowed and disallowed → pipeline",
    paths: ["src/a.ts", "deploy/x.yaml"],
    opts: { referenceCount: 0, additive: true },
    wantMode: "pipeline",
    wantReasonIncludes: "allowed_prefixes",
  },
  {
    name: "@tier:high override forces pipeline",
    paths: ["src/foo.ts"],
    opts: { referenceCount: 0, additive: true, highTier: true },
    wantMode: "pipeline",
    wantReasonIncludes: "@tier:high",
  },
  {
    name: "unrelated src change without highTier override → direct",
    paths: ["src/foo.ts"],
    opts: { referenceCount: 0, additive: true, highTier: false },
    wantMode: "direct",
  },
];

for (const tc of cases) {
  check(tc.name, () => {
    const result = triageChange({
      root: ".",
      cfg: tc.cfg ? mergeCfg(tc.cfg) : baseCfg,
      paths: tc.paths,
      ...(tc.opts || {}),
    });
    eq(result.mode, tc.wantMode, JSON.stringify(result.reasons));
    if (tc.wantReasonIncludes) {
      if (!result.reasons.some((r) => r.includes(tc.wantReasonIncludes))) {
        throw new Error(
          `missing reason containing "${tc.wantReasonIncludes}": ${JSON.stringify(result.reasons)}`,
        );
      }
    }
  });
}

done();
