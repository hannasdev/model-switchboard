import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "./router.js";
import { createMockOpenAIClient, createOpenAICodexAdapter } from "./adapters/openai_codex_adapter.js";
import { createOpenAISDKClient } from "./adapters/openai_sdk_client.js";
import {
  createMockAnthropicClient,
  createAnthropicClaudeAdapter
} from "./adapters/anthropic_claude_adapter.js";
import { createAnthropicSDKClient } from "./adapters/anthropic_sdk_client.js";
import { createMockGeminiClient, createGeminiAdapter } from "./adapters/gemini_adapter.js";
import { createGeminiSDKClient } from "./adapters/gemini_sdk_client.js";
import { executeProductionHookTurn } from "./production_hook.js";
import { validateMappings } from "./model_mappings.js";
import { executeGatewayTurn } from "./gateway_surface.js";
import { loadThreadSession, saveThreadSession } from "./thread_session_store.js";
import { executeClaudeCliLaunch, planClaudeCliLaunch } from "./claude_cli_launcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ROUTE_LOG_PATH = path.join(__dirname, "logs", "route-decisions.ndjson");
const THREAD_SESSION_STORE_PATH = path.join(__dirname, "logs", "thread-sessions.json");

function readJson(relPath) {
  const p = path.join(__dirname, relPath);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function loadEnvFile(configPath) {
  if (!fs.existsSync(configPath)) return;
  const text = fs.readFileSync(configPath, "utf8");
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = value;
  }
}

