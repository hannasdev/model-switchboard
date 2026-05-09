import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/poc/router.js";
import {
  createMockOpenAIClient,
  createOpenAICodexAdapter
} from "../src/poc/adapters/openai_codex_adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/poc/data/targets.openai.json").targets;

test("openai adapter maps routed target to codex profile and executes", () => {
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced", currentTargetId: "openai-balanced" },
    targets: openaiTargets,
    executionSupported: true
  });

  assert.equal(routeResult.status, "ok");
  assert.equal(routeResult.selectedTarget?.id, "openai-coder");

  const adapter = createOpenAICodexAdapter(createMockOpenAIClient());
  const execution = adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult,
    session: { threadId: "poc-thread-1" }
  });

  assert.equal(execution.status, "executed");
  assert.equal(execution.profile, "codex-best-coder");
  assert.equal(execution.response.provider, "openai-codex");
  assert.equal(execution.response.trace, "simulated_adapter_spike");
});

test("openai adapter returns not_executed when route is refused", () => {
  const quickOnly = openaiTargets.filter((t) => t.label === "quick");
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: quickOnly,
    executionSupported: true
  });

  assert.equal(routeResult.status, "refused");

  const adapter = createOpenAICodexAdapter(createMockOpenAIClient());
  const execution = adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "route_not_ok");
});
