import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { planClaudeCliLaunch } from "./claude-cli-launcher.js";
import {
  ANTHROPIC_TARGETS_PATH,
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "./paths.js";
import { saveRouteContext } from "./route-context.js";
import { loadThreadSession, saveThreadSession } from "./session-store.js";
import {
  determineErrorSignal,
  determineSwitchingReason,
  generateDecisionId,
  POLICY_VERSION,
  EXECUTION_STATUS
} from "../router/outcome-constants.js";
import { readNdjson } from "./readers.js";

export {
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "./paths.js";
export { explainLatestSwitchboardTurn } from "./explain.js";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendLog(entry, logPath = DEFAULT_SWITCHBOARD_LOG_PATH) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function defaultSession(targets) {
  return {
    mode: "plan",
    cost_posture: "balanced",
    currentTargetId: targets.find((target) => target.label === "balanced")?.id || targets[0]?.id || null,
    turnCount: 0,
    attemptedTurnCount: 0
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
    confidence: route.classification?.confidence ?? route.confidence ?? null,
    mode: route.mode || null,
    taskType: route.taskType || null,
    label: route.selectedTarget?.label || null,
    targetId: route.selectedTarget?.id || plan.targetId || null,
    requiredCapabilities: route.requiredCapabilities || [],
    shouldSwitch: route.shouldSwitch ?? null,
    continuityCost: route.continuityCost ?? null,
    continuityDecision: route.continuityDecision || null,
    continuityReason: route.continuityReason || null,
    routingOverride: route.routingOverride || null,
    modeResolution: route.modeResolution || null,
    policyInputs: route.policyInputs || null,
    escalationPolicy: route.escalationPolicy || null,
    explanation: route.explanation || null
  };
}

function routingDecisionContract(plan, targets = []) {
  if (!plan?.route) {
    return {
      schemaVersion: "0.1.0-experimental",
      status: "refused",
      mode: null,
      taskType: null,
      requiredCapabilities: [],
      hardConstraintResults: {
        eligibleTargetIds: [],
        blocked: []
      },
      softConstraintInputs: {
        userPreference: null,
        projectOverride: null
      },
      targetClass: null,
      selectedTargetId: null,
      shouldSwitch: null,
      continuityCost: null,
      continuityDecision: null,
      continuityReason: null,
      routingOverride: {
        requested: "auto",
        applied: false,
        reason: null
      },
      modeResolution: null,
      policyInputs: null,
      explanation: plan?.reason || "Unable to produce a router decision.",
      refusalReason: plan?.reason || plan?.status || "missing_route"
    };
  }

  const blocked = (plan.route.blocked || []).map((entry) => ({
    targetId: entry.id || entry.targetId || null,
    missingCapabilities: entry.missingCapabilities || [],
    constraintReasons: entry.constraintReasons || []
  }));
  const blockedTargetIds = new Set(blocked.map((entry) => entry.targetId).filter(Boolean));
  const eligibleTargetIds = [
    ...new Set(
      (targets || [])
        .map((target) => target.id)
        .filter((targetId) => targetId && !blockedTargetIds.has(targetId))
    )
  ];
  const selectedTargetId = plan.route.selectedTarget?.id || null;
  if (selectedTargetId && !eligibleTargetIds.includes(selectedTargetId)) {
    eligibleTargetIds.push(selectedTargetId);
  }

  return {
    schemaVersion: "0.1.0-experimental",
    ...plan.route,
    selectedTargetId,
    hardConstraintResults: {
      eligibleTargetIds,
      blocked
    },
    refusalReason: plan.route.status === "refused" ? plan.route.reason || plan.route.explanation || null : null
  };
}

function buildSessionState({
  threadId,
  claudeSessionId,
  routeSession,
  routeDecision,
  selectedClaude,
  turnCount
}) {
  return {
    schemaVersion: "0.1.0-experimental",
    sessionId: claudeSessionId,
    threadId,
    mode: routeDecision?.mode || routeSession?.mode || "plan",
    currentTargetId: selectedClaude?.targetId || routeSession?.currentTargetId || null,
    turnCount,
    routingOverride: routeSession?.routingOverride || "auto",
    riskLevel: routeSession?.riskLevel || null,
    failureSignals: {
      recentToolFailures: Number(routeSession?.failureSignals?.recentToolFailures || 0),
      recentTestFailures: Number(routeSession?.failureSignals?.recentTestFailures || 0)
    },
    updatedAt: new Date().toISOString()
  };
}

function buildContextPackage({
  threadId,
  claudeSessionId,
  turnCount,
  routeDecision,
  selectedClaude,
  wrapperContext
}) {
  return {
    schemaVersion: "0.1.0-experimental",
    sessionId: claudeSessionId,
    threadId,
    turnIndex: turnCount,
    routeLabel: routeDecision?.label || selectedClaude?.label || null,
    targetId: selectedClaude?.targetId || routeDecision?.targetId || null,
    mode: routeDecision?.mode || null,
    wrapperContext: wrapperContext || null,
    handoffSummary: null,
    createdAt: new Date().toISOString()
  };
}

function normalizeRoutingLogEvent({
  ts,
  source,
  sessionId,
  threadId,
  turnIndex,
  userPrompt,
  sessionState,
  routingDecision,
  contextPackage,
  outcome,
  attribution,
  wrapperContext,
  legacy = {}
}) {
  return {
    schemaVersion: "0.1.0-experimental",
    ts,
    source,
    sessionId,
    threadId,
    turnIndex,
    userPrompt: userPrompt ?? null,
    sessionState,
    routingDecision,
    contextPackage,
    outcome,
    attribution,
    hookCorrelation: null,
    wrapperContext: wrapperContext ?? null,
    legacy
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
  // Interactive turns inherit stdin and stdout so Claude's TTY session works
  // normally, but pipe stderr so we can capture it for stale-resume detection
  // and evidence logging. Non-interactive turns pipe all three for full capture.
  const interactiveOptions = plan.interactive
    ? { stdio: ["inherit", "inherit", "pipe"] }
    : {};

  return spawnSync(plan.claudeBin, plan.args, {
    cwd: plan.cwd,
    encoding: "utf8",
    timeout: timeoutMs,
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
  routeSession,
  turnCount,
  routeDecision,
  routingDecision,
  selectedClaude,
  executionMode,
  wrapperContext
}) {
  if (!selectedClaude) return null;

  const sessionState = buildSessionState({
    threadId,
    claudeSessionId,
    routeSession,
    routeDecision,
    selectedClaude,
    turnCount
  });
  const contextPackage = buildContextPackage({
    threadId,
    claudeSessionId,
    turnCount,
    routeDecision,
    selectedClaude,
    wrapperContext
  });

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
      wrapperContext,
      sessionState,
      routingDecision,
      contextPackage,
      claudeExecution: {
        executionMode,
        model: selectedClaude.model,
        effort: selectedClaude.effort,
        targetId: selectedClaude.targetId,
        sessionId: selectedClaude.sessionId,
        commandPreview: selectedClaude.commandPreview
      }
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
  const turnStartTimeMs = Date.now();
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
  const routingDecision = routingDecisionContract(plan, targets);
  // plannedSelectedClaude reflects the pre-execution plan (before any stale-resume retry).
  // It is used for route-context persistence so the context always records what was planned,
  // while selectedClaude (computed after retry resolution) reflects what actually ran.
  const plannedSelectedClaude = selectedClaudeSummary(plan);
  const attemptedTurnCount =
    plan.status === "planned"
      ? Number(routeSession.attemptedTurnCount || routeSession.turnCount || 0) + 1
      : Number(routeSession.attemptedTurnCount || routeSession.turnCount || 0);
  persistRouteContext({
    routeContextPath,
    threadId,
    claudeSessionId,
    routeSession,
    turnCount: attemptedTurnCount,
    routeDecision,
    routingDecision,
    selectedClaude: plannedSelectedClaude,
    executionMode: execute ? "live" : "planned",
    wrapperContext
  });

  let execution =
    execute && plan.status === "planned"
      ? commandRunner(plan, timeoutMs)
      : null;

  const isStaleResume =
    execute &&
    plan.status === "planned" &&
    plan.interactive &&
    plan.resume &&
    execution?.status !== 0 &&
    typeof execution?.stderr === "string" &&
    execution.stderr.includes("No conversation found with session ID");

  if (isStaleResume) {
    const retryPlan = {
      ...plan,
      args: replaceResumeWithSessionId(plan.args),
      resume: false
    };
    retryPlan.commandPreview = [retryPlan.claudeBin, ...retryPlan.args];
    const retryExecution = commandRunner(retryPlan, timeoutMs);
    if (retryExecution?.status === 0) {
      effectivePlan = retryPlan;
      execution = retryExecution;
      recoveredFromResumeRetry = true;
    }
  }

  const selectedClaude = selectedClaudeSummary(effectivePlan);

  const executionResult = executionSummary(execution);
  const turnStatus = executionResult?.status || plan.status;

  const nextSession =
    effectivePlan.status === "planned"
      ? {
          ...routeSession,
          currentTargetId:
            !execute || executionResult?.status === "executed"
              ? effectivePlan.selectedTarget.targetId
              : routeSession.currentTargetId,
          currentLabel:
            !execute || executionResult?.status === "executed"
              ? effectivePlan.selectedTarget.label
              : routeSession.currentLabel,
          turnCount:
            !execute || executionResult?.status === "executed"
              ? Number(routeSession.turnCount || 0) + 1
              : Number(routeSession.turnCount || 0),
          attemptedTurnCount,
          lastRoute:
            !execute || executionResult?.status === "executed"
              ? routeDecision
              : routeSession.lastRoute,
          claudeSessionId,
          routingOverride: "auto"
        }
      : routeSession;

  const savedSession =
    persist && effectivePlan.status === "planned"
      ? saveThreadSession({ storePath, threadId, session: nextSession })
      : null;

  const currentSessionState = buildSessionState({
    threadId,
    claudeSessionId,
    routeSession,
    routeDecision,
    selectedClaude,
    turnCount: attemptedTurnCount
  });
  const currentContextPackage = buildContextPackage({
    threadId,
    claudeSessionId,
    turnCount: attemptedTurnCount,
    routeDecision,
    selectedClaude,
    wrapperContext
  });

  const executionStatus = !execute
    ? EXECUTION_STATUS.PLANNED
    : effectivePlan.status !== "planned" || !executionResult
      ? EXECUTION_STATUS.PLANNED
      : executionResult?.exitCode === 0
      ? EXECUTION_STATUS.EXECUTED
      : EXECUTION_STATUS.FAILED;

  const normalizedEvent = normalizeRoutingLogEvent({
    ts: new Date().toISOString(),
    source: "switchboard_wrapper",
    sessionId: claudeSessionId,
    threadId,
    turnIndex: attemptedTurnCount,
    userPrompt: input,
    sessionState: currentSessionState,
    routingDecision,
    contextPackage: currentContextPackage,
    outcome: {
      executionStatus,
      exitCode: executionResult?.exitCode ?? null,
      errorSignal: determineErrorSignal(executionStatus, executionResult),
      durationMs: Date.now() - turnStartTimeMs
    },
    attribution: {
      decisionId: generateDecisionId({
        sessionId: claudeSessionId,
        threadId,
        turnCount: attemptedTurnCount
      }),
      decisionConfidence: routeDecision?.confidence ?? 0.5,
      switchingReason: determineSwitchingReason(routingDecision, persistedSession?.currentTargetId ?? routeSession.currentTargetId),
      escalationApplied: routeDecision?.escalationPolicy?.applied || false,
      policyVersion: POLICY_VERSION
    },
    wrapperContext,
    legacy: {
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
      },
      router: {
        routingDecision,
        routeDecision,
        sessionState: currentSessionState,
        contextPackage: currentContextPackage
      },
      claude: {
        selectedClaude,
        execution: executionResult,
        launch: {
          resume: Boolean(effectivePlan.resume),
          interactive: Boolean(effectivePlan.interactive),
          commandPreview: effectivePlan.commandPreview || null
        }
      }
    }
  });

  const evidence = {
    ...normalizedEvent,
    executionMode: execute ? "live" : "planned",
    router: {
      routingDecision,
      routeDecision,
      sessionState: currentSessionState,
      contextPackage: currentContextPackage
    },
    claude: {
      selectedClaude,
      execution: executionResult,
      launch: {
        resume: Boolean(effectivePlan.resume),
        interactive: Boolean(effectivePlan.interactive),
        commandPreview: effectivePlan.commandPreview || null
      }
    },
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
    },
    sessionState: currentSessionState,
    routingDecision,
    contextPackage: currentContextPackage
  };

  appendLog(evidence, logPath);

  return {
    status: turnStatus,
    threadId,
    executionMode: execute ? "live" : "planned",
    userPrompt: input,
    wrapperContext,
    routeDecision,
    routingDecision,
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
  hookLogPath,
  ...options
} = {}) {
  const probeStartMs = Date.now();
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
  sleepSync(interTurnDelayMs);
  const thirdTurn = executeSwitchboardTurn({
    ...options,
    threadId,
    input: "",
    interactive: true
  });

  const claudeSessionId = firstTurn.selectedClaude?.sessionId;

  // Hook correlation is optional and only evaluated when a hook log path is
  // explicitly provided by the caller.
  const hookEvents = hookLogPath
    ? readNdjson(hookLogPath).filter((entry) => {
        if (entry.sessionId !== claudeSessionId) return false;
        const eventTs = Date.parse(entry.ts || "");
        return Number.isFinite(eventTs) && eventTs >= probeStartMs;
      })
    : null;

  const verified = {
    allExecuted:
      firstTurn.status === "executed" &&
      secondTurn.status === "executed" &&
      thirdTurn.status === "executed",
    sameClaudeSessionAcrossThreeTurns:
      claudeSessionId &&
      claudeSessionId === secondTurn.selectedClaude?.sessionId &&
      claudeSessionId === thirdTurn.selectedClaude?.sessionId,
    secondTurnUsesResume: secondTurn.claudePlan?.resume === true,
    thirdTurnUsesResume: thirdTurn.claudePlan?.resume === true,
    interactiveArgsOmitPrompt:
      !firstTurn.claudePlan?.args?.includes("--print") &&
      !secondTurn.claudePlan?.args?.includes("--print") &&
      !thirdTurn.claudePlan?.args?.includes("--print"),
    // Check that turn count advances by exactly 1 per turn relative to the
    // starting count, rather than asserting absolute values. This keeps the
    // check correct even if the probe thread is reused.
    turnCountAdvanced:
      secondTurn.nextSession.turnCount === firstTurn.nextSession.turnCount + 1 &&
      thirdTurn.nextSession.turnCount === secondTurn.nextSession.turnCount + 1,
    ...(hookEvents !== null && {
      hookEventsPresent: hookEvents.length > 0,
      hookEventsCorrelated:
        hookEvents.some((entry) => entry.correlation?.status === "matched")
    })
  };

  return {
    status: Object.values(verified).every(Boolean) ? "verified" : "needs_review",
    threadId,
    verified,
    hookEvents: hookEvents || [],
    turns: [firstTurn, secondTurn, thirdTurn]
  };
}

/**
 * Load all evidence events for a session from the log.
 * @param {object} params
 * @param {string} params.logPath - path to switchboard log
 * @param {string} params.sessionId - session ID to filter by
 * @returns {array} - normalized events for that session
 */
export function loadSessionEvidence({ logPath = DEFAULT_SWITCHBOARD_LOG_PATH, sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const allEntries = readNdjson(logPath);
  return allEntries.filter((entry) => entry.sessionId === sessionId || entry.session?.claudeSessionId === sessionId);
}

/**
 * Replay a routing decision with a given evidence set and policy.
 * Useful for testing if a new policy would make different decisions.
 * @param {object} params
 * @param {object} params.evidence - a routing log event
 * @param {string} params.policyVersion - policy version identifier
 * @returns {object} - comparison of original vs replayed decision
 */
export function replayRoutingDecision({
  evidence,
  policyVersion = POLICY_VERSION
}) {
  const routingDecision =
    evidence?.routingDecision ||
    evidence?.router?.routingDecision ||
    evidence?.legacy?.router?.routingDecision ||
    null;
  if (!evidence || !routingDecision) {
    return {
      status: "unable_to_replay",
      reason: "missing_routing_decision_in_evidence"
    };
  }

  const originalDecision = routingDecision;
  const sessionState =
    evidence.sessionState ||
    evidence.router?.sessionState ||
    evidence.legacy?.router?.sessionState ||
    null;
  const originalSelectedId = originalDecision.selectedTargetId;

  // For now, replaying means comparing with the current policy version
  // In a full implementation, this would accept alternative policy configs
  const matches = (evidence.attribution?.policyVersion ?? originalDecision.policyVersion) === policyVersion;

  return {
    status: "replayed",
    originalSelectedTargetId: originalSelectedId,
    originalDecisionId: evidence.attribution?.decisionId || null,
    currentPolicyVersion: policyVersion,
    originalPolicyVersion: evidence.attribution?.policyVersion ?? originalDecision.policyVersion ?? null,
    matches,
    confidence: evidence.attribution?.decisionConfidence ?? 0.5,
    switchingReason: evidence.attribution?.switchingReason || null,
    evidence: {
      ts: evidence.ts,
      sessionId: evidence.sessionId,
      threadId: evidence.threadId,
      turnIndex: evidence.turnIndex,
      sessionState
    }
  };
}

/**
 * Evaluate how a policy performed on a set of historical decisions.
 * @param {object} params
 * @param {array} params.evidenceSet - array of evidence events
 * @param {string} params.policyVersion - policy version to compare against
 * @returns {object} - evaluation summary
 */
export function evaluatePolicyOnEvidence({ evidenceSet = [], policyVersion = POLICY_VERSION }) {
  if (!Array.isArray(evidenceSet) || evidenceSet.length === 0) {
    return {
      status: "no_evidence",
      totalDecisions: 0
    };
  }

  const results = evidenceSet.map((evidence) =>
    replayRoutingDecision({ evidence, policyVersion })
  );

  const matchCount = results.filter((r) => r.matches).length;
  const matchRate = results.length > 0 ? matchCount / results.length : 0;

  const avgConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length
    : 0;

  const switchingReasons = {};
  results.forEach((r) => {
    const reason = r.switchingReason || "no_switch";
    switchingReasons[reason] = (switchingReasons[reason] || 0) + 1;
  });

  return {
    status: "evaluated",
    totalDecisions: results.length,
    matchCount,
    matchRate: (matchRate * 100).toFixed(1) + "%",
    avgConfidence: (avgConfidence * 100).toFixed(1) + "%",
    switchingReasons,
    results
  };
}