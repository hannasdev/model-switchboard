import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCodexAppServerSwitchProbe } from "../scripts/codex-app-server-switch-probe.js";

function createTargets() {
  return [
    {
      id: "openai-quick",
      label: "quick",
      target_class: "cheap_fast",
      capabilities: ["chat", "structured_output"],
      privacy_tier: "external",
      availability: "available"
    },
    {
      id: "openai-coder",
      label: "best coder",
      target_class: "strong_coding",
      capabilities: [
        "chat",
        "reasoning",
        "structured_output",
        "repo_context",
        "file_read",
        "file_edit",
        "shell_execution",
        "test_execution"
      ],
      privacy_tier: "external",
      availability: "available"
    }
  ];
}

function createFakeCodexBin({ omitThreadStartModel = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-server-probe-test-"));
  const binPath = path.join(dir, "codex");
  fs.writeFileSync(
    binPath,
    `#!/usr/bin/env node
const readline = require("node:readline");

let nextTurn = 1;
const thread = {
  id: "thread-123",
  sessionId: "session-abc",
  turns: []
};

function write(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}

function respond(id, result) {
  write({ jsonrpc: "2.0", id, result });
}

function makeTurn(model) {
  return { id: "turn-" + nextTurn++, status: "completed", model };
}

if (process.argv.slice(2).join(" ") !== "app-server --listen stdio://") {
  process.exit(2);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    respond(message.id, { userAgent: "fake-codex", codexHome: "/tmp/fake-codex", platformFamily: "unix", platformOs: "macos" });
    return;
  }
  if (message.method === "initialized") return;
  if (message.method === "thread/start") {
    respond(message.id, {
      thread,
      ...(${JSON.stringify(omitThreadStartModel)} ? {} : { model: message.params.model }),
      modelProvider: "openai",
      serviceTier: null,
      cwd: message.params.cwd,
      instructionSources: [],
      approvalPolicy: "never",
      approvalsReviewer: "auto",
      sandbox: "read-only",
      reasoningEffort: null
    });
    write({ method: "thread/started", params: { thread } });
    return;
  }
  if (message.method === "turn/start") {
    const turn = makeTurn(message.params.model);
    thread.turns.push(turn);
    respond(message.id, { turn });
    write({ method: "turn/started", params: { threadId: message.params.threadId, turn } });
    if (turn.id === "turn-2") {
      write({
        method: "model/rerouted",
        params: {
          threadId: message.params.threadId,
          turnId: turn.id,
          fromModel: "gpt-5.5",
          toModel: message.params.model,
          reason: "highRiskCyberActivity"
        }
      });
    }
    write({
      method: "item/completed",
      params: {
        threadId: message.params.threadId,
        turnId: turn.id,
        completedAtMs: Date.now(),
        item: { type: "agentMessage", id: "item-" + turn.id, text: turn.id + " complete", phase: null, memoryCitation: null }
      }
    });
    write({ method: "turn/completed", params: { threadId: message.params.threadId, turn } });
    return;
  }
  if (message.method === "thread/read") {
    respond(message.id, { thread });
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

test("codex app-server switch probe verifies accepted model override on one thread", async () => {
  const result = await runCodexAppServerSwitchProbe({
    codexBin: createFakeCodexBin(),
    targets: createTargets(),
    timeoutMs: 5000
  });

  assert.equal(result.surface, "codex-app-server");
  assert.equal(result.status, "verified");
  assert.equal(result.verdict.appServerModelOverrideAccepted, true);
  assert.equal(result.verdict.sameThreadCompleted, true);
  assert.equal(result.verdict.targetChanged, true);
  assert.equal(result.verdict.modelChanged, true);
  assert.equal(result.verdict.backendModelTelemetryObserved, true);
  assert.equal(result.verdict.interactiveTuiHotSwapProven, false);
  assert.equal(result.thread.threadId, "thread-123");
  assert.equal(result.thread.sessionId, "session-abc");
  assert.equal(result.thread.requestedThreadStartModel, "gpt-5.5");
  assert.equal(result.thread.threadStartModel, "gpt-5.5");
  assert.equal(result.turns[0].selectedTargetId, "openai-coder");
  assert.equal(result.turns[0].requestedModel, "gpt-5.5");
  assert.equal(result.turns[1].selectedTargetId, "openai-quick");
  assert.equal(result.turns[1].requestedModel, "gpt-5.4-mini");
  assert.deepEqual(result.turns[0].agentMessages, ["turn-1 complete"]);
  assert.deepEqual(result.turns[1].agentMessages, ["turn-2 complete"]);
  assert.equal(result.threadRead.ok, true);
  assert.equal(result.threadRead.turnCount, 2);
  assert.deepEqual(result.modelEvidence.turnPayloadModels, [
    { turnId: "turn-1", source: "turn/start response", model: "gpt-5.5" },
    { turnId: "turn-1", source: "turn/completed notification", model: "gpt-5.5" },
    { turnId: "turn-2", source: "turn/start response", model: "gpt-5.4-mini" },
    { turnId: "turn-2", source: "turn/completed notification", model: "gpt-5.4-mini" }
  ]);
  assert.equal(result.modelEvidence.rerouted.length, 1);
  assert.equal(result.modelEvidence.rerouted[0].params.toModel, "gpt-5.4-mini");
});

test("codex app-server switch probe does not synthesize omitted thread-start model", async () => {
  const result = await runCodexAppServerSwitchProbe({
    codexBin: createFakeCodexBin({ omitThreadStartModel: true }),
    targets: createTargets(),
    timeoutMs: 5000
  });

  assert.equal(result.status, "verified");
  assert.equal(result.thread.requestedThreadStartModel, "gpt-5.5");
  assert.equal(result.thread.threadStartModel, null);
});