function loadTargets(vendorKey) {
  if (vendorKey === "gemini") return readJson("../router/data/targets.gemini.json").targets;
  if (vendorKey === "anthropic") return readJson("../router/data/targets.anthropic.json").targets;
  return readJson("../router/data/targets.openai.json").targets;
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function appendRouteLog(entry) {
  fs.mkdirSync(path.dirname(ROUTE_LOG_PATH), { recursive: true });
  fs.appendFileSync(ROUTE_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function includesSnippet(text, snippet) {
  return String(text || "").includes(snippet);
}

function runRoute() {
  const input = getArg("--input") || "Compare tradeoffs and propose a plan.";
  const vendor = getArg("--vendor") || "openai";
  const executionSupported = getArg("--execute") === "true";
  const targets = loadTargets(vendor);
  const session = { mode: "plan", cost_posture: "balanced", currentTargetId: targets[1]?.id || null };
  const result = routePrompt({
    input,
    targets,
    session,
    executionSupported
  });
  appendRouteLog({
    ts: new Date().toISOString(),
    source: "route",
    vendor,
    input,
    session,
    result
  });
  printResult(result);
}

function runFixtures() {
  const fixtures = readJson("./data/fixtures.json");
  const openaiTargets = loadTargets("openai");
  let passed = 0;
  let failed = 0;

  for (const fx of fixtures) {
    const targets =
      fx.targetOverride === "quick_only"
        ? openaiTargets.filter((t) => t.label === "quick")
        : openaiTargets;
    const result = routePrompt({
      input: fx.input,
      session: fx.session,
      targets,
      executionSupported: false
    });
    appendRouteLog({
      ts: new Date().toISOString(),
      source: "fixture",
      fixture: fx.name,
      vendor: "openai",
      input: fx.input,
      session: fx.session,
      result
    });

    const modeOk = result.mode === fx.expected.mode;
    const statusOk = fx.expected.status ? result.status === fx.expected.status : true;
    const labelOk = fx.expected.label
      ? result.selectedTarget && result.selectedTarget.label === fx.expected.label
      : true;
    const shouldSwitchOk =
      typeof fx.expected.shouldSwitch === "boolean"
        ? result.shouldSwitch === fx.expected.shouldSwitch
        : true;
    const requiredCapabilitiesOk = fx.expected.requiredCapabilities
      ? sameJson(result.requiredCapabilities, fx.expected.requiredCapabilities)
      : true;
    const explanationOk = fx.expected.explanationIncludes
      ? fx.expected.explanationIncludes.every((snippet) => includesSnippet(result.explanation, snippet))
      : true;
    const classificationReasonOk = fx.expected.classificationReason
      ? result.classification?.reason === fx.expected.classificationReason
      : true;

    if (
      modeOk &&
      statusOk &&
      labelOk &&
      shouldSwitchOk &&
      requiredCapabilitiesOk &&
      explanationOk &&
      classificationReasonOk
    ) {
      passed += 1;
      console.log(`PASS ${fx.name}`);
    } else {
      failed += 1;
      console.log(`FAIL ${fx.name}`);
      console.log(
        JSON.stringify(
          {
            expected: fx.expected,
            actual: {
              status: result.status,
              mode: result.mode,
              label: result.selectedTarget ? result.selectedTarget.label : null,
              shouldSwitch: result.shouldSwitch,
              requiredCapabilities: result.requiredCapabilities,
              explanation: result.explanation,
              classificationReason: result.classification?.reason || null
            }
          },
          null,
          2
        )
      );
    }
  }

  console.log(JSON.stringify({ passed, failed, total: fixtures.length }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

function runVendorMatrix() {
  printResult(readJson("./vendor_matrix.json"));
}

function runMappingCheck() {
  const checks = [
    { vendor: "openai-codex", targets: loadTargets("openai") },
    { vendor: "anthropic-claude", targets: loadTargets("anthropic") },
    { vendor: "google-gemini", targets: loadTargets("gemini") }
  ].map((entry) => validateMappings(entry));

  const result = {
    status: checks.every((c) => c.ok) ? "ok" : "failed",
    checkedAt: new Date().toISOString(),
    checks
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "mapping_check",
    result
  });
  printResult(result);
  if (result.status !== "ok") process.exitCode = 1;
}

async function runOpenAIAdapterSpike() {
  const vendor = getArg("--vendor") || "openai";
  if (vendor !== "openai") {
    printResult({
      status: "not_supported",
      reason: "adapter_spike_only_implemented_for_openai"
    });
    process.exitCode = 1;
    return;
  }

  const input = getArg("--input") || "Implement the plan.";
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);
  const targets = loadTargets("openai");
  const session = { mode: "plan", cost_posture: "balanced", currentTargetId: targets[1]?.id || null };

  const routeResult = routePrompt({
    input,
    targets,
    session,
    executionSupported: true
  });

  const live = getArg("--live") === "true";
  const client = live ? createOpenAISDKClient() : createMockOpenAIClient();
  const adapter = createOpenAICodexAdapter(client);
  const execution = await adapter.executeRoutedTurn({ input, routeResult, session });

  const spikeResult = {
    status: execution.status === "executed" ? "ok" : "failed",
    vendor: "openai-codex",
    clientKind: client.kind || "mock",
    route: routeResult,
    execution
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "adapter_spike",
    vendor: "openai-codex",
    input,
    session,
    routeResult,
    execution
  });

  printResult(spikeResult);
}

async function runConnectionCheck() {
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);

  const client = createOpenAISDKClient();
  const response = await client.execute({
    profile: "codex-fast",
    input: getArg("--input") || "Connection check. Reply with OK."
  });

  const result = {
    status: response.result === "ok" ? "ok" : "failed",
    vendor: "openai-codex",
    clientKind: client.kind || "sdk_unknown",
    check: {
      profile: "codex-fast",
      model: response.model || null,
      result: response.result,
      reason: response.reason || null,
      responseId: response.responseId || null,
      outputText: response.outputText || ""
    }
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "connection_check",
    vendor: "openai-codex",
    result
  });

  printResult(result);
  if (result.status !== "ok") process.exitCode = 1;
}

async function runAnthropicAdapterSpike() {
  const input = getArg("--input") || "Implement the plan.";
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);
  const targets = loadTargets("anthropic");
  const session = {
    mode: "plan",
    cost_posture: "balanced",
    currentTargetId: targets[1]?.id || null
  };

  const routeResult = routePrompt({
    input,
    targets,
    session,
    executionSupported: true
  });

  const live = getArg("--live") === "true";
  const client = live ? createAnthropicSDKClient() : createMockAnthropicClient();
  const adapter = createAnthropicClaudeAdapter(client);
  const execution = await adapter.executeRoutedTurn({ input, routeResult, session });

  const spikeResult = {
    status: execution.status === "executed" ? "ok" : "failed",
    vendor: "anthropic-claude",
    clientKind: client.kind || "mock",
    route: routeResult,
    execution
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "adapter_spike",
    vendor: "anthropic-claude",
    input,
    session,
    routeResult,
    execution
  });

  printResult(spikeResult);
}

