import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planClaudeCliLaunch } from "./claude_cli_launcher.js";
import {
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "./paths.js";
import { saveRouteContext } from "./route_context.js";
import { loadThreadSession, saveThreadSession } from "./session_store.js";

export {
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "./paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANTHROPIC_TARGETS_PATH = path.join(__dirname, "..", "router", "data", "targets.anthropic.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendLog(entry, logPath = DEFAULT_SWITCHBOARD_LOG_PATH) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
    routingOverride: route.routingOverride || null,
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
  const interactiveOptions = plan.interactive
    ? {
        stdio: "inherit"
      }
    : {
        encoding: "utf8",
        timeout: timeoutMs
      };

  return spawnSync(plan.claudeBin, plan.args, {
    cwd: plan.cwd,
    ...interactiveOptions
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

function replaceResumeWithSessionId(args = []) {
  const nextArgs = [...args];
  const resumeIdx = nextArgs.indexOf("--resume");
  if (resumeIdx !== -1) nextArgs[resumeIdx] = "--session-id";
  return nextArgs;
}

function sleepSync(ms) {
  if (!ms || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function persistRouteContext({
  routeContextPath,
  threadId,
  claudeSessionId,
  turnCount,
  routeDecision,
  selectedClaude,
  executionMode,
  wrapperContext
}) {
  if (!selectedClaude) return null;
  return saveRouteContext({
    storePath: routeContextPath,
    context: {
      threadId,
      claudeSessionId,
      turnCount,
      routeLabel: routeDecision.label,
      targetId: routeDecision.targetId,
      model: selectedClaude.model,
      effort: selectedClaude.effort,
      mode: routeDecision.mode,
      executionMode,
      wrapperContext
    }
  });
}

function buildSwitchboardTurn({
  input,
  interactive = false,
  threadId = "default",
  targets = readJson(ANTHROPIC_TARGETS_PATH).targets,
  storePath = DEFAULT_SWITCHBOARD_STORE_PATH,
  logPath = DEFAULT_SWITCHBOARD_LOG_PATH,
  routeContextPath,
  cwd = process.cwd(),
  claudeBin = "claude",
  outputFormat = "json",
  noTools = false,
  routingOverride = "auto",
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
    vendorClient: "claude-code",
    routingOverride
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
    resume: resumeClaudeSession,
    interactive
  });
  let effectivePlan = plan;
  let recoveredFromResumeRetry = false;
  const wrapperContext = buildWrapperContext(plan);
  const routeDecision = routeDecisionSummary(plan);
  const persistedSelectedClaude = selectedClaudeSummary(plan);
  const plannedTurnCount =
    plan.status === "planned" ? Number(routeSession.turnCount || 0) + 1 : Number(routeSession.turnCount || 0);
  persistRouteContext({
    routeContextPath,
    threadId,
    claudeSessionId,
    turnCount: plannedTurnCount,
    routeDecision,
    selectedClaude: persistedSelectedClaude,
    executionMode: execute ? "live" : "planned",
    wrapperContext
  });

  let execution =
    execute && plan.status === "planned"
      ? commandRunner(plan, timeoutMs)
      : null;

  if (execute && plan.status === "planned" && plan.interactive && plan.resume && execution?.status !== 0) {
    effectivePlan = {
      ...plan,
      args: replaceResumeWithSessionId(plan.args),
      resume: false
    };
    effectivePlan.commandPreview = [effectivePlan.claudeBin, ...effectivePlan.args];
    const retryExecution = commandRunner(effectivePlan, timeoutMs);
    if (retryExecution?.status === 0) {
      execution = retryExecution;
      recoveredFromResumeRetry = true;
    }
  }

  const selectedClaude = selectedClaudeSummary(effectivePlan);

  const executionResult = executionSummary(execution);
  const turnStatus = executionResult?.status || plan.status;

  const nextSession =
    effectivePlan.status === "planned" && (!execute || executionResult?.status === "executed")
      ? {
          ...routeSession,
          currentTargetId: effectivePlan.selectedTarget.targetId,
          currentLabel: effectivePlan.selectedTarget.label,
          turnCount: Number(routeSession.turnCount || 0) + 1,
          lastRoute: routeDecision,
          claudeSessionId,
          routingOverride: "auto"
        }
      : routeSession;

  const savedSession =
    persist && effectivePlan.status === "planned"
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
    recovery: {
      recoveredFromResumeRetry
    },
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
    claudePlan: effectivePlan,
    recovery: {
      recoveredFromResumeRetry
    },
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

export function executeSwitchboardInteractiveContinuityProbe({
  threadId = "poc2-continuity-interactive-live",
  interTurnDelayMs = 0,
  ...options
} = {}) {
  const firstTurn = executeSwitchboardTurn({
    ...options,
    threadId,
    input: "",
    interactive: true
  });
  sleepSync(interTurnDelayMs);
  const secondTurn = executeSwitchboardTurn({
    ...options,
    threadId,
    input: "",
    interactive: true
  });

  const verified = {
    bothExecuted: firstTurn.status === "executed" && secondTurn.status === "executed",
    sameClaudeSession:
      firstTurn.selectedClaude?.sessionId &&
      firstTurn.selectedClaude.sessionId === secondTurn.selectedClaude?.sessionId,
    secondTurnUsesResume: secondTurn.claudePlan?.resume === true,
    interactiveArgsOmitPrompt:
      !firstTurn.claudePlan?.args?.includes("--print") &&
      !secondTurn.claudePlan?.args?.includes("--print"),
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

export function explainLatestSwitchboardTurn({
  logPath = DEFAULT_SWITCHBOARD_LOG_PATH,
  routeContextPath,
  hookLogPath,
  threadId
} = {}) {
  const entries = readNdjson(logPath);
  const candidates = threadId
    ? entries.filter((entry) => entry.threadId === threadId)
    : entries;
  const latest = candidates[candidates.length - 1] || null;

  if (!latest) {
    return {
      status: "missing",
      reason: threadId ? "no_switchboard_turn_for_thread" : "no_switchboard_turns",
      threadId: threadId || null
    };
  }

  const claudeSessionId = latest.session?.claudeSessionId || latest.selectedClaude?.sessionId || null;
  const routeContextStore = readJsonIfExists(routeContextPath);
  const routeContext = claudeSessionId && routeContextStore
    ? routeContextStore[claudeSessionId] || null
    : null;
  const hookEvents = hookLogPath
    ? readNdjson(hookLogPath).filter((entry) => entry.sessionId === claudeSessionId)
    : [];

  return {
    status: "found",
    threadId: latest.threadId || null,
    userPrompt: latest.userPrompt || null,
    wrapperContext: latest.wrapperContext || null,
    routeDecision: latest.routeDecision || null,
    selectedClaude: latest.selectedClaude || null,
    execution: latest.execution || null,
    session: latest.session || null,
    routeContext: routeContext
      ? {
          status: "matched",
          latest: routeContext.latest || null,
          turnCount: routeContext.turns?.length || 0
        }
      : {
          status: "missing",
          reason: claudeSessionId ? "no_route_context_for_session" : "missing_claude_session_id"
        },
    hookEvents: hookEvents.map((event) => ({
      ts: event.ts || null,
      event: event.event || null,
      correlationStatus: event.correlation?.status || null,
      toolName: event.toolName || null,
      permissionDecision: event.output?.hookSpecificOutput?.permissionDecision || null
    }))
  };
}