import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planClaudeCliLaunch } from "./claude_cli_launcher.js";
import { loadThreadSession, saveThreadSession } from "./thread_session_store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_LOG_PATH = path.join(__dirname, "logs", "switchboard-turns.ndjson");
const DEFAULT_STORE_PATH = path.join(__dirname, "logs", "switchboard-sessions.json");
const ANTHROPIC_TARGETS_PATH = path.join(__dirname, "data", "targets.anthropic.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendLog(entry, logPath = DEFAULT_LOG_PATH) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function defaultSession(targets) {
  return {
    mode: "plan",
    cost_posture: "balanced",
    currentTargetId: targets.find((target) => target.label === "balanced")?.id || targets[0]?.id || null,
    turnCount: 0
  };
}

function buildWrapperContext(plan) {
  if (plan.status !== "planned") {
    return {
      kind: "switchboard_context",
      text: `Switchboard: ${plan.status} - ${plan.reason || "unable to plan Claude launch"}`
    };
  }

  const route = plan.route;
  const reasons = [];
  if (route.requiredCapabilities?.includes("file_edit")) reasons.push("repo edits");
  if (route.requiredCapabilities?.includes("test_execution")) reasons.push("tests");
  if (plan.selectedTarget.effort === "high") reasons.push("higher effort");
  if (plan.selectedTarget.effort === "low") reasons.push("lower effort");

  return {
    kind: "switchboard_context",
    text: `Switchboard: ${plan.selectedTarget.label} - ${reasons.join(" - ") || route.mode}`
  };
}

function routeDecisionSummary(plan) {
  const route = plan.route || {};
  return {
    status: route.status || plan.status,
    mode: route.mode || null,
    label: route.selectedTarget?.label || null,
    targetId: route.selectedTarget?.id || plan.targetId || null,
    requiredCapabilities: route.requiredCapabilities || [],
    shouldSwitch: route.shouldSwitch ?? null,
    explanation: route.explanation || null
  };
}

function selectedClaudeSummary(plan) {
  if (plan.status !== "planned") return null;
  return {
    targetId: plan.selectedTarget.targetId,
    label: plan.selectedTarget.label,
    model: plan.selectedTarget.model,
    effort: plan.selectedTarget.effort,
    sessionId: plan.sessionId,
    commandPreview: plan.commandPreview
  };
}

function defaultCommandRunner(plan, timeoutMs) {
  return spawnSync(plan.claudeBin, plan.args, {
    cwd: plan.cwd,
    encoding: "utf8",
    timeout: timeoutMs
  });
}

function executionSummary(execution) {
  if (!execution) return null;
  return {
    status: execution.status === 0 ? "executed" : "failed",
    exitCode: execution.status ?? null,
    signal: execution.signal || null,
    stdoutPreview: execution.stdout ? execution.stdout.slice(0, 2000) : "",
    stderrPreview: execution.stderr ? execution.stderr.slice(0, 2000) : "",
    error: execution.error ? execution.error.message : null
  };
}

