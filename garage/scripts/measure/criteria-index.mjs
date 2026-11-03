import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export function buildCriteriaIndex(root = ".") {
  const dir = path.join(root, "spec/features");
  const criteria = [];
  if (!existsSync(dir)) return { generatedAt: new Date().toISOString(), criteria };

  for (const file of readdirSync(dir).filter((name) => name.endsWith(".feature"))) {
    const lines = readFileSync(path.join(dir, file), "utf8").split("\n");
    let pendingTags = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        if (trimmed.startsWith("#")) pendingTags = [];
        continue;
      }
      if (/^@[\w:-]+/.test(trimmed)) {
        pendingTags.push(...trimmed.split(/\s+/).filter((tag) => tag.startsWith("@")));
        continue;
      }
      const scenario = line.match(/^\s*Scenario(?: Outline)?:\s*(.+)$/);
      if (scenario) {
        const idTag = pendingTags.find((tag) => /^@R-\d+\.\d+$/.test(tag));
        const tierTag = pendingTags.find((tag) => /^@tier:/i.test(tag));
        if (idTag) {
          criteria.push({
            id: idTag.slice(1),
            feature: `spec/features/${file}`,
            scenario: scenario[1].trim(),
            tier: tierTag ? tierTag.replace(/^@tier:/i, "").toLowerCase() : null,
          });
        }
        pendingTags = [];
      } else if (!trimmed.startsWith("@")) {
        pendingTags = [];
      }
    }
  }
  return { generatedAt: new Date().toISOString(), criteria };
}

export function writeCriteriaIndex(root = ".", outRel = "spec/criteria-index.json") {
  const index = buildCriteriaIndex(root);
  const outPath = path.join(root, outRel);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`);
  return { outPath, index };
}
