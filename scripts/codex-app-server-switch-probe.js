#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/router/router.js";
import { OPENAI_TARGETS_PATH } from "../src/switchboard/paths.js";
import { getProfileModelMap, getTargetProfileMap } from "../src/adapters/model-mappings.js";

const TARGET_TO_PROFILE = getTargetProfileMap("openai-codex");
const PROFILE_TO_MODEL = getProfileModelMap("openai-codex");
const DEFAULT_TIMEOUT_MS = 120000;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function textInput(text) {
  return [{ type: "text", text, text_elements: [] }];
}

function tailText(text, maxLength = 1600) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function routeTurnPlan({ input, session, targets }) {
  const route = routePrompt({
    input,
    session,
    targets,
    executionSupported: false
  });
  const targetId = route.selectedTarget?.id || null;
  const profile = targetId ? TARGET_TO_PROFILE[targetId] || null : null;
  const model = profile ? PROFILE_TO_MODEL[profile] || null : null;
  return {
    input,
    route: {
      status: route.status,
      mode: route.mode,
      selectedTargetId: targetId,
      targetClass: route.selectedTarget?.target_class || null,
      shouldSwitch: route.shouldSwitch,
      explanation: route.explanation
    },
    codex: { profile, model }
  };
}

function createTurnPlans(targets) {
  const session = {
    mode: "plan",
    currentTargetId: null,
    turnCount: 0,
    routingOverride: "auto",
    vendorClient: "openai-codex",
    clientSurface: "codex-app-server"
  };

  const first = routeTurnPlan({
    input:
      "Do not edit files or run commands. Briefly outline how you would implement retry logic with clear tests and error handling. End with one short sentence saying first turn complete.",
    session,
    targets
  });
  if (first.route.status === "ok") {
    session.mode = first.route.mode;
    session.currentTargetId = first.route.selectedTargetId;
    session.turnCount += 1;
  }

  const second = routeTurnPlan({
    input: "Thanks, summarize the outcome briefly.",
    session,
    targets
  });
  return [first, second];
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
    this.notifications = [];
    this.pending = new Map();
    this.waiters = [];
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
    this.child.on("error", (error) => {
      this.stderr += `${error.message}\n`;
      this.rejectOpenWork(error);
    });
    this.child.on("exit", (code, signal) => {
      this.rejectOpenWork(new Error(`codex app-server exited with code ${code ?? "null"} and signal ${signal ?? "null"}`));
    });
  }

  rejectOpenWork(error) {
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
      return;
    }

    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
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

  close() {
    if (this.child.exitCode !== null || this.child.killed) return;
    this.child.kill("SIGTERM");
  }
}

function summarizeTurn({ label, plan, response, completedNotification, messages }) {
  return {
    label,
    selectedTargetId: plan.route.selectedTargetId,
    selectedProfile: plan.codex.profile,
    requestedModel: plan.codex.model,
    turnId: response?.turn?.id || completedNotification?.params?.turn?.id || null,
    completed: Boolean(completedNotification),
    agentMessages: messages
  };
}

function collectAgentMessages(notifications, turnId) {
  return notifications
    .filter((message) => message.method === "item/completed" && message.params?.turnId === turnId)
    .map((message) => message.params?.item)
    .filter((item) => item?.type === "agentMessage" && typeof item.text === "string")
    .map((item) => item.text);
}

async function runTurn(client, { label, threadId, plan, cwd }) {
  const response = await client.request("turn/start", {
    threadId,
    input: textInput(plan.input),
    model: plan.codex.model,
    cwd
  });
  const turnId = response?.turn?.id;
  if (!turnId) {
    throw new Error(`${label} turn/start completed without a turn id`);
  }
  const completedNotification = await client.waitForNotification(
    (message) => message.method === "turn/completed" && message.params?.threadId === threadId && message.params?.turn?.id === turnId,
    `${label} turn/completed`
  );
  const messages = collectAgentMessages(client.notifications, turnId);
  return summarizeTurn({ label, plan, response, completedNotification, messages });
}