function sleepSync(ms) {
  if (!ms || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function buildSwitchboardTurn({
  input,
  threadId = "default",
  targets = readJson(ANTHROPIC_TARGETS_PATH).targets,
  storePath = DEFAULT_STORE_PATH,
  logPath = DEFAULT_LOG_PATH,
  cwd = process.cwd(),
  claudeBin = "claude",
  outputFormat = "json",
  noTools = false,
  sessionId = randomUUID(),
  persist = true,
  execute = false,
  timeoutMs = 180000,
  commandRunner = defaultCommandRunner
}) {
  const persistedSession = loadThreadSession({ storePath, threadId }) || {};
  const baseSession = defaultSession(targets);
  const claudeSessionId = persistedSession.claudeSessionId || sessionId;
  const resumeClaudeSession = Boolean(persistedSession.claudeSessionId);
  const routeSession = {
    ...baseSession,
    ...persistedSession,
    claudeSessionId,
    vendorClient: "claude-code"
  };

  const plan = planClaudeCliLaunch({
    input,
    targets,
    session: routeSession,
    claudeBin,
    cwd,
    sessionId: claudeSessionId,
    outputFormat,
    noTools,
    resume: resumeClaudeSession
  });
  const wrapperContext = buildWrapperContext(plan);
  const routeDecision = routeDecisionSummary(plan);
  const selectedClaude = selectedClaudeSummary(plan);
  const execution =
    execute && plan.status === "planned"
      ? commandRunner(plan, timeoutMs)
      : null;
  const executionResult = executionSummary(execution);
  const turnStatus = executionResult?.status || plan.status;

  const nextSession =
    plan.status === "planned" && (!execute || executionResult?.status === "executed")
      ? {
          ...routeSession,
          currentTargetId: plan.selectedTarget.targetId,
          currentLabel: plan.selectedTarget.label,
          turnCount: Number(routeSession.turnCount || 0) + 1,
          lastRoute: routeDecision,
          claudeSessionId
        }
      : routeSession;

  const savedSession =
    persist && plan.status === "planned"
      ? saveThreadSession({ storePath, threadId, session: nextSession })
      : null;

  const evidence = {
    ts: new Date().toISOString(),
    source: "switchboard_wrapper",
    threadId,
    executionMode: execute ? "live" : "planned",
    userPrompt: input,
    wrapperContext,
    routeDecision,
    selectedClaude,
    execution: executionResult,
    session: {
      threadId,
      claudeSessionId,
      previousSession: persistedSession,
      nextSession: savedSession || nextSession
    }
  };

  appendLog(evidence, logPath);

  return {
    status: turnStatus,
    threadId,
    executionMode: execute ? "live" : "planned",
    userPrompt: input,
    wrapperContext,
    routeDecision,
    selectedClaude,
    execution: executionResult,
    claudePlan: plan,
    previousSession: persistedSession,
    nextSession: savedSession || nextSession,
    evidence
  };
}

export function planSwitchboardTurn(options) {
  return buildSwitchboardTurn({ ...options, execute: false });
}

export function executeSwitchboardTurn(options) {
  return buildSwitchboardTurn({ ...options, execute: true });
}

export function planSwitchboardContinuityProbe({
  threadId = "poc2-continuity",
  firstInput = "Implement the plan.",
  secondInput = "Thanks, that makes sense.",
  ...options
} = {}) {
  const firstTurn = planSwitchboardTurn({
    ...options,
    threadId,
    input: firstInput
  });
  const secondTurn = planSwitchboardTurn({
    ...options,
    threadId,
    input: secondInput
  });

  const verified = {
    sameClaudeSession:
      firstTurn.selectedClaude?.sessionId &&
      firstTurn.selectedClaude.sessionId === secondTurn.selectedClaude?.sessionId,
    routeCanChange:
      firstTurn.routeDecision.label &&
      secondTurn.routeDecision.label &&
      firstTurn.routeDecision.label !== secondTurn.routeDecision.label,
    turnCountAdvanced:
      firstTurn.nextSession.turnCount === 1 && secondTurn.nextSession.turnCount === 2
  };

  return {
    status: Object.values(verified).every(Boolean) ? "verified" : "needs_review",
    threadId,
    verified,
    turns: [firstTurn, secondTurn]
  };
}

export function executeSwitchboardContinuityProbe({
  threadId = "poc2-continuity-live",
  firstInput = "Debug this no-tool continuity probe. The probe phrase for this session is switchboard-continuity-2718. Reply only OK and do not call tools.",
  secondInput = "What probe phrase was provided earlier in this session?",
  interTurnDelayMs = 0,
  ...options
} = {}) {
  const firstTurn = executeSwitchboardTurn({
    ...options,
    threadId,
    input: firstInput
  });
  sleepSync(interTurnDelayMs);
  const secondTurn = executeSwitchboardTurn({
    ...options,
    threadId,
    input: secondInput
  });

  const secondOutput = secondTurn.execution?.stdoutPreview || "";
  const verified = {
    bothExecuted: firstTurn.status === "executed" && secondTurn.status === "executed",
    sameClaudeSession:
      firstTurn.selectedClaude?.sessionId &&
      firstTurn.selectedClaude.sessionId === secondTurn.selectedClaude?.sessionId,
    routeCanChange:
      firstTurn.routeDecision.label &&
      secondTurn.routeDecision.label &&
      firstTurn.routeDecision.label !== secondTurn.routeDecision.label,
    turnCountAdvanced:
      firstTurn.nextSession.turnCount === 1 && secondTurn.nextSession.turnCount === 2,
    secondTurnHasFirstTurnContext: secondOutput.includes("switchboard-continuity-2718")
  };

  return {
    status: Object.values(verified).every(Boolean) ? "verified" : "needs_review",
    threadId,
    verified,
    turns: [firstTurn, secondTurn]
  };
}