async function runAnthropicConnectionCheck() {
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);

  const client = createAnthropicSDKClient();
  const response = await client.execute({
    profile: "claude-fast",
    input: getArg("--input") || "Connection check. Reply with OK."
  });

  const result = {
    status: response.result === "ok" ? "ok" : "failed",
    vendor: "anthropic-claude",
    clientKind: client.kind || "sdk_unknown",
    check: {
      profile: "claude-fast",
      model: response.model || null,
      result: response.result,
      reason: response.reason || null,
      responseId: response.responseId || null,
      outputText: response.outputText || ""
    }
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "connection_check",
    vendor: "anthropic-claude",
    result
  });

  printResult(result);
  if (result.status !== "ok") process.exitCode = 1;
}

async function runGeminiAdapterSpike() {
  const input = getArg("--input") || "Implement the plan.";
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);
  const targets = loadTargets("gemini");
  const session = {
    mode: "plan",
    cost_posture: "balanced",
    currentTargetId: targets[1]?.id || null
  };

  const routeResult = routePrompt({
    input,
    targets,
    session,
    executionSupported: true
  });

  const live = getArg("--live") === "true";
  const client = live ? createGeminiSDKClient() : createMockGeminiClient();
  const adapter = createGeminiAdapter(client);
  const execution = await adapter.executeRoutedTurn({ input, routeResult, session });

  const spikeResult = {
    status: execution.status === "executed" ? "ok" : "failed",
    vendor: "google-gemini",
    clientKind: client.kind || "mock",
    route: routeResult,
    execution
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "adapter_spike",
    vendor: "google-gemini",
    input,
    session,
    routeResult,
    execution
  });

  printResult(spikeResult);
}

async function runGeminiConnectionCheck() {
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);

  const client = createGeminiSDKClient();
  const response = await client.execute({
    profile: "gemini-fast",
    input: getArg("--input") || "Connection check. Reply with OK."
  });

  const result = {
    status: response.result === "ok" ? "ok" : "failed",
    vendor: "google-gemini",
    clientKind: client.kind || "sdk_unknown",
    check: {
      profile: "gemini-fast",
      model: response.model || null,
      result: response.result,
      reason: response.reason || null,
      responseId: response.responseId || null,
      outputText: response.outputText || ""
    }
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "connection_check",
    vendor: "google-gemini",
    result
  });

  printResult(result);
  if (result.status !== "ok") process.exitCode = 1;
  return result;
}

async function runGatewaySurface() {
  const vendor = getArg("--vendor") || "openai";
  const input = getArg("--input") || "Implement the plan.";
  const live = getArg("--live") === "true";
  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);
  const targets = loadTargets(vendor);
  const session = {
    mode: getArg("--mode") || "plan",
    cost_posture: getArg("--cost-posture") || "balanced",
    currentTargetId: getArg("--current-target-id") || targets[1]?.id || null,
    turnCount: Number(getArg("--turn-count") || "0") || 0
  };

  let adapter;
  if (vendor === "openai") {
    const client = live ? createOpenAISDKClient() : createMockOpenAIClient();
    adapter = createOpenAICodexAdapter(client);
  } else if (vendor === "anthropic") {
    const client = live ? createAnthropicSDKClient() : createMockAnthropicClient();
    adapter = createAnthropicClaudeAdapter(client);
  } else if (vendor === "gemini") {
    const client = live ? createGeminiSDKClient() : createMockGeminiClient();
    adapter = createGeminiAdapter(client);
  } else {
    printResult({ status: "failed", reason: "unsupported_vendor", vendor });
    process.exitCode = 1;
    return;
  }

  const result = await executeGatewayTurn({
    request: { input, session },
    targets,
    adapter,
    executionSupported: true,
    repoRoot: REPO_ROOT,
    toolAction: getArg("--tool-action") || "none"
  });

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "gateway_surface",
    vendor,
    input,
    session,
    result
  });
  printResult(result);
  if (result.status !== "executed") process.exitCode = 1;
}

