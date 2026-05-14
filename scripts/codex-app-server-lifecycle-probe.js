#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 120000;

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function tailText(text, maxLength = 1600) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function textInput(text) {
  return [{ type: "text", text, text_elements: [] }];
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createJsonRpcError(error) {
  const rpcError = new Error(error?.message || JSON.stringify(error));
  rpcError.code = error?.code;
  rpcError.data = error?.data;
  rpcError.jsonRpcError = error;
  return rpcError;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class JsonLineClient {
  constructor({ codexBin, timeoutMs }) {
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.buffer = "";
    this.stdout = "";
    this.stderr = "";
    this.notifications = [];
    this.malformedLines = [];
    this.pending = new Map();
    this.waiters = [];
    this.closed = false;
    this.exit = null;
    this.exitDeferred = createDeferred();
    this.child = spawn(codexBin, ["app-server", "--listen", "stdio://"], {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.child.on("error", (error) => {
      this.stderr += `${error.message}\n`;
      this.rejectOpenWork(error);
      this.exitDeferred.resolve({ code: null, signal: null, error: error.message });
    });
    this.child.on("exit", (code, signal) => {
      this.exit = { code, signal };
      this.rejectOpenWork(new Error(`codex app-server exited with code ${code ?? "null"} and signal ${signal ?? "null"}`));
      this.exitDeferred.resolve(this.exit);
    });
  }

  rejectOpenWork(error) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const waiter of this.waiters) waiter.reject(error);
    this.waiters = [];
  }

  handleStdout(chunk) {
    this.stdout += chunk;
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line) this.handleLine(line);
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.malformedLines.push(line);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(createJsonRpcError(message.error));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    this.notifications.push(message);
    const remaining = [];
    for (const waiter of this.waiters) {
      if (waiter.predicate(message)) {
        waiter.resolve(message);
      } else {
        remaining.push(waiter);
      }
    }
    this.waiters = remaining;
  }

  request(method, params) {
    if (this.closed) throw new Error("codex app-server is closed");
    const id = this.nextId;
    this.nextId += 1;
    const pending = createDeferred();
    this.pending.set(id, pending);
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return withTimeout(pending.promise, this.timeoutMs, method);
  }

  notify(method, params = undefined) {
    if (this.closed) throw new Error("codex app-server is closed");
    const message = params === undefined ? { method } : { method, params };
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  waitForNotification(predicate, label) {
    const existing = this.notifications.find(predicate);
    if (existing) return Promise.resolve(existing);
    const waiter = createDeferred();
    waiter.predicate = predicate;
    this.waiters.push(waiter);
    return withTimeout(waiter.promise, this.timeoutMs, label);
  }

  async closeAndWait() {
    if (this.child.exitCode === null && !this.child.killed) {
      this.child.kill("SIGTERM");
    }
    const exit = await withTimeout(this.exitDeferred.promise, 5000, "codex app-server shutdown");
    return {
      ok: exit.signal === "SIGTERM" || exit.code === 0 || exit.code === null,
      exit
    };
  }
}

async function expectProtocolError(client) {
  try {
    await client.request("switchboard/unsupported-lifecycle-probe", {});
    return { ok: false, message: "unsupported method unexpectedly succeeded" };
  } catch (error) {
    if (error.code === -32601) {
      return { ok: true, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: error.code ?? null,
      message: `unsupported method did not return JSON-RPC method-not-found error: ${error.message}`
    };
  }
}

async function runCompletedTurn(client, { threadId, label, cwd }) {
  const response = await client.request("turn/start", {
    threadId,
    input: textInput(`Do not edit files or run commands. Reply with exactly: ${label} lifecycle complete.`),
    model: "gpt-5.4-mini",
    cwd
  });
  const turnId = response?.turn?.id;
  if (!turnId) throw new Error(`${label} turn/start completed without a turn id`);
  const completed = await client.waitForNotification(
    (message) => message.method === "turn/completed" && message.params?.turn?.id === turnId,
    `${label} turn/completed`
  );
  return {
    ok: Boolean(completed),
    turnId,
    status: completed?.params?.turn?.status || response?.turn?.status || null
  };
}

async function runInterruptedTurn(client, { threadId, cwd }) {
  const response = await client.request("turn/start", {
    threadId,
    input: textInput("Do not edit files or run commands. Wait briefly, then say interrupted lifecycle complete."),
    model: "gpt-5.4-mini",
    cwd
  });
  const turnId = response?.turn?.id;
  if (!turnId) throw new Error("interrupt turn/start completed without a turn id");
  try {
    await client.waitForNotification(
      (message) => message.method === "turn/started" && message.params?.turn?.id === turnId,
      "interrupt turn/started"
    );
    const interrupt = await client.request("turn/interrupt", { threadId, turnId });
    const completion = await client.waitForNotification(
      (message) => message.method === "turn/completed" && message.params?.turn?.id === turnId,
      "interrupted turn/completed"
    );
    return {
      ok: true,
      turnId,
      interrupt,
      status: completion?.params?.turn?.status || null
    };
  } catch (error) {
    return {
      ok: false,
      turnId,
      error: error.message
    };
  }
}

export async function runCodexAppServerLifecycleProbe({
  codexBin = "codex",
  cwd = process.cwd(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  includeInterrupt = true
} = {}) {
  const client = new JsonLineClient({ codexBin, timeoutMs });
  const checks = {};
  try {
    checks.initialize = {
      ok: Boolean(
        await client.request("initialize", {
          clientInfo: {
            name: "switchboard-codex-app-server-lifecycle-probe",
            title: "Switchboard Codex app-server lifecycle probe",
            version: "0.0.0"
          },
          capabilities: { experimentalApi: true }
        })
      )
    };
    client.notify("initialized");

    checks.protocolError = await expectProtocolError(client);

    const threadStart = await client.request("thread/start", {
      model: "gpt-5.4-mini",
      cwd,
      approvalPolicy: "never",
      sandbox: "read-only"
    });
    const threadId = threadStart?.thread?.id || null;
    checks.threadStart = {
      ok: Boolean(threadId),
      threadId,
      sessionId: threadStart?.thread?.sessionId || null
    };
    if (!threadId) throw new Error("thread/start completed without a thread id");

    checks.firstTurn = await runCompletedTurn(client, { threadId, label: "first", cwd });
    checks.secondTurn = includeInterrupt
      ? await runInterruptedTurn(client, { threadId, cwd })
      : await runCompletedTurn(client, { threadId, label: "second", cwd });

    checks.stderrWarnings = {
      ok: true,
      observed: Boolean(client.stderr.trim()),
      stderrTail: tailText(client.stderr)
    };
    checks.malformedJson = {
      ok: true,
      ignoredLineCount: client.malformedLines.length
    };
  } catch (error) {
    checks.runtimeError = {
      ok: false,
      message: error.message
    };
  } finally {
    checks.shutdown = await client.closeAndWait().catch((error) => ({ ok: false, error: error.message }));
  }

  const required = [
    checks.initialize,
    checks.protocolError,
    checks.threadStart,
    checks.firstTurn,
    checks.secondTurn,
    checks.stderrWarnings,
    checks.malformedJson,
    checks.shutdown
  ].filter(Boolean);
  const verified = required.every((check) => check.ok) && !checks.runtimeError;
  return {
    status: verified ? "verified" : "blocked",
    surface: "codex-app-server-lifecycle",
    mode: "live_app_server_lifecycle",
    checks,
    notificationCounts: client.notifications.reduce((counts, message) => {
      counts[message.method] = (counts[message.method] || 0) + 1;
      return counts;
    }, {}),
    evidence: {
      command: `${codexBin} app-server --listen stdio://`,
      interpretation:
        "Switchboard can own the app-server process lifecycle when startup, turn execution, protocol errors, stderr, malformed output, interruption or shutdown, and process exit produce bounded outcomes."
    },
    limitations: [
      "The generated app-server protocol is experimental.",
      "Live malformed-output and crash behavior are covered by deterministic fake app-server tests; the real app-server should not normally emit malformed JSON or crash on demand."
    ],
    stderrTail: tailText(client.stderr),
    stdoutTail: tailText(client.stdout)
  };
}

async function main() {
  const args = process.argv.slice(2);
  const codexBin = getArg(args, "--codex-bin") || "codex";
  const cwd = getArg(args, "--cwd") || process.cwd();
  const timeoutMs = Number(getArg(args, "--timeout-ms") || DEFAULT_TIMEOUT_MS);
  const includeInterrupt = !args.includes("--no-interrupt");
  const result = await runCodexAppServerLifecycleProbe({ codexBin, cwd, timeoutMs, includeInterrupt });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "verified" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`codex-app-server-lifecycle-probe failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
