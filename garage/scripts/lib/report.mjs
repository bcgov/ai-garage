import { appendFileSync } from "node:fs";

export class Results {
  constructor() {
    this._items = [];
  }
  ok(id, message) {
    this._items.push({ id, status: "pass", message });
  }
  warn(id, message) {
    this._items.push({ id, status: "warn", message });
  }
  fail(id, message) {
    this._items.push({ id, status: "fail", message });
  }
  merge(other) {
    this._items.push(...other.items);
    return this;
  }
  get items() {
    return this._items;
  }
  failed() {
    return this._items.filter((r) => r.status === "fail");
  }
  warned() {
    return this._items.filter((r) => r.status === "warn");
  }
  status() {
    return this.failed().length ? "FAIL" : this.warned().length ? "WARN" : "PASS";
  }
  exitCode() {
    return this.failed().length ? 1 : 0;
  }
  toConsole(title) {
    console.log(`${title}\n`);
    for (const r of this._items) console.log(`[${r.status.toUpperCase()}] ${r.id}: ${r.message}`);
    console.log(
      `\nSummary: ${this._items.length - this.failed().length - this.warned().length} pass, ${this.warned().length} warn, ${this.failed().length} fail`,
    );
  }
  toMarkdown(title) {
    return [
      `### ${title} · \`${this.status()}\``,
      "",
      "| Status | Check | Message |",
      "| --- | --- | --- |",
      ...this._items.map(
        (r) =>
          `| ${r.status} | \`${r.id}\` | ${String(r.message).replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`,
      ),
      "",
    ].join("\n");
  }
  writeStepSummary(title) {
    if (!process.env.GITHUB_STEP_SUMMARY) return;
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, this.toMarkdown(title) + "\n");
    } catch {
      /* ignore */
    }
  }
}
