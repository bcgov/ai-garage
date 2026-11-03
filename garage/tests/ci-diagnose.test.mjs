import { check, eq, done } from "./helper.mjs";
import { classifyResidual } from "../scripts/ci-diagnose.mjs";

check("matches a configured residual", () => {
  eq(classifyResidual("Error: SARIF processing failed for codeql", ["SARIF processing"]), "SARIF processing");
});
check("returns null when none match", () => {
  eq(classifyResidual("npm ERR! test failed", ["SARIF processing"]), null);
});
done();
