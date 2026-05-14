import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCodexAppServerPreflight, parseCodexVersion, compareVersions } from "../scripts/codex-app-server-preflight.js";

function makeFakeCodex({ version = "0.130.0", auth = "authenticated", appServer = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-server-preflight-test-"));
  const bin = path.join(dir, "codex");
  const source = `#!/usr/bin/env node
const appServer = ${JSON.stringify(appServer)};
const auth = ${JSON.stringify(auth)};
const args = process.argv.slice(2);
if (args.join(" ") === "--version") {
  console.log("codex-cli ${version}");
  process.exit(0);
}
if (args.join(" ") === "app-server --help") {
  if (!appServer) {
    console.error("unrecognized subcommand app-server");
    process.exit(2);
  }
  console.log("[experimental] Run the app server or related tooling");
  console.log("Usage: codex app-server [OPTIONS] [COMMAND]");
  process.exit(0);
}
if (args.join(" ") === "login status") {
  if (auth === "authenticated") {
    console.log("Logged in using ChatGPT");
    process.exit(0);
  }
  console.error("Not logged in");
  process.exit(1);
}
if (args.join(" ") === "app-server --listen stdio://") {
  if (!appServer) process.exit(2);
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf("\\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) handle(JSON.parse(line));
      newline = buffer.indexOf("\\n");
    }
  });
  function write(id, result) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
  }
  function handle(message) {
    if (!message.id) return;
    if (message.method === "initialize") write(message.id, {});
    if (message.method === "getAuthStatus") {
      write(message.id, auth === "authenticated"
        ? { authMethod: "chatgpt", authToken: null, requiresOpenaiAuth: false }
        : { authMethod: null, authToken: null, requiresOpenaiAuth: true });
    }
    if (message.method === "account/read") {
      write(message.id, auth === "authenticated"
        ? { account: { type: "chatgpt", email: "person@example.com", planType: "plus" }, requiresOpenaiAuth: false }
        : { account: null, requiresOpenaiAuth: true });
    }
  }
  return;
}
console.error("unexpected args: " + args.join(" "));
process.exit(2);
`;
  fs.writeFileSync(bin, source, { encoding: "utf8", mode: 0o755 });
  return bin;
}

test("parses and compares Codex CLI versions", () => {
  assert.deepEqual(parseCodexVersion("codex-cli 0.130.0"), [0, 130, 0]);
  assert.equal(parseCodexVersion("not codex"), null);
  assert.equal(compareVersions([0, 130, 1], [0, 130, 0]), 1);
  assert.equal(compareVersions([0, 130, 0], [0, 130, 0]), 0);
  assert.equal(compareVersions([0, 129, 9], [0, 130, 0]), -1);
});

test("preflight verifies a normal Codex install with app-server auth", async () => {
  const result = await runCodexAppServerPreflight({
    codexBin: makeFakeCodex(),
    timeoutMs: 5000
  });

  assert.equal(result.status, "verified");
  assert.equal(result.checks.version.actual, "0.130.0");
  assert.equal(result.checks.appServerCommand.ok, true);
  assert.equal(result.checks.loginStatusCommand.ok, true);
  assert.equal(result.checks.appServerAuth.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.checks.appServerAuth.accountStatus.account.email, "[redacted]");
});

test("preflight fails clearly when Codex CLI is too old", async () => {
  const result = await runCodexAppServerPreflight({
    codexBin: makeFakeCodex({ version: "0.129.0" }),
    timeoutMs: 5000
  });

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics[0].code, "codex-too-old");
  assert.match(result.diagnostics[0].action, /Update Codex CLI/);
});

test("preflight fails clearly when app-server auth is missing", async () => {
  const result = await runCodexAppServerPreflight({
    codexBin: makeFakeCodex({ auth: "missing" }),
    timeoutMs: 5000
  });

  assert.equal(result.status, "failed");
  assert.equal(result.checks.appServerAuth.ok, false);
  assert.equal(result.diagnostics.at(-1).code, "codex-unauthenticated");
  assert.match(result.diagnostics.at(-1).action, /codex login/);
});

test("preflight fails clearly when app-server is unavailable", async () => {
  const result = await runCodexAppServerPreflight({
    codexBin: makeFakeCodex({ appServer: false }),
    timeoutMs: 5000
  });

  assert.equal(result.status, "failed");
  assert.equal(result.checks.appServerCommand.ok, false);
  assert.equal(result.diagnostics.at(-1).code, "app-server-unavailable");
});
