import { check, eq, done } from "./helper.mjs";
import { llmConfigFrom } from "../scripts/lib/llm.mjs";
import { resolveAgentMode } from "../scripts/lib/agent-mode.mjs";

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const base = { llm: { mode: "auto", api_style: "azure-apim", base_url: "https://x.azure-api.net/p/openai/deployments/d", model: "d", api_key_env: "GARAGE_LLM_API_KEY" } };

check("reads GARAGE_LLM_API_KEY", () => {
  withEnv({ GARAGE_LLM_API_KEY: "new", SDLC_LLM_API_KEY: undefined, TIER1_LLM_API_KEY: undefined, OPENAI_API_KEY: undefined }, () => {
    eq(llmConfigFrom(base).apiKey, "new");
  });
});

check("falls back to SDLC_LLM_API_KEY", () => {
  withEnv({ GARAGE_LLM_API_KEY: undefined, SDLC_LLM_API_KEY: "previous", TIER1_LLM_API_KEY: "legacy", OPENAI_API_KEY: undefined }, () => {
    eq(llmConfigFrom(base).apiKey, "previous");
  });
});

check("falls back to TIER1_LLM_API_KEY", () => {
  withEnv({ GARAGE_LLM_API_KEY: undefined, SDLC_LLM_API_KEY: undefined, TIER1_LLM_API_KEY: "legacy", OPENAI_API_KEY: undefined }, () => {
    eq(llmConfigFrom(base).apiKey, "legacy");
  });
});

check("GARAGE_LLM_BASE_URL overrides config", () => {
  withEnv({ GARAGE_LLM_BASE_URL: "https://override/", TIER1_LLM_BASE_URL: undefined }, () => {
    eq(llmConfigFrom(base).baseUrl, "https://override");
  });
});

check("resolveAgentMode auto → heuristic without key, llm with key", () => {
  withEnv({ GARAGE_LLM_API_KEY: undefined, SDLC_LLM_API_KEY: undefined, TIER1_LLM_API_KEY: undefined, OPENAI_API_KEY: undefined, GARAGE_AGENT_MODE: undefined, SDLC_AGENT_MODE: undefined }, () => {
    eq(resolveAgentMode(base), "heuristic");
  });
  withEnv({ GARAGE_LLM_API_KEY: "k", GARAGE_AGENT_MODE: undefined }, () => {
    eq(resolveAgentMode(base), "llm");
  });
});

check("resolveAgentMode gh-aw", () => {
  eq(resolveAgentMode({ llm: { mode: "gh-aw" } }), "gh-aw");
});

done();
