#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const DEFAULT_MIN_VERSION = "0.130.0";
const DEFAULT_TIMEOUT_MS = 30000;

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function tailText(text, maxLength = 1600) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function redact(value) {
  if (typeof value === "string") {
    if (value.includes("@")) return "[redacted-email]";
    if (value.length > 16) return "[redacted]";
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/token|email|accountId|userId/i.test(key)) return [key, entry == null ? entry : "[redacted]"];
      return [key, redact(entry)];
    })
  );
}

export function parseCodexVersion(output) {
  const match = String(output).match(/codex-cli\s+(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1, 4).map((part) => Number(part));
}

export function compareVersions(actual, minimum) {
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] > minimum[i]) return 1;
    if (actual[i] < minimum[i]) return -1;
  }
  return 0;
}

function formatVersion(version) {
  return Array.isArray(version) ? version.join(".") : null;
}

function runCommand(command, args, { timeoutMs, input = null }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        ok: false,
        code: null,
        signal: "timeout",
        stdout,
        stderr,
        error: `${command} ${args.join(" ")} timed out after ${timeoutMs}ms`
      });
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, signal: null, stdout, stderr, error: error.message });
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, signal, stdout, stderr, error: null });
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
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
    this.pending = new Map();
    this.closed = false;
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
    this.child.on("error", (error) => this.rejectOpenWork(error));
    this.child.on("exit", (code, signal) => {
      this.rejectOpenWork(
        new Error(
          `codex app-server exited with code ${code ?? "null"} and signal ${signal ?? "null"}: ${tailText(this.stderr)}`
        )
      );
    });
  }

  rejectOpenWork(error) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
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
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(message, "id")) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(JSON.stringify(message.error)));
    } else {
      pending.resolve(message.result);
    }
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

  close() {
    if (this.child.exitCode !== null || this.child.killed) return;
    this.child.kill("SIGTERM");
  }
}

function diagnostic(code, message, action) {
  return { code, message, action };
}

async function checkAppServerAuth({ codexBin, timeoutMs }) {
  const client = new JsonLineClient({ codexBin, timeoutMs });
  try {
    await client.request("initialize", {
      clientInfo: {
        name: "switchboard-codex-app-server-preflight",
        title: "Switchboard Codex App Server Preflight",
        version: "0.0.0"
      },
      capabilities: { experimentalApi: true }
    });
    client.notify("initialized");
    const authStatus = await client.request("getAuthStatus", {
      includeToken: false,
      refreshToken: false
    });
    const accountStatus = await client.request("account/read", {
      refreshToken: false
    });
    return {
      ok: Boolean(authStatus?.authMethod || accountStatus?.account),
      authStatus: redact(authStatus),
      accountStatus: redact(accountStatus),
      stderrTail: tailText(client.stderr)
    };
  } finally {
    client.close();
  }
}

export async function runCodexAppServerPreflight({
  codexBin = "codex",
  minVersion = DEFAULT_MIN_VERSION,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const minimumVersion = parseCodexVersion(`codex-cli ${minVersion}`);
  const checks = {};
  const diagnostics = [];

  const versionResult = await runCommand(codexBin, ["--version"], { timeoutMs });
  const actualVersion = parseCodexVersion(versionResult.stdout || versionResult.stderr);
  checks.version = {
    ok: versionResult.ok && Boolean(actualVersion) && compareVersions(actualVersion, minimumVersion) >= 0,
    command: `${codexBin} --version`,
    required: minVersion,
    actual: formatVersion(actualVersion),
    stderrTail: tailText(versionResult.stderr)
  };
  if (!versionResult.ok) {
    diagnostics.push(
      diagnostic(
        "codex-missing",
        "Codex CLI could not be executed.",
        "Install Codex CLI and ensure `codex` is on PATH before starting Switchboard's Codex app-server path."
      )
    );
  } else if (!actualVersion) {
    diagnostics.push(
      diagnostic("codex-version-unreadable", "Codex CLI version output was not recognized.", "Run `codex --version` and verify it reports `codex-cli x.y.z`.")
    );
  } else if (!checks.version.ok) {
    diagnostics.push(
      diagnostic(
        "codex-too-old",
        `Codex CLI ${checks.version.actual} is older than the validated minimum ${minVersion}.`,
        "Update Codex CLI before using Switchboard's Codex app-server path."
      )
    );
  }

  const appServerHelp = await runCommand(codexBin, ["app-server", "--help"], { timeoutMs });
  checks.appServerCommand = {
    ok: appServerHelp.ok && appServerHelp.stdout.includes("app-server"),
    command: `${codexBin} app-server --help`,
    experimental: appServerHelp.stdout.includes("[experimental]"),
    stderrTail: tailText(appServerHelp.stderr)
  };
  if (!checks.appServerCommand.ok) {
    diagnostics.push(
      diagnostic(
        "app-server-unavailable",
        "Codex CLI did not expose the app-server command.",
        "Install a Codex CLI build that includes `codex app-server`; the spike is validated against codex-cli 0.130.0."
      )
    );
  }

  const loginStatus = await runCommand(codexBin, ["login", "status"], { timeoutMs });
  checks.loginStatusCommand = {
    ok: loginStatus.ok,
    command: `${codexBin} login status`,
    summary: loginStatus.ok ? tailText(redact(`${loginStatus.stdout}${loginStatus.stderr}`.trim()), 200) : null,
    stderrTail: tailText(loginStatus.stderr)
  };

  if (checks.version.ok && checks.appServerCommand.ok) {
    try {
      const appServerAuth = await checkAppServerAuth({ codexBin, timeoutMs });
      checks.appServerAuth = appServerAuth;
      if (!appServerAuth.ok) {
        diagnostics.push(
          diagnostic(
            "codex-unauthenticated",
            "Codex app-server did not report an authenticated account.",
            "Run `codex login` or `codex login --with-api-key`, then rerun the Switchboard Codex app-server preflight."
          )
        );
      }
    } catch (error) {
      checks.appServerAuth = {
        ok: false,
        error: error.message
      };
      diagnostics.push(
        diagnostic(
          "app-server-auth-check-failed",
          "Codex app-server auth check failed before a routed session could start.",
          "Run `codex login status` and `codex app-server --help`; if both look healthy, rerun the preflight with a longer timeout."
        )
      );
    }
  }

  const requiredChecks = [checks.version, checks.appServerCommand, checks.appServerAuth].filter(Boolean);
  const status = diagnostics.length === 0 && requiredChecks.every((check) => check.ok) ? "verified" : "failed";
  return {
    status,
    surface: "codex-app-server-preflight",
    codexBin,
    minVersion,
    checks,
    diagnostics
  };
}

async function main() {
  const args = process.argv.slice(2);
  const codexBin = getArg(args, "--codex-bin") || "codex";
  const minVersion = getArg(args, "--min-version") || DEFAULT_MIN_VERSION;
  const timeoutMs = Number(getArg(args, "--timeout-ms") || DEFAULT_TIMEOUT_MS);
  const result = await runCodexAppServerPreflight({ codexBin, minVersion, timeoutMs });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "verified" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`codex-app-server-preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
