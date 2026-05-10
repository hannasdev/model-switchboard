import { fileURLToPath } from "node:url";
import {
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH,
  executeSwitchboardContinuityProbe,
  executeSwitchboardInteractiveContinuityProbe,
  executeSwitchboardTurn,
  explainLatestSwitchboardTurn,
  planSwitchboardTurn
} from "./workflow.js";
import { DEFAULT_CLAUDE_HOOK_LOG_PATH } from "./claude_hook_bridge.js";
import { DEFAULT_ROUTE_CONTEXT_PATH } from "./route_context.js";

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function getRoutingOverride(args) {
  const explicit = getArg(args, "--override");
  if (explicit) return explicit;
  if (hasFlag(args, "--stronger")) return "stronger";
  if (hasFlag(args, "--cheaper")) return "cheaper";
  if (hasFlag(args, "--stay")) return "stay";
  return "auto";
}

function stripFlags(args, flagsWithValues, booleanFlags) {
  const output = [];
  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    if (flagsWithValues.has(arg)) {
      idx += 1;
      continue;
    }
    if (booleanFlags.has(arg)) continue;
    output.push(arg);
  }
  return output;
}

function printHumanTurn(result, stdout) {
  stdout.write(`${result.wrapperContext.text}\n`);
  stdout.write(`Thread: ${result.threadId}\n`);
  stdout.write(`Claude session: ${result.selectedClaude?.sessionId || "none"}\n`);
  stdout.write(`Claude target: ${result.selectedClaude?.model || "none"}/${result.selectedClaude?.effort || "none"}\n`);
  if (result.routeDecision.routingOverride?.requested !== "auto") {
    const override = result.routeDecision.routingOverride;
    stdout.write(`Override: ${override.requested} (${override.reason})\n`);
  }
  stdout.write(`Status: ${result.status}\n`);
  if (result.execution?.stdoutPreview) stdout.write(`${result.execution.stdoutPreview}\n`);
}

function printHumanExplain(explanation, stdout) {
  if (explanation.status !== "found") {
    stdout.write(`Switchboard explain: ${explanation.reason}\n`);
    return;
  }

  stdout.write(`${explanation.wrapperContext?.text || "Switchboard: no wrapper context"}\n`);
  stdout.write(`Thread: ${explanation.threadId || "unknown"}\n`);
  stdout.write(`Claude session: ${explanation.selectedClaude?.sessionId || "unknown"}\n`);
  stdout.write(`Claude target: ${explanation.selectedClaude?.model || "unknown"}/${explanation.selectedClaude?.effort || "unknown"}\n`);
  stdout.write(`Route: ${explanation.routeDecision?.label || "unknown"} (${explanation.routeDecision?.mode || "unknown"})\n`);
  stdout.write(`Route context: ${explanation.routeContext.status}\n`);
  stdout.write(`Hook events: ${explanation.hookEvents.length}\n`);
  for (const event of explanation.hookEvents) {
    const decision = event.permissionDecision ? ` ${event.permissionDecision}` : "";
    stdout.write(`- ${event.event || "unknown"} correlation=${event.correlationStatus || "unknown"}${decision}\n`);
  }
}

function printUsage(stdout) {
  stdout.write("Usage:\n");
  stdout.write("  switchboard \"Implement the plan.\"\n");
  stdout.write("  switchboard --dry-run \"Implement the plan.\"\n");
  stdout.write("  switchboard --interactive\n");
  stdout.write("  switchboard --dry-run --interactive\n");
  stdout.write("  switchboard --stronger \"Thanks\"\n");
  stdout.write("  switchboard --cheaper \"Summarize this\"\n");
  stdout.write("  switchboard --stay \"Thanks\"\n");
  stdout.write("  switchboard explain [--thread-id <id>]\n");
  stdout.write("  switchboard probe continuity [--no-tools] [--inter-turn-delay-ms <ms>]\n");
  stdout.write("  switchboard probe continuity-interactive [--inter-turn-delay-ms <ms>] [--hook-log-path <path>]\n");
}