async function runGatewayThreadTurn() {
  const vendor = getArg("--vendor") || "openai";
  const input = getArg("--input") || "Implement the plan.";
  const threadId = getArg("--thread-id") || "poc-thread-1";
  const targets = loadTargets(vendor);
  const persisted = loadThreadSession({ storePath: THREAD_SESSION_STORE_PATH, threadId }) || {};
  const baseSession = {
    mode: "plan",
    cost_posture: "balanced",
    currentTargetId: targets[1]?.id || null,
    turnCount: 0
  };
  const session = {
    ...baseSession,
    ...persisted
  };

  let adapter;
  if (vendor === "openai") adapter = createOpenAICodexAdapter(createMockOpenAIClient());
  else if (vendor === "anthropic") adapter = createAnthropicClaudeAdapter(createMockAnthropicClient());
  else if (vendor === "gemini") adapter = createGeminiAdapter(createMockGeminiClient());
  else {
    printResult({ status: "failed", reason: "unsupported_vendor", vendor });
    process.exitCode = 1;
    return;
  }

  const result = await executeGatewayTurn({
    request: { input, session },
    targets,
    adapter,
    executionSupported: true,
    repoRoot: REPO_ROOT,
    toolAction: getArg("--tool-action") || "none"
  });

  const savedSession = saveThreadSession({
    storePath: THREAD_SESSION_STORE_PATH,
    threadId,
    session: result.nextSession
  });

  const out = {
    ...result,
    thread: {
      threadId,
      previousSession: persisted,
      savedSession
    }
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "gateway_thread_turn",
    vendor,
    threadId,
    input,
    session,
    result: out
  });
  printResult(out);
  if (result.status !== "executed") process.exitCode = 1;
}

async function runReleaseGate() {
  const checks = {};
  async function safeConnectionCheck(fn, meta) {
    try {
      const response = await fn();
      return {
        status: response.result === "ok" ? "ok" : "failed",
        ...meta,
        model: response.model || null,
        reason: response.reason || null
      };
    } catch (error) {
      return {
        status: "failed",
        ...meta,
        model: null,
        reason: error?.message || String(error)
      };
    }
  }

  const mapping = [
    { vendor: "openai-codex", targets: loadTargets("openai") },
    { vendor: "anthropic-claude", targets: loadTargets("anthropic") },
    { vendor: "google-gemini", targets: loadTargets("gemini") }
  ].map((entry) => validateMappings(entry));
  checks.mappingCheck = {
    status: mapping.every((c) => c.ok) ? "ok" : "failed",
    checks: mapping
  };

  const configArg = getArg("--config");
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);

  checks.openaiConnection = await safeConnectionCheck(
    () =>
      createOpenAISDKClient().execute({
        profile: "codex-fast",
        input: "Connection check. Reply with OK."
      }),
    { vendor: "openai-codex", profile: "codex-fast" }
  );

  checks.anthropicConnection = await safeConnectionCheck(
    () =>
      createAnthropicSDKClient().execute({
        profile: "claude-fast",
        input: "Connection check. Reply with OK."
      }),
    { vendor: "anthropic-claude", profile: "claude-fast" }
  );

  checks.geminiConnection = await safeConnectionCheck(
    () =>
      createGeminiSDKClient().execute({
        profile: "gemini-fast",
        input: "Connection check. Reply with OK."
      }),
    { vendor: "google-gemini", profile: "gemini-fast" }
  );

  const failed = Object.values(checks).some((c) => c.status !== "ok");
  const result = {
    status: failed ? "failed" : "ok",
    checkedAt: new Date().toISOString(),
    checks
  };

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "release_gate",
    result
  });
  printResult(result);
  if (failed) process.exitCode = 1;
}

function runProductionHook() {
  const vendor = getArg("--vendor") || "openai";
  const targets = loadTargets(vendor);
  const input = getArg("--input") || "Implement the plan.";
  const toolAction = getArg("--tool-action") || "read_file";
  const turnCount = Number(getArg("--turn-count") || "0");
  const session = {
    mode: getArg("--mode") || "plan",
    cost_posture: getArg("--cost-posture") || "balanced",
    currentTargetId: getArg("--current-target-id") || targets[1]?.id || null,
    turnCount: Number.isNaN(turnCount) ? 0 : turnCount
  };

  const result = executeProductionHookTurn({
    input,
    session,
    targets,
    repoRoot: REPO_ROOT,
    toolAction
  });

  appendRouteLog({
    ts: new Date().toISOString(),
    source: "production_hook",
    vendor,
    input,
    session,
    result
  });
  printResult(result);
  if (result.status === "failed") process.exitCode = 1;
}

