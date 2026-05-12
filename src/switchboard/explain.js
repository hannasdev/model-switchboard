import { DEFAULT_SWITCHBOARD_LOG_PATH } from "./paths.js";
import { readJsonIfExists, readNdjson } from "./readers.js";

function reconstructReasoning(routeDecision, routingDecision) {
  if (!routeDecision || !routingDecision) {
    return null;
  }

  const policyInputs = routeDecision.policyInputs || {};
  const hardConstraints = policyInputs.hardConstraints || {};
  const blockedEntries = routingDecision.hardConstraintResults?.blocked || [];
  const blockedTargetsByReason = (reasonMatcher) =>
    blockedEntries
      .filter((blockedEntry) =>
        (blockedEntry.constraintReasons || []).some((reasonCode) => reasonMatcher(reasonCode))
      )
      .map((blockedEntry) => blockedEntry.targetId);

  // Normalize constraint values so missing/undefined fields default to "off"
  const privacyValue = hardConstraints.privacy ?? "off";
  const availabilityValue = hardConstraints.availability ?? "off";
  const clientCompatibilityValue = hardConstraints.clientCompatibility ?? "off";

  // Build constraint evaluation
  const hardConstraintEvaluation = {
    privacy: {
      applied: privacyValue !== "off",
      reason: `Privacy: ${privacyValue}`,
      blockedTargets: blockedTargetsByReason((reasonCode) => reasonCode.startsWith("privacy_"))
    },
    availability: {
      applied: availabilityValue !== "off",
      reason: `Availability: ${availabilityValue}`,
      blockedTargets: blockedTargetsByReason(
        (reasonCode) => reasonCode === "target_unavailable" || reasonCode.includes("availability")
      )
    },
    clientCompatibility: {
      applied: clientCompatibilityValue !== "off",
      reason: `Client compatibility: ${clientCompatibilityValue}`,
      blockedTargets: blockedTargetsByReason(
        (reasonCode) => reasonCode === "client_surface_incompatible" || reasonCode.startsWith("client_")
      )
    }
  };

  // Build soft constraint evaluation
  const userPref = routingDecision.softConstraintInputs?.userPreference || "auto";
  const softConstraintEvaluation = {
    userPreference: userPref,
    projectOverride: routingDecision.softConstraintInputs?.projectOverride || null,
    impact:
      userPref !== "auto"
        ? "influenced_choice"
        : routingDecision.hardConstraintResults?.eligibleTargetIds?.length === 1
          ? "only_eligible_target"
          : "no_influence"
  };

  // Build continuity cost explanation
  const continuityCost = routeDecision.continuityCost || "unknown";
  const continuityDecision = routeDecision.continuityDecision || "unknown";
  const continuityReason = routeDecision.continuityReason || "no continuity reason";

  const continuityCostEval = {
    calculated: continuityCost,
    decision: continuityDecision,
    reason: continuityReason
  };

  // Build rationale
  const selectedLabel = routeDecision.label || "unknown";
  const confidence = routeDecision.confidence ?? 0.5;
  const taskType = routingDecision.taskType || "unknown";
  const mode = routingDecision.mode || "unknown";

  let rationale = `Selected ${selectedLabel} for ${taskType} (${mode} mode)`;
  if (routeDecision.escalationPolicy?.applied) {
    const reasons = routeDecision.escalationPolicy.reasons || [];
    rationale += ` due to escalation: ${reasons.join(", ")}`;
  } else if (continuityDecision !== "stay_on_current_target") {
    rationale += ` (continuity cost: ${continuityCost})`;
  } else {
    rationale += " (low continuity cost, staying current)";
  }

  return {
    taskType,
    modeResolution: routeDecision.modeResolution || null,
    requiredCapabilities: routingDecision.requiredCapabilities || [],
    hardConstraintEvaluation,
    softConstraintEvaluation,
    continuityCost: continuityCostEval,
    selectedTargetRationale: rationale,
    confidence
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

  const routerEvidence = {
    routingDecision:
      latest.routingDecision ||
      latest.router?.routingDecision ||
      latest.legacy?.router?.routingDecision ||
      null,
    routeDecision:
      latest.routeDecision ||
      latest.router?.routeDecision ||
      latest.legacy?.routeDecision ||
      null,
    sessionState:
      latest.sessionState ||
      latest.router?.sessionState ||
      latest.legacy?.router?.sessionState ||
      null,
    contextPackage:
      latest.contextPackage ||
      latest.router?.contextPackage ||
      latest.legacy?.router?.contextPackage ||
      null
  };
  const claudeEvidence = latest.claude || latest.legacy?.claude || {
    selectedClaude: latest.selectedClaude || null,
    execution: latest.execution || null,
    launch: null
  };

  const reasoning = reconstructReasoning(
    latest.routeDecision || latest.router?.routeDecision || latest.legacy?.routeDecision || routerEvidence.routeDecision,
    latest.routingDecision || routerEvidence.routingDecision
  );

  return {
    status: "found",
    threadId: latest.threadId || null,
    userPrompt: latest.userPrompt || null,
    wrapperContext: latest.wrapperContext || null,
    reasoning,
    routerEvidence,
    claudeEvidence,
    routeDecision: latest.routeDecision || null,
    routingDecision: routerEvidence.routingDecision || null,
    selectedClaude: latest.selectedClaude || latest.claude?.selectedClaude || null,
    execution: latest.execution || latest.claude?.execution || null,
    session: latest.session || null,
    routeContext: routeContext
      ? {
          status: "matched",
          latest: routeContext.latest || null,
          sessionState: routeContext.latest?.sessionState || null,
          routingDecision: routeContext.latest?.routingDecision || null,
          contextPackage: routeContext.latest?.contextPackage || null,
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