import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCodexAppServerLifecycleProbe } from "../scripts/codex-app-server-lifecycle-probe.js";

function createFakeCodexBin({ crashOnTurn = false, ignoreUnsupportedMethod = false, signalOnTurn = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-server-lifecycle-test-"));
  const binPath = path.join(dir, "codex");
  fs.writeFileSync(
    binPath,
    `#!/usr/bin/env node
const readline = require("node:readline");

let nextTurn = 1;
const thread = { id: "thread-life", sessionId: "session-life", turns: [] };

function write(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}

function respond(id, result) {
  write({ jsonrpc: "2.0", id, result });
}

if (process.argv.slice(2).join(" ") !== "app-server --listen stdio://") {
  process.exit(2);
}

process.stderr.write("fake stderr warning\\n");
process.stdout.write("not-json-from-server\\n");

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    respond(message.id, { userAgent: "fake-codex" });
    return;
  }
  if (message.method === "initialized") return;
  if (message.method === "switchboard/unsupported-lifecycle-probe") {
    if (${JSON.stringify(ignoreUnsupportedMethod)}) return;
    write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "method not found" } });
    return;
  }
  if (message.method === "thread/start") {
    respond(message.id, { thread, model: message.params.model, modelProvider: "openai" });
    write({ method: "thread/started", params: { thread } });
    return;
  }
  if (message.method === "turn/start") {
    if (${JSON.stringify(signalOnTurn)}) {
      process.stderr.write("simulated app-server signal exit\\n");
      process.kill(process.pid, ${JSON.stringify(signalOnTurn)});
      return;
    }
    if (${JSON.stringify(crashOnTurn)}) {
      process.stderr.write("simulated app-server crash\\n");
      process.exit(7);
    }
    const turn = { id: "turn-" + nextTurn++, status: "inProgress" };
    thread.turns.push(turn);
    respond(message.id, { turn });
    write({ method: "turn/started", params: { threadId: message.params.threadId, turn } });
    if (turn.id === "turn-1") {
      const completed = { ...turn, status: "completed" };
      write({ method: "turn/completed", params: { threadId: message.params.threadId, turn: completed } });
    }
    return;
  }
  if (message.method === "turn/interrupt") {
    respond(message.id, {});
    const interrupted = { id: message.params.turnId, status: "interrupted" };
    write({ method: "turn/completed", params: { threadId: message.params.threadId, turn: interrupted } });
    return;
  }
  respond(message.id, {});
});
`,
    "utf8"
  );
  fs.chmodSync(binPath, 0o755);
  return binPath;
}

test("lifecycle probe verifies process ownership and recovery signals", async () => {
  const result = await runCodexAppServerLifecycleProbe({
    codexBin: createFakeCodexBin(),
    timeoutMs: 5000
  });

  assert.equal(result.status, "verified");
  assert.equal(result.checks.initialize.ok, true);
  assert.equal(result.checks.protocolError.ok, true);
  assert.equal(result.checks.protocolError.code, -32601);
  assert.equal(result.checks.threadStart.threadId, "thread-life");
  assert.equal(result.checks.firstTurn.status, "completed");
  assert.equal(result.checks.secondTurn.status, "interrupted");
  assert.equal(result.checks.stderrWarnings.observed, true);
  assert.equal(result.checks.malformedJson.ignoredLineCount, 1);
  assert.equal(result.checks.shutdown.ok, true);
});

test("lifecycle probe does not accept protocol-error timeouts as method-not-found", async () => {
  const result = await runCodexAppServerLifecycleProbe({
    codexBin: createFakeCodexBin({ ignoreUnsupportedMethod: true }),
    timeoutMs: 3000
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.protocolError.ok, false);
  assert.equal(result.checks.protocolError.code, null);
  assert.match(result.checks.protocolError.message, /did not return JSON-RPC method-not-found error/);
  assert.match(result.checks.protocolError.message, /timed out/);
});

test("lifecycle probe reports app-server crash without hanging", async () => {
  const result = await runCodexAppServerLifecycleProbe({
    codexBin: createFakeCodexBin({ crashOnTurn: true }),
    timeoutMs: 5000
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.runtimeError.ok, false);
  assert.match(result.checks.runtimeError.message, /exited with code 7/);
  assert.match(result.stderrTail, /simulated app-server crash/);
  assert.equal(result.checks.shutdown.ok, false);
  assert.equal(result.checks.shutdown.exit.code, 7);
});

test("lifecycle probe reports signal-only app-server exits as failed shutdowns", async () => {
  const result = await runCodexAppServerLifecycleProbe({
    codexBin: createFakeCodexBin({ signalOnTurn: "SIGKILL" }),
    timeoutMs: 5000
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.runtimeError.ok, false);
  assert.match(result.checks.runtimeError.message, /signal SIGKILL/);
  assert.match(result.stderrTail, /simulated app-server signal exit/);
  assert.equal(result.checks.shutdown.ok, false);
  assert.equal(result.checks.shutdown.exit.code, null);
  assert.equal(result.checks.shutdown.exit.signal, "SIGKILL");
});

test("lifecycle probe reports child process spawn failure", async () => {
  const result = await runCodexAppServerLifecycleProbe({
    codexBin: path.join(os.tmpdir(), "missing-codex-for-lifecycle"),
    timeoutMs: 1000
  });

  assert.equal(result.status, "blocked");
  assert.match(result.checks.runtimeError.message, /ENOENT|spawn/);
  assert.equal(result.checks.shutdown.ok, true);
});
