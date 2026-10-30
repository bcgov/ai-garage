/**
 * Live-proof contract for the checkpoint gate and coding-agent assign.
 *
 * This pack does not build an application or run a check. A garage recipe
 * commits two recordings into the enrolled repo. The gate only reads them.
 *
 * before.md  verdict: confirmed   — the bug was shown on a local copy
 * after.md   verdict: closed      — that same check now fails
 */

export const DEFAULT_LIVE_PROOF = {
  enabled: false,
  label: "live-proof",
  unavailable_label: "live-proof-unavailable",
  evidence_dir: "docs/live-proof",
  before_verdict: "confirmed",
  after_verdict: "closed",
};

const FINDING_ID = /([A-Za-z][A-Za-z0-9]*-(?:[A-Za-z][A-Za-z0-9]*-)*\d+)/;

export function liveProofConfig(cfg = {}) {
  const raw = cfg.live_proof || {};
  const evidence_dir = String(raw.evidence_dir || DEFAULT_LIVE_PROOF.evidence_dir)
    .replace(/\\/g, "/")
    .replace(/\/$/, "");
  return {
    ...DEFAULT_LIVE_PROOF,
    ...raw,
    enabled: raw.enabled === true,
    evidence_dir,
  };
}

export function parseLabelList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
}

export function safeFindingId(id) {
  return /^[A-Za-z][A-Za-z0-9]*-(?:[A-Za-z][A-Za-z0-9]*-)*\d+$/.test(String(id || ""));
}

export function extractFindingIds(text) {
  const ids = new Set();
  const src = String(text || "");
  for (const m of src.matchAll(new RegExp(`Finding-Id:\\s*${FINDING_ID.source}`, "gi"))) {
    if (safeFindingId(m[1])) ids.add(m[1]);
  }
  for (const m of src.matchAll(new RegExp(`\\[\\s*RA\\s+${FINDING_ID.source}\\s*\\]`, "gi"))) {
    if (safeFindingId(m[1])) ids.add(m[1]);
  }
  return [...ids];
}

export function verdictIs(body, expected) {
  const needle = String(expected).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^verdict:\\s*${needle}\\s*$`, "im").test(String(body || ""));
}

export function recordingPath(evidenceDir, id, name) {
  return `${evidenceDir}/${id}/${name}`;
}

export function unavailableReasonOk(specBody, findingId) {
  for (const line of String(specBody || "").split("\n")) {
    const m = line.match(/^\s*Live proof unavailable:\s*(.+)$/i);
    if (!m) continue;
    const reason = m[1].trim();
    if (reason.length < 8) continue;
    if (findingId && !reason.toLowerCase().includes(String(findingId).toLowerCase())) continue;
    return true;
  }
  return false;
}

function labelsInclude(labels, name) {
  const set = new Set((labels || []).map((l) => String(l).trim().toLowerCase()));
  return set.has(String(name || "").toLowerCase());
}

/** Body lines that mean the same thing as the GitHub labels. */
export function labelsFromBody(body, lp = DEFAULT_LIVE_PROOF) {
  const text = String(body || "");
  const extra = [];
  if (/^Live-proof:\s*required\s*$/im.test(text) || /^### Live proof\s*\n+\s*required\s*$/im.test(text)) {
    extra.push(lp.label);
  }
  if (
    /^Live-proof:\s*unavailable\s*$/im.test(text) ||
    /^### Live proof\s*\n+\s*unavailable\s*$/im.test(text)
  ) {
    extra.push(lp.unavailable_label);
  }
  return extra;
}

export function effectiveLabels(labels, body, lp) {
  return [...(labels || []), ...labelsFromBody(body, lp)];
}

function idsFromChangedPaths(changedPaths, evidenceDir) {
  const prefix = `${evidenceDir}/`;
  const ids = [];
  for (const raw of changedPaths || []) {
    const norm = String(raw).replace(/\\/g, "/");
    if (!norm.startsWith(prefix)) continue;
    const id = norm.slice(prefix.length).split("/")[0];
    if (safeFindingId(id)) ids.push(id);
  }
  return [...new Set(ids)];
}

/**
 * @returns {{ status: 'pass'|'fail', id: string, message: string }[]}
 */
export function evaluateLiveProof({
  cfg,
  labels,
  title,
  body,
  changedPaths,
  touchesImpl,
  readFile,
}) {
  const lp = liveProofConfig(cfg);
  if (!lp.enabled) return [];

  const allLabels = effectiveLabels(labels, body, lp);
  const hasRequired = labelsInclude(allLabels, lp.label);
  const hasUnavailable = labelsInclude(allLabels, lp.unavailable_label);
  if (!hasRequired && !hasUnavailable) return [];

  if (hasRequired && hasUnavailable) {
    return [
      {
        status: "fail",
        id: "live_proof",
        message: `Pull request has both ${lp.label} and ${lp.unavailable_label}. Keep one.`,
      },
    ];
  }

  let ids = extractFindingIds(`${title || ""}\n${body || ""}`);
  if (ids.length === 0) ids = idsFromChangedPaths(changedPaths, lp.evidence_dir);

  if (ids.length === 0) {
    return [
      {
        status: "fail",
        id: "live_proof",
        message:
          "Live proof is marked but no finding id was found. Add `Finding-Id: VULN-001` to the pull request body, or `[RA VULN-001]` in the title.",
      },
    ];
  }

  const results = [];
  for (const id of ids) {
    if (hasUnavailable) {
      const spec = readFile("spec/spec.md");
      if (!unavailableReasonOk(spec, id)) {
        results.push({
          status: "fail",
          id: "live_proof",
          message:
            `spec/spec.md must contain \`Live proof unavailable: ${id} — <reason>\`. ` +
            "No recording is required. The reason has to name this finding.",
        });
      } else {
        results.push({
          status: "pass",
          id: "live_proof",
          message: `${id}: live proof unavailable, reason recorded in spec/spec.md`,
        });
      }
      continue;
    }

    const beforeRel = recordingPath(lp.evidence_dir, id, "before.md");
    const afterRel = recordingPath(lp.evidence_dir, id, "after.md");
    const beforeOk = verdictIs(readFile(beforeRel), lp.before_verdict);

    if (!beforeOk) {
      results.push({
        status: "fail",
        id: "live_proof",
        message: `${beforeRel} must exist and contain \`verdict: ${lp.before_verdict}\`.`,
      });
    }

    if (!touchesImpl) {
      if (beforeOk) {
        results.push({
          status: "pass",
          id: "live_proof",
          message: `${id}: before recording present (${lp.before_verdict})`,
        });
      }
      continue;
    }

    const changed = (changedPaths || []).map((p) => String(p).replace(/\\/g, "/"));
    const afterInDiff = changed.includes(afterRel);
    const afterOk = verdictIs(readFile(afterRel), lp.after_verdict);
    if (!afterInDiff || !afterOk) {
      results.push({
        status: "fail",
        id: "live_proof",
        message:
          `Implementation pull request must add or update ${afterRel} with \`verdict: ${lp.after_verdict}\`. ` +
          "A recording without a code change is still not a fix.",
      });
    } else if (beforeOk) {
      results.push({
        status: "pass",
        id: "live_proof",
        message: `${id}: before recording present and after recording in this diff (${lp.after_verdict})`,
      });
    }
  }
  return results;
}

export function liveProofForcesPipeline(paths, labels, cfg, body = "") {
  const lp = liveProofConfig(cfg);
  if (!lp.enabled) return false;
  const allLabels = effectiveLabels(labels, body, lp);
  if (labelsInclude(allLabels, lp.label) || labelsInclude(allLabels, lp.unavailable_label)) return true;
  const prefix = `${lp.evidence_dir}/`;
  return (paths || []).some((p) => String(p).replace(/\\/g, "/").startsWith(prefix));
}

/**
 * Coding-agent assign waits until the before recording is on the base branch.
 * @returns {{ block: boolean, message?: string, id?: string }}
 */
export function assignBlockedByLiveProof({ labels, title, body, beforeBodies, cfg }) {
  const lp = liveProofConfig(cfg);
  if (!lp.enabled) return { block: false };

  const allLabels = effectiveLabels(labels, body, lp);
  const hasRequired = labelsInclude(allLabels, lp.label);
  const hasUnavailable = labelsInclude(allLabels, lp.unavailable_label);
  if (hasRequired && hasUnavailable) {
    return {
      block: true,
      message: `Issue has both ${lp.label} and ${lp.unavailable_label}. Keep one before assigning a coding agent.`,
    };
  }
  if (!hasRequired) return { block: false };

  const ids = extractFindingIds(`${title || ""}\n${body || ""}`);
  if (ids.length === 0) {
    return {
      block: true,
      message:
        "Live proof is required but the issue has no finding id. Add `Finding-Id: VULN-001` to the issue body.",
    };
  }

  const files = beforeBodies || {};
  for (const id of ids) {
    const rel = recordingPath(lp.evidence_dir, id, "before.md");
    if (!verdictIs(files[id], lp.before_verdict)) {
      return {
        block: true,
        id,
        message:
          `${rel} with \`verdict: ${lp.before_verdict}\` is not on the base branch. ` +
          "The coding agent waits until that recording is merged. It does not run the live check.",
      };
    }
  }
  return { block: false, id: ids[0] };
}
