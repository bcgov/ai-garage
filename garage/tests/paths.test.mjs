import { check, eq, done } from "./helper.mjs";
import { matchesPrefix, anyMatch, normalize } from "../scripts/lib/paths.mjs";

check("normalize converts backslashes and strips ./", () => {
  eq(normalize(".\\src\\a.ts"), "src/a.ts");
  eq(normalize("./docs/x.md"), "docs/x.md");
});

check("matchesPrefix handles dir prefixes with and without trailing slash", () => {
  eq(matchesPrefix("src/a.ts", ["src/"]), true);
  eq(matchesPrefix("src/a.ts", ["src"]), true);
  eq(matchesPrefix("srcx/a.ts", ["src/"]), false);
  eq(matchesPrefix("README.md", ["README.md"]), true);
});

check("anyMatch over file list", () => {
  eq(anyMatch(["docs/a.md", "src/b.ts"], ["src/"]), true);
  eq(anyMatch(["docs/a.md"], ["src/"]), false);
  eq(anyMatch([], ["src/"]), false);
});

done();