export function runSwitchboardCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const command = argv[0] === "explain" || argv[0] === "help" || argv[0] === "probe" ? argv[0] : "turn";

  if (command === "help" || hasFlag(argv, "--help")) {
    printUsage(stdout);
    return 0;
  }

  const options = {
    threadId: getArg(argv, "--thread-id") || "default",
    claudeBin: getArg(argv, "--claude-bin") || "claude",
    outputFormat: getArg(argv, "--output-format") || "json",
    interactive: hasFlag(argv, "--interactive"),
    noTools: hasFlag(argv, "--no-tools"),
    routingOverride: getRoutingOverride(argv),
    timeoutMs: Number(getArg(argv, "--timeout-ms") || "180000"),
    storePath: getArg(argv, "--store-path") || DEFAULT_SWITCHBOARD_STORE_PATH,
    logPath: getArg(argv, "--log-path") || DEFAULT_SWITCHBOARD_LOG_PATH,
    routeContextPath: getArg(argv, "--route-context-path") || DEFAULT_ROUTE_CONTEXT_PATH
  };
  const json = hasFlag(argv, "--json");

  if (command === "probe") {
    const probe = argv[1];
    if (probe !== "continuity" && probe !== "continuity-interactive") {
      stderr.write(`switchboard probe: unknown probe '${probe || ""}'.\nAvailable: continuity, continuity-interactive\n`);
      return 1;
    }
    const sharedProbeOptions = {
      threadId: getArg(argv, "--thread-id") || `probe-${probe}-${Date.now()}`,
      claudeBin: getArg(argv, "--claude-bin") || "claude",
      outputFormat: getArg(argv, "--output-format") || "json",
      noTools: hasFlag(argv, "--no-tools"),
      interTurnDelayMs: Number(getArg(argv, "--inter-turn-delay-ms") || "1000"),
      storePath: getArg(argv, "--store-path") || DEFAULT_SWITCHBOARD_STORE_PATH,
      logPath: getArg(argv, "--log-path") || DEFAULT_SWITCHBOARD_LOG_PATH,
      routeContextPath: getArg(argv, "--route-context-path") || DEFAULT_ROUTE_CONTEXT_PATH,
      timeoutMs: Number(getArg(argv, "--timeout-ms") || "180000")
    };
    const probeResult = probe === "continuity"
      ? executeSwitchboardContinuityProbe(sharedProbeOptions)
      : executeSwitchboardInteractiveContinuityProbe({
          ...sharedProbeOptions,
          hookLogPath: getArg(argv, "--hook-log-path") || undefined
        });
    if (hasFlag(argv, "--json")) {
      stdout.write(`${JSON.stringify(probeResult, null, 2)}\n`);
    } else {
      stdout.write(`Probe: ${probe}\n`);
      stdout.write(`Status: ${probeResult.status}\n`);
      stdout.write(`Thread: ${probeResult.threadId}\n`);
      for (const [check, passed] of Object.entries(probeResult.verified || {})) {
        stdout.write(`  ${passed ? "✓" : "✗"} ${check}\n`);
      }
    }
    return probeResult.status === "verified" ? 0 : 1;
  }

  if (command === "explain") {
    const explanation = explainLatestSwitchboardTurn({
      logPath: options.logPath,
      routeContextPath: options.routeContextPath,
      hookLogPath: getArg(argv, "--hook-log-path") || DEFAULT_CLAUDE_HOOK_LOG_PATH,
      threadId: getArg(argv, "--thread-id")
    });
    if (json) stdout.write(`${JSON.stringify(explanation, null, 2)}\n`);
    else printHumanExplain(explanation, stdout);
    return explanation.status === "found" ? 0 : 1;
  }

  const promptArgs = stripFlags(
    argv,
    new Set([
      "--thread-id",
      "--claude-bin",
      "--output-format",
      "--timeout-ms",
      "--store-path",
      "--log-path",
      "--route-context-path",
      "--hook-log-path",
      "--override"
    ]),
    new Set([
      "--dry-run",
      "--json",
      "--interactive",
      "--no-tools",
      "--stronger",
      "--cheaper",
      "--stay",
      "--auto"
    ])
  );
  const input = promptArgs.join(" ").trim();
  if (!input && !options.interactive) {
    stderr.write("switchboard requires a prompt. Use `switchboard \"Implement the plan.\"`.\n");
    return 1;
  }
  if (input && options.interactive) {
    stderr.write("switchboard --interactive does not accept a prompt argument. Omit the prompt or remove --interactive.\n");
    return 1;
  }
  const dryRun = hasFlag(argv, "--dry-run");
  let result;
  try {
    result = (dryRun ? planSwitchboardTurn : executeSwitchboardTurn)({
      ...options,
      input
    });
  } catch (error) {
    stderr.write(`Switchboard failed before launching Claude: ${error.message}\n`);
    return 1;
  }

  if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else printHumanTurn(result, stdout);
  return result.status === "failed" || result.status === "refused" ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runSwitchboardCli();
}
