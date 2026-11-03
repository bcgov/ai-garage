let passed = 0;
let failed = 0;

export function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

export async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

export function eq(actual, expected, label = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label} expected ${b} got ${a}`);
}

export function throws(fn, re) {
  let msg = null;
  try {
    fn();
  } catch (e) {
    msg = e.message;
  }
  if (msg === null) throw new Error("expected throw");
  if (re && !re.test(msg)) throw new Error(`throw message "${msg}" did not match ${re}`);
}

export function done() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
