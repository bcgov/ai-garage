#!/usr/bin/env node
/** Client for the operator-configured, loopback-only Sightline pilot service. */
import { readFileSync } from "node:fs";
import http from "node:http";

function option(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? "" : process.argv[i + 1] || "";
}
function call(method, pathname, payload, port, token) {
  return new Promise((resolve, reject) => {
    const encoded = payload === undefined ? null : Buffer.from(JSON.stringify(payload));
    const request = http.request({ host: "127.0.0.1", port, path: pathname, method, timeout: 5000,
      headers: { Authorization: `Bearer ${token}`, ...(encoded ? { "Content-Type": "application/json", "Content-Length": encoded.length } : {}) } }, (response) => {
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => { size += chunk.length; if (size > 65_536) request.destroy(); else chunks.push(chunk); });
      response.on("error", () => reject(new Error("service response interrupted")));
      response.on("end", () => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (response.statusCode < 200 || response.statusCode >= 300) reject(new Error("service rejected the request"));
          else resolve(result);
        } catch { reject(new Error("invalid service response")); }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => reject(new Error("service unavailable")));
    if (encoded) request.write(encoded);
    request.end();
  });
}

try {
  const port = Number(process.env.GARAGE_SIGHTLINE_PORT);
  const token = process.env.GARAGE_SIGHTLINE_TOKEN || "";
  if (!Number.isInteger(port) || port < 1 || port > 65535 || token.length < 32 || token.length > 256) throw new Error("service port or token is not configured");
  const command = process.argv[2];
  let result;
  if (command === "pending") {
    const bytes = readFileSync(option("event"));
    if (bytes.length > 32_768) throw new Error("event is too large");
    result = await call("POST", "/v1/pending", JSON.parse(bytes.toString("utf8")), port, token);
  } else if (command === "run") {
    const pending_ref = option("pending-ref");
    const request_ref = option("request-ref");
    if (![pending_ref, request_ref].every((ref) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(ref))) throw new Error("invalid record reference");
    result = await call("POST", "/v1/runs", { pending_ref, request_ref }, port, token);
  } else if (command === "status") {
    const id = option("job-id");
    if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("invalid job identifier");
    result = await call("GET", `/v1/runs/${id}`, undefined, port, token);
  } else throw new Error("expected pending, run, or status");
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(`Sightline client stopped: ${error.message}`);
  process.exitCode = 1;
}
