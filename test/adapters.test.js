import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../src/router/router.js";
import {
  createMockOpenAIClient,
  createOpenAICodexAdapter
} from "../src/adapters/openai_codex_adapter.js";
import { createOpenAISDKClient } from "../src/adapters/openai_sdk_client.js";
import {
  createMockAnthropicClient,
  createAnthropicClaudeAdapter
} from "../src/adapters/anthropic_claude_adapter.js";
import { createAnthropicSDKClient } from "../src/adapters/anthropic_sdk_client.js";
import { createMockGeminiClient, createGeminiAdapter } from "../src/adapters/gemini_adapter.js";
import { createGeminiSDKClient } from "../src/adapters/gemini_sdk_client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/router/data/targets.openai.json").targets;
const anthropicTargets = readJson("../src/router/data/targets.anthropic.json").targets;
const geminiTargets = readJson("../src/router/data/targets.gemini.json").targets;

test("openai adapter maps routed target to codex profile and executes", async () => {
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced", currentTargetId: "openai-balanced" },
    targets: openaiTargets,
    executionSupported: true
  });

  assert.equal(routeResult.status, "ok");
  assert.equal(routeResult.selectedTarget?.id, "openai-coder");

  const adapter = createOpenAICodexAdapter(createMockOpenAIClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult,
    session: { threadId: "adapter-thread-1" }
  });

  assert.equal(execution.status, "executed");
  assert.equal(execution.profile, "codex-best-coder");
  assert.equal(execution.response.provider, "openai-codex");
  assert.equal(execution.response.trace, "simulated_adapter_spike");
});

test("openai adapter returns not_executed when route is refused", async () => {
  const quickOnly = openaiTargets.filter((t) => t.label === "quick");
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: quickOnly,
    executionSupported: true
  });

  assert.equal(routeResult.status, "refused");

  const adapter = createOpenAICodexAdapter(createMockOpenAIClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "route_not_ok");
});

test("openai sdk client path is safe when api key is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: openaiTargets,
    executionSupported: true
  });

  const adapter = createOpenAICodexAdapter(createOpenAISDKClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  else delete process.env.OPENAI_API_KEY;

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "client_execution_not_ok");
  assert.equal(execution.response.reason, "missing_openai_api_key");
});

test("anthropic adapter maps routed target to claude profile and executes", async () => {
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced", currentTargetId: "anthropic-balanced" },
    targets: anthropicTargets,
    executionSupported: true
  });

  assert.equal(routeResult.status, "ok");
  assert.equal(routeResult.selectedTarget?.id, "anthropic-coder");

  const adapter = createAnthropicClaudeAdapter(createMockAnthropicClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult,
    session: { threadId: "adapter-thread-2" }
  });

  assert.equal(execution.status, "executed");
  assert.equal(execution.profile, "claude-best-coder");
  assert.equal(execution.response.provider, "anthropic-claude");
  assert.equal(execution.response.trace, "simulated_adapter_spike");
});

test("anthropic adapter returns not_executed when route is refused", async () => {
  const quickOnly = anthropicTargets.filter((t) => t.label === "quick");
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: quickOnly,
    executionSupported: true
  });

  assert.equal(routeResult.status, "refused");

  const adapter = createAnthropicClaudeAdapter(createMockAnthropicClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "route_not_ok");
});

test("anthropic sdk client path is safe when api key is missing", async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: anthropicTargets,
    executionSupported: true
  });

  const adapter = createAnthropicClaudeAdapter(createAnthropicSDKClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  if (previousKey) process.env.ANTHROPIC_API_KEY = previousKey;
  else delete process.env.ANTHROPIC_API_KEY;

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "client_execution_not_ok");
  assert.equal(execution.response.reason, "missing_anthropic_api_key");
});

test("gemini adapter maps routed target to gemini profile and executes", async () => {
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced", currentTargetId: "gemini-balanced" },
    targets: geminiTargets,
    executionSupported: true
  });

  assert.equal(routeResult.status, "ok");
  assert.equal(routeResult.selectedTarget?.id, "gemini-coder");

  const adapter = createGeminiAdapter(createMockGeminiClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult,
    session: { threadId: "adapter-thread-3" }
  });

  assert.equal(execution.status, "executed");
  assert.equal(execution.profile, "gemini-best-coder");
  assert.equal(execution.response.provider, "google-gemini");
  assert.equal(execution.response.trace, "simulated_adapter_spike");
});

test("gemini adapter returns not_executed when route is refused", async () => {
  const quickOnly = geminiTargets.filter((t) => t.label === "quick");
  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: quickOnly,
    executionSupported: true
  });

  assert.equal(routeResult.status, "refused");

  const adapter = createGeminiAdapter(createMockGeminiClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "route_not_ok");
});

test("gemini sdk client path is safe when api key is missing", async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  const routeResult = routePrompt({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: geminiTargets,
    executionSupported: true
  });

  const adapter = createGeminiAdapter(createGeminiSDKClient());
  const execution = await adapter.executeRoutedTurn({
    input: "Implement the plan.",
    routeResult
  });

  if (previousGeminiKey) process.env.GEMINI_API_KEY = previousGeminiKey;
  else delete process.env.GEMINI_API_KEY;
  if (previousGoogleKey) process.env.GOOGLE_API_KEY = previousGoogleKey;
  else delete process.env.GOOGLE_API_KEY;

  assert.equal(execution.status, "not_executed");
  assert.equal(execution.reason, "client_execution_not_ok");
  assert.equal(execution.response.reason, "missing_gemini_api_key");
});