function runClaudeCliRoute() {
  const input = getArg("--input") || "Implement the plan.";
  const targets = loadTargets("anthropic");
  const session = {
    mode: getArg("--mode") || "plan",
    cost_posture: getArg("--cost-posture") || "balanced",
    currentTargetId: getArg("--current-target-id") || targets[1]?.id || null
  };
  const options = {
    input,
    targets,
    session,
    cwd: REPO_ROOT,
    claudeBin: getArg("--claude-bin") || "claude",
    sessionId: getArg("--session-id") || undefined,
    outputFormat: getArg("--output-format") || "json",
    noTools: getArg("--no-tools") === "true"
  };

  const live = getArg("--live") === "true";
  const result = live ? executeClaudeCliLaunch(options) : planClaudeCliLaunch(options);

  appendRouteLog({
    ts: new Date().toISOString(),
    source: live ? "claude_cli_live_route" : "claude_cli_route_plan",
    input,
    session,
    result: {
      ...result,
      stdout: result.stdout ? result.stdout.slice(0, 2000) : undefined,
      stderr: result.stderr ? result.stderr.slice(0, 2000) : undefined
    }
  });
  printResult(result);
  if (result.status === "failed" || result.status === "refused") process.exitCode = 1;
}

const cmd = process.argv[2];
if (cmd === "route") runRoute();
else if (cmd === "fixtures") runFixtures();
else if (cmd === "vendor-matrix") runVendorMatrix();
else if (cmd === "mapping-check") runMappingCheck();
else if (cmd === "adapter-spike") {
  runOpenAIAdapterSpike().catch((error) => {
    printResult({
      status: "failed",
      reason: "adapter_spike_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "openai-adapter-spike") {
  runOpenAIAdapterSpike().catch((error) => {
    printResult({
      status: "failed",
      reason: "openai_adapter_spike_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "connection-check") {
  runConnectionCheck().catch((error) => {
    printResult({
      status: "failed",
      reason: "connection_check_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "openai-connection-check") {
  runConnectionCheck().catch((error) => {
    printResult({
      status: "failed",
      reason: "openai_connection_check_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "anthropic-adapter-spike") {
  runAnthropicAdapterSpike().catch((error) => {
    printResult({
      status: "failed",
      reason: "anthropic_adapter_spike_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "anthropic-connection-check") {
  runAnthropicConnectionCheck().catch((error) => {
    printResult({
      status: "failed",
      reason: "anthropic_connection_check_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "gemini-adapter-spike") {
  runGeminiAdapterSpike().catch((error) => {
    printResult({
      status: "failed",
      reason: "gemini_adapter_spike_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "gemini-connection-check") {
  runGeminiConnectionCheck().catch((error) => {
    printResult({
      status: "failed",
      reason: "gemini_connection_check_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "gateway-surface") {
  runGatewaySurface().catch((error) => {
    printResult({
      status: "failed",
      reason: "gateway_surface_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "gateway-thread-turn") {
  runGatewayThreadTurn().catch((error) => {
    printResult({
      status: "failed",
      reason: "gateway_thread_turn_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "release-gate") {
  runReleaseGate().catch((error) => {
    printResult({
      status: "failed",
      reason: "release_gate_runtime_error",
      message: error?.message || String(error)
    });
    process.exitCode = 1;
  });
}
else if (cmd === "claude-cli-route") runClaudeCliRoute();
else if (cmd === "production-hook") runProductionHook();
else {
  console.log("Usage:");
  console.log("  node src/poc/cli.js route --vendor openai --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js fixtures");
  console.log("  node src/poc/cli.js vendor-matrix");
  console.log("  node src/poc/cli.js mapping-check");
  console.log("  node src/poc/cli.js openai-adapter-spike --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js openai-adapter-spike --live true --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js openai-connection-check");
  console.log("  node src/poc/cli.js adapter-spike --vendor openai --input \"Implement the plan.\" # alias");
  console.log("  node src/poc/cli.js connection-check # alias");
  console.log("  node src/poc/cli.js anthropic-adapter-spike --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js anthropic-adapter-spike --live true --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js anthropic-connection-check");
  console.log("  node src/poc/cli.js gemini-adapter-spike --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js gemini-adapter-spike --live true --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js gemini-connection-check");
  console.log("  node src/poc/cli.js gateway-surface --vendor openai --input \"Implement the plan.\" --tool-action safe_file_edit");
  console.log("  node src/poc/cli.js gateway-thread-turn --vendor openai --thread-id poc-thread-1 --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js release-gate");
  console.log("  node src/poc/cli.js claude-cli-route --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js claude-cli-route --live true --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js production-hook --vendor openai --input \"Implement the plan.\" --tool-action read_file");
  process.exitCode = 1;
}
