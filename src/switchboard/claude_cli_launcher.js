import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "../router/router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANTHROPIC_TARGETS_PATH = path.join(__dirname, "..", "router", "data", "targets.anthropic.json");

const TARGET_TO_CLAUDE_CLI = {
  "anthropic-quick": { model: "haiku", effort: "low" },
  "anthropic-balanced": { model: "sonnet", effort: "medium" },
  "anthropic-coder": { model: "sonnet", effort: "high" }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendLog(entry, logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function getClaudeCliTargetSelection(targetId) {
  return TARGET_TO_CLAUDE_CLI[targetId] || null;
}

export function planClaudeCliLaunch({
  input,
  targets = readJson(ANTHROPIC_TARGETS_PATH).targets,
  session = {},
  claudeBin = "claude",
  cwd = process.cwd(),
  sessionId = randomUUID(),
  outputFormat = "json",
  noTools = false,
  resume = false,
  interactive = false
}) {
  const route = routePrompt({
    input,
    targets,
    session,
    executionSupported: true
  });

  if (route.status !== "ok") {
    return {
      status: "refused",
      route,
      reason: route.reason || "route_not_ok"
    };
  }

  const targetId = route.selectedTarget.id;
  const cliTarget = getClaudeCliTargetSelection(targetId);
  if (!cliTarget) {
    return {
      status: "failed",
      reason: "missing_claude_cli_target_mapping",
      targetId,
      route
    };
  }

  const args = interactive
    ? [
        "--model",
        cliTarget.model,
        "--effort",
        cliTarget.effort,
        resume ? "--resume" : "--session-id",
        sessionId
      ]
    : [
        "--print",
        "--output-format",
        outputFormat,
        "--model",
        cliTarget.model,
        "--effort",
        cliTarget.effort,
        resume ? "--resume" : "--session-id",
        sessionId
      ];

  if (noTools) args.push("--tools=");
  if (!interactive) args.push(input);

  return {
    status: "planned",
    vendorClient: "claude-code-cli",
    cwd,
    claudeBin,
    args,
    sessionId,
    resume,
    interactive,
    selectedTarget: {
      ...cliTarget,
      targetId,
      label: route.selectedTarget.label
    },
    route,
    commandPreview: [claudeBin, ...args]
  };
}

export function executeClaudeCliLaunch(options) {
  const plan = planClaudeCliLaunch(options);
  if (plan.status !== "planned") return plan;

  const startedAt = new Date().toISOString();
  const execution = spawnSync(plan.claudeBin, plan.args, {
    cwd: plan.cwd,
    encoding: "utf8",
    timeout: options.timeoutMs || 180000
  });

  const result = {
    ...plan,
    status: execution.status === 0 ? "executed" : "failed",
    startedAt,
    completedAt: new Date().toISOString(),
    exitCode: execution.status,
    signal: execution.signal,
    stdout: execution.stdout,
    stderr: execution.stderr,
    error: execution.error ? execution.error.message : null
  };

  if (options.logPath) {
    appendLog(
      {
        ts: result.completedAt,
        source: "claude_cli_launcher",
        status: result.status,
        sessionId: result.sessionId,
        selectedTarget: result.selectedTarget,
        route: result.route,
        exitCode: result.exitCode,
        signal: result.signal,
        error: result.error,
        stderrPreview: result.stderr ? result.stderr.slice(0, 2000) : ""
      },
      options.logPath
    );
  }

  return result;
}
