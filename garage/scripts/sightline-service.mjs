#!/usr/bin/env node
/** Private loopback service; production hosting and authentication are separate. */
import { readFileSync } from "node:fs";
import { createService } from "./sightline/service.mjs";

try {
  if (process.argv.length !== 4 || process.argv[2] !== "--config") throw new Error("usage: sightline-service.mjs --config <file>");
  if (typeof process.getuid !== "function" || process.getuid() === 0 || process.getgid() === 0) throw new Error("a non-root POSIX user is required");
  const config = JSON.parse(readFileSync(process.argv[3], "utf8"));
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("invalid port");
  const server = createService({ config, token: process.env.GARAGE_SIGHTLINE_TOKEN });
  server.once("error", () => { console.error("Sightline service could not listen on loopback."); process.exitCode = 1; });
  for (const name of ["SIGINT", "SIGTERM"]) process.once(name, () => server.close());
  server.listen(config.port, "127.0.0.1", () => console.log(`Sightline service listening on loopback port ${config.port}`));
} catch (error) {
  console.error(`Sightline service did not start: ${error.message}`);
  process.exitCode = 1;
}