async function maybeReadThread(client, threadId) {
  try {
    const result = await client.request("thread/read", { threadId, includeTurns: true });
    return {
      ok: true,
      turnCount: Array.isArray(result?.thread?.turns) ? result.thread.turns.length : null,
      itemCount: Array.isArray(result?.thread?.items) ? result.thread.items.length : null
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function runCodexAppServerSwitchProbe({
  codexBin = "codex",
  targets = readJson(OPENAI_TARGETS_PATH).targets,
  cwd = process.cwd(),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const [first, second] = createTurnPlans(targets);
  const targetChanged = Boolean(
    first.route.selectedTargetId &&
      second.route.selectedTargetId &&
      first.route.selectedTargetId !== second.route.selectedTargetId
  );
  const modelChanged = Boolean(first.codex.model && second.codex.model && first.codex.model !== second.codex.model);

  if (!targetChanged || !modelChanged) {
    return {
      status: "blocked",
      surface: "codex-app-server",
      reason: "The router did not produce two different Codex targets/models for the app-server switch probe.",
      turnPlans: [first, second]
    };
  }

  const client = new JsonLineClient({ codexBin, timeoutMs });
  try {
    const initialize = await client.request("initialize", {
      clientInfo: {
        name: "switchboard-codex-app-server-spike",
        title: "Switchboard Codex app-server spike",
        version: "0.0.0"
      },
      capabilities: { experimentalApi: true }
    });
    client.notify("initialized");

    const threadStart = await client.request("thread/start", {
      model: first.codex.model,
      cwd,
      approvalPolicy: "never",
      sandbox: "read-only"
    });
    const threadId = threadStart?.thread?.id || null;
    const sessionId = threadStart?.thread?.sessionId || null;

    if (!threadId) {
      return {
        status: "blocked",
        surface: "codex-app-server",
        reason: "thread/start completed without a thread id.",
        initialize,
        threadStart
      };
    }

    const firstTurn = await runTurn(client, { label: "first", threadId, plan: first, cwd });
    const secondTurn = await runTurn(client, { label: "second", threadId, plan: second, cwd });
    const threadRead = await maybeReadThread(client, threadId);

    const sameThreadCompleted = firstTurn.completed && secondTurn.completed;
    const requestedModelOverrideAccepted = secondTurn.requestedModel === second.codex.model && sameThreadCompleted;
    const modelRerouted = client.notifications.filter((message) => message.method === "model/rerouted");
    const status = requestedModelOverrideAccepted ? "verified" : "partial";

    return {
      status,
      surface: "codex-app-server",
      mode: "live_app_server",
      verdict: {
        appServerModelOverrideAccepted: requestedModelOverrideAccepted,
        sameThreadCompleted,
        targetChanged,
        modelChanged,
        backendModelTelemetryObserved: modelRerouted.length > 0,
        interactiveTuiHotSwapProven: false
      },
      thread: {
        threadId,
        sessionId,
        threadStartModel: threadStart.model || first.codex.model,
        threadStartModelProvider: threadStart.modelProvider || null
      },
      turns: [firstTurn, secondTurn],
      threadRead,
      modelRerouted,
      notificationCounts: client.notifications.reduce((counts, message) => {
        counts[message.method] = (counts[message.method] || 0) + 1;
        return counts;
      }, {}),
      evidence: {
        command: `${codexBin} app-server --listen stdio://`,
        interpretation:
          "Codex app-server accepted a second turn/start model override on the same thread. This is in-session app-server evidence, not proof of an interactive TUI hot-swap hook."
      },
      limitations: [
        "The generated app-server protocol is experimental.",
        "The probe verifies accepted turn-level model override requests and same-thread completion, but it does not currently observe provider-side backend model telemetry unless Codex emits model/rerouted.",
        "This does not prove that the Codex interactive TUI itself can be hot-swapped."
      ],
      stderrTail: tailText(client.stderr),
      stdoutTail: tailText(client.stdout)
    };
  } catch (error) {
    return {
      status: "blocked",
      surface: "codex-app-server",
      reason: error.message,
      turnPlans: [first, second],
      stderrTail: tailText(client.stderr),
      stdoutTail: tailText(client.stdout)
    };
  } finally {
    client.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const codexBin = getArg(args, "--codex-bin") || "codex";
  const cwd = getArg(args, "--cwd") || process.cwd();
  const timeoutMs = Number(getArg(args, "--timeout-ms") || DEFAULT_TIMEOUT_MS);
  const result = await runCodexAppServerSwitchProbe({ codexBin, cwd, timeoutMs });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "blocked" ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`codex-app-server-switch-probe failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
