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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ROUTE_LOG_PATH = path.join(__dirname, "logs", "route-decisions.ndjson");

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
  if (vendorKey === "anthropic") return readJson("./data/targets.anthropic.json").targets;
  return readJson("./data/targets.openai.json").targets;
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function appendRouteLog(entry) {
  fs.mkdirSync(path.dirname(ROUTE_LOG_PATH), { recursive: true });
  fs.appendFileSync(ROUTE_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
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

    if (modeOk && statusOk && labelOk && shouldSwitchOk) {
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
              shouldSwitch: result.shouldSwitch
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

const cmd = process.argv[2];
if (cmd === "route") runRoute();
else if (cmd === "fixtures") runFixtures();
else if (cmd === "vendor-matrix") runVendorMatrix();
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
else {
  console.log("Usage:");
  console.log("  node src/poc/cli.js route --vendor openai --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js fixtures");
  console.log("  node src/poc/cli.js vendor-matrix");
  console.log("  node src/poc/cli.js openai-adapter-spike --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js openai-adapter-spike --live true --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js openai-connection-check");
  console.log("  node src/poc/cli.js adapter-spike --vendor openai --input \"Implement the plan.\" # alias");
  console.log("  node src/poc/cli.js connection-check # alias");
  console.log("  node src/poc/cli.js anthropic-adapter-spike --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js anthropic-adapter-spike --live true --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js anthropic-connection-check");
  process.exitCode = 1;
}
