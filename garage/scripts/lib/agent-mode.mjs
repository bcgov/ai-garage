/**
 * Resolve SDLC agent backend.
 * Modes: heuristic | llm | gh-aw | auto
 *   auto → llm if API key present, else heuristic
 */
export function resolveAgentMode(cfg) {
  const configured = (cfg.llm?.mode || cfg.agent?.mode || process.env.GARAGE_AGENT_MODE || process.env.SDLC_AGENT_MODE || "heuristic")
    .toString()
    .toLowerCase();

  if (configured === "gh-aw" || configured === "ghaw") return "gh-aw";
  if (configured === "heuristic" || configured === "rules") return "heuristic";
  if (configured === "llm") return "llm";
  return hasLlmCredentials(cfg) ? "llm" : "heuristic";
}

export function hasLlmCredentials(cfg) {
  const keyEnv = cfg.llm?.api_key_env || "GARAGE_LLM_API_KEY";
  const key =
    process.env[keyEnv] ||
    process.env.GARAGE_LLM_API_KEY ||
    process.env.SDLC_LLM_API_KEY ||
    process.env.TIER1_LLM_API_KEY ||
    process.env.OPENAI_API_KEY;
  return Boolean(key && String(key).trim());
}

export function skipIfGhAw(mode, jobName) {
  if (mode === "gh-aw") {
    console.log(
      `Skipping Actions job "${jobName}" — llm.mode is gh-aw. Use compiled .lock.yml workflows from .github/workflows/garage-*.md`,
    );
    return true;
  }
  return false;
}
