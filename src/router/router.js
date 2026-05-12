import { MODE_TO_REQUIREMENTS, resolveSessionMode } from "./session_controller.js";
import {
  classifyPrompt,
  TASK_TYPE_TO_ADDITIONAL_REQUIREMENTS
} from "./classifier.js";

export { classifyPrompt } from "./classifier.js";

const MODE_TO_CLASS = {
  plan: "medium_reasoning",
  implement: "strong_coding",
  debug: "strong_coding",
  review: "medium_reasoning",
  summarize: "cheap_fast",
  agent_workflow: "medium_reasoning",
  out_of_domain: "medium_reasoning"
};

const CLASS_TO_LABEL = {
  cheap_fast: "quick",
  medium_reasoning: "balanced",
  strong_reasoning: "deep reasoning",
  strong_coding: "best coder"
};

const LABEL_TO_CLASS_RANK = {
  quick: 1,
  balanced: 2,
  "deep reasoning": 3,
  "best coder": 4
};

const LOW_CONFIDENCE_THRESHOLD = 0.7;

const PRIVACY_TIER_RANK = {
  external: 1,
  standard: 2,
  restricted: 3,
  local: 4,
  unknown: 0
};

const CONTINUITY_DECISION = {
  STAY: "stay_on_current_target",
  SELECT_WITHOUT_CURRENT: "select_target_without_current_context",
  AVOID_SWITCH: "avoid_switch_due_to_continuity_cost",
  SWITCH: "switch_target",
  NO_SELECTED_TARGET: "no_selected_target"
};

function buildRequiredCapabilities(resolvedMode, taskType) {
  const modeRequirements = MODE_TO_REQUIREMENTS[resolvedMode] || ["chat"];
  const additionalRequirements = TASK_TYPE_TO_ADDITIONAL_REQUIREMENTS[taskType] || [];
  return [...new Set([...modeRequirements, ...additionalRequirements])];
}

function resolveProjectOverrideLabel(session = {}, mode) {
  const override = session.projectOverride;
  if (!override || typeof override !== "object") return null;

  if (override.forceLabel && typeof override.forceLabel === "string") {
    return override.forceLabel;
  }

  if (override.modeLabelMap && typeof override.modeLabelMap === "object") {
    return override.modeLabelMap[mode] || null;
  }

  if (override.preferLabel && typeof override.preferLabel === "string") {
    return override.preferLabel;
  }

  return null;
}

function evaluateHardConstraintBlockers(target, requiredCapabilities, hardConstraintInputs = {}) {
  const missingCapabilities = requiredCapabilities.filter((cap) => !target.capabilities.includes(cap));
  const constraintReasons = [];

  if (hardConstraintInputs.availability === "enforced" && target.availability && target.availability !== "available") {
    constraintReasons.push("target_unavailable");
  }

  if (hardConstraintInputs.privacy === "enforced") {
    const requestedPrivacy = hardConstraintInputs.requiredPrivacyTier;
    if (requestedPrivacy) {
      const targetTier = target.privacy_tier || "unknown";
      const targetRank = PRIVACY_TIER_RANK[targetTier] ?? PRIVACY_TIER_RANK.unknown;
      const requiredRank = PRIVACY_TIER_RANK[requestedPrivacy] ?? PRIVACY_TIER_RANK.unknown;
      if (targetRank < requiredRank) {
        constraintReasons.push("privacy_tier_below_required");
      }
    }
  }

  if (hardConstraintInputs.clientCompatibility === "enforced" && hardConstraintInputs.clientSurface) {
    const surfaces = Array.isArray(target.client_surfaces) ? target.client_surfaces : null;
    if (surfaces && !surfaces.includes(hardConstraintInputs.clientSurface)) {
      constraintReasons.push("client_surface_incompatible");
    }
  }

  return {
    missingCapabilities,
    constraintReasons,
    blocked: missingCapabilities.length > 0 || constraintReasons.length > 0
  };
}

function buildConstraintInputs(session = {}) {
  return {
    hardConstraints: {
      privacy: session?.policyInputs?.hardConstraints?.privacy || "off",
      availability: session?.policyInputs?.hardConstraints?.availability || "off",
      clientCompatibility: session?.policyInputs?.hardConstraints?.clientCompatibility || "off",
      requiredPrivacyTier: session?.policyInputs?.hardConstraints?.requiredPrivacyTier || null,
      clientSurface: session?.policyInputs?.hardConstraints?.clientSurface || session.clientSurface || null
    },
    softConstraints: {
      userPreference: session.routingOverride || "auto",
      projectOverride: session.projectOverride || null
    }
  };
}

function strongerClass(currentClass, candidateClass) {
  const currentRank = LABEL_TO_CLASS_RANK[CLASS_TO_LABEL[currentClass]] || 0;
  const candidateRank = LABEL_TO_CLASS_RANK[CLASS_TO_LABEL[candidateClass]] || 0;
  return candidateRank > currentRank ? candidateClass : currentClass;
}

function preferredLabelOrderFor(desiredLabel) {
  let fallbackOrder;
  if (desiredLabel === "best coder") {
    fallbackOrder = ["best coder", "deep reasoning", "balanced", "quick"];
  } else if (desiredLabel === "deep reasoning") {
    fallbackOrder = ["deep reasoning", "best coder", "balanced", "quick"];
  } else if (desiredLabel === "quick") {
    fallbackOrder = ["quick", "balanced", "deep reasoning", "best coder"];
  } else {
    fallbackOrder = ["balanced", "deep reasoning", "best coder", "quick"];
  }

  return [desiredLabel, ...fallbackOrder.filter((label) => label !== desiredLabel)];
}

function resolveEscalationPolicy({ classification = {}, session = {}, mode }) {
  let desiredClass = MODE_TO_CLASS[mode] || "medium_reasoning";
  const reasons = [];

  const lowConfidence = Number(classification.confidence || 0) < LOW_CONFIDENCE_THRESHOLD;
  const userCorrection = classification.reason === "user_correction_signal";
  const repeatedFailures =
    Number(session?.failureSignals?.recentToolFailures || 0) +
      Number(session?.failureSignals?.recentTestFailures || 0) >=
    2;
  const highRiskImplementation = mode === "implement" && session.riskLevel === "high";

  if (userCorrection) {
    desiredClass = strongerClass(desiredClass, "strong_reasoning");
    reasons.push("user_correction");
  }

  if (repeatedFailures && mode !== "summarize") {
    const repeatedFailureClass = ["implement", "debug"].includes(mode)
      ? "strong_coding"
      : "strong_reasoning";
    desiredClass = strongerClass(desiredClass, repeatedFailureClass);
    reasons.push("repeated_failures");
  }

  if (highRiskImplementation) {
    desiredClass = strongerClass(desiredClass, "strong_coding");
    reasons.push("high_risk_implementation");
  }

  if (lowConfidence && ["implement", "debug", "review"].includes(mode)) {
    const lowConfidenceClass = mode === "review" ? "strong_reasoning" : "strong_coding";
    desiredClass = strongerClass(desiredClass, lowConfidenceClass);
    reasons.push("low_confidence");
  }

  if (classification.escalate) {
    const escalatedClass = strongerClass(desiredClass, classification.escalate);
    if (escalatedClass !== desiredClass) {
      desiredClass = escalatedClass;
      reasons.push("classification_escalation");
    }
  }

  return {
    applied: reasons.length > 0,
    reasons,
    desiredClass,
    signals: {
      lowConfidence,
      userCorrection,
      repeatedFailures,
      highRiskImplementation
    }
  };
}

function describeCurrentTargetStatus({ session, targets = [], eligible = [], blocked = [] }) {
  const currentTargetId = session.currentTargetId || null;
  if (!currentTargetId) {
    return {
      currentTarget: null,
      eligibleCurrentTarget: null,
      status: "missing_current_target"
    };
  }

  const currentTarget = targets.find((target) => target.id === currentTargetId) || null;
  const eligibleCurrentTarget = eligible.find((target) => target.id === currentTargetId) || null;
  const blockedCurrentTarget = blocked.find((target) => target.id === currentTargetId) || null;

  if (!currentTarget) {
    return {
      currentTarget: null,
      eligibleCurrentTarget: null,
      status: "missing_current_target"
    };
  }

  if (eligibleCurrentTarget) {
    return {
      currentTarget,
      eligibleCurrentTarget,
      status: "eligible_current_target"
    };
  }

  if (blockedCurrentTarget) {
    return {
      currentTarget,
      eligibleCurrentTarget: null,
      status: "ineligible_current_target",
      blockedCurrentTarget
    };
  }

  return {
    currentTarget,
    eligibleCurrentTarget: null,
    status: "missing_current_target"
  };
}

function applyContinuitySwitchPolicy({ selectedTarget, session, targets, eligible, blocked, mode }) {
  const currentTargetInfo = describeCurrentTargetStatus({ session, targets, eligible, blocked });
  const currentTarget = currentTargetInfo.eligibleCurrentTarget;

  const turnCount = Number(session.turnCount || 0);
  const continuityCost = turnCount >= 8 ? "high" : turnCount >= 3 ? "medium" : "low";

  if (!selectedTarget || !currentTarget || selectedTarget.id === currentTarget.id) {
    return {
      selectedTarget,
      continuityCost,
      continuityDecision: !selectedTarget
        ? CONTINUITY_DECISION.NO_SELECTED_TARGET
        : currentTarget
          ? CONTINUITY_DECISION.STAY
          : CONTINUITY_DECISION.SELECT_WITHOUT_CURRENT,
      continuityReason: !selectedTarget
        ? "no_selected_target"
        : currentTarget
          ? "same_target"
          : currentTargetInfo.status === "ineligible_current_target"
            ? "current_target_ineligible"
            : "no_current_target"
    };
  }

  const selectedRank = LABEL_TO_CLASS_RANK[selectedTarget.label] || 0;
  const currentRank = LABEL_TO_CLASS_RANK[currentTarget.label] || 0;
  const qualityGain = selectedRank > currentRank;

  if (continuityCost === "high" && !qualityGain && mode !== "summarize" && session.routingOverride !== "stronger") {
    return {
      selectedTarget: currentTarget,
      continuityCost,
      continuityDecision: CONTINUITY_DECISION.AVOID_SWITCH,
      continuityReason: "high_continuity_cost_low_incremental_gain"
    };
  }

  return {
    selectedTarget,
    continuityCost,
    continuityDecision: CONTINUITY_DECISION.SWITCH,
    continuityReason: qualityGain ? "quality_gain" : "cost_or_latency_gain"
  };
}

function selectByLabelPriority(eligible, preferredLabelOrder) {
  for (const label of preferredLabelOrder) {
    const found = eligible.find((target) => target.label === label);
    if (found) return found;
  }
  return eligible[0] || null;
}

function applyRoutingOverride({ eligible, desiredLabel, session, targets = [], blocked = [] }) {
  const override = session.routingOverride || "auto";
  const currentTargetInfo = describeCurrentTargetStatus({
    session,
    targets,
    eligible,
    blocked
  });
  const currentTarget = currentTargetInfo.eligibleCurrentTarget;

  if (override === "stronger") {
    const target = selectByLabelPriority(eligible, ["best coder", "deep reasoning", desiredLabel, "balanced", "quick"]);
    return {
      target,
      override,
      overrideApplied: target?.label !== desiredLabel,
      overrideReason: target ? "user_requested_stronger_target" : "no_eligible_stronger_target"
    };
  }

  if (override === "cheaper") {
    const target = selectByLabelPriority(eligible, ["quick", "balanced", desiredLabel, "best coder"]);
    return {
      target,
      override,
      overrideApplied: target?.label !== desiredLabel,
      overrideReason: target?.label === "quick"
        ? "user_preferred_cheaper_target"
        : "cheaper_target_lacks_required_capabilities"
    };
  }

  if (override === "stay") {
    return {
      target: currentTarget || null,
      override,
      overrideApplied: Boolean(currentTarget),
      overrideReason: currentTarget
        ? "user_requested_stay_on_current_target"
        : currentTargetInfo.status === "ineligible_current_target"
          ? "current_target_blocked_by_hard_constraints"
          : "current_target_lacks_required_capabilities"
    };
  }

  return {
    target: null,
    override: "auto",
    overrideApplied: false,
    overrideReason: null
  };
}

export function routePrompt({
  input,
  session = {},
  targets = [],
  executionSupported = false
}) {
  const classification = classifyPrompt(input);
  const modeResolution = resolveSessionMode(session, classification);
  const mode = modeResolution.resolvedMode;
  const requiredCapabilities = buildRequiredCapabilities(mode, classification.taskType);
  const escalationPolicy = resolveEscalationPolicy({ classification, session, mode });
  const desiredClass = escalationPolicy.desiredClass;
  const projectOverrideLabel = resolveProjectOverrideLabel(session, mode);
  const desiredLabel = projectOverrideLabel || CLASS_TO_LABEL[desiredClass] || "balanced";

  const constraintInputs = buildConstraintInputs(session);
  const blocked = [];
  const eligible = [];
  for (const target of targets) {
    const blocker = evaluateHardConstraintBlockers(target, requiredCapabilities, constraintInputs.hardConstraints);
    if (blocker.blocked) {
      blocked.push({
        id: target.id,
        missingCapabilities: blocker.missingCapabilities,
        constraintReasons: blocker.constraintReasons
      });
      continue;
    }
    eligible.push(target);
  }

  const overrideSelection = applyRoutingOverride({ eligible, desiredLabel, session, targets, blocked });
  const preferredOrder = preferredLabelOrderFor(desiredLabel);
  const preferredTarget = overrideSelection.target || selectByLabelPriority(eligible, preferredOrder);
  const continuitySelection = applyContinuitySwitchPolicy({
    selectedTarget: preferredTarget,
    session,
    targets,
    eligible,
    blocked,
    mode
  });
  const selectedTarget = continuitySelection.selectedTarget;
  const currentTargetId = session.currentTargetId || null;
  const shouldSwitch = Boolean(selectedTarget && currentTargetId && selectedTarget.id !== currentTargetId);

  if (!selectedTarget) {
    const hasConstraintBlockers = blocked.some((entry) => Array.isArray(entry.constraintReasons) && entry.constraintReasons.length > 0);
    const refusalExplanation = hasConstraintBlockers
      ? "No eligible target satisfies required capabilities and hard constraints for this turn."
      : "No eligible target satisfies required capabilities for this turn.";

    return {
      status: "refused",
      reason: "no_eligible_target",
      mode,
      taskType: classification.taskType,
      requiredCapabilities,
      blocked,
      classification,
      modeResolution,
      policyInputs: constraintInputs,
      escalationPolicy,
      routingOverride: {
        requested: overrideSelection.override,
        applied: overrideSelection.overrideApplied,
        reason: overrideSelection.overrideReason
      },
      explanation: refusalExplanation
    };
  }

  const action = executionSupported
    ? "execute_now"
    : "recommend_switch_or_continue";

  const whyParts = [];
  if (mode === "implement") whyParts.push("implementation");
  if (mode === "debug") whyParts.push("debugging and tests");
  if (mode === "review") whyParts.push("review reasoning");
  if (mode === "summarize") whyParts.push("low-risk summary");
  if (mode === "plan") whyParts.push("planning/tradeoff analysis");

  if (requiredCapabilities.includes("file_edit")) whyParts.push("repo edits");
  if (requiredCapabilities.includes("test_execution")) whyParts.push("test execution");

  if (escalationPolicy.applied) {
    whyParts.push(`escalation(${escalationPolicy.reasons.join(",")})`);
  }

  return {
    status: "ok",
    action,
    mode,
    taskType: classification.taskType,
    selectedTarget,
    shouldSwitch,
    continuityCost: continuitySelection.continuityCost,
    continuityDecision: continuitySelection.continuityDecision,
    continuityReason: continuitySelection.continuityReason,
    requiredCapabilities,
    blocked,
    classification,
    modeResolution,
    policyInputs: constraintInputs,
    escalationPolicy,
    routingOverride: {
      requested: overrideSelection.override,
      applied: overrideSelection.overrideApplied,
      reason: overrideSelection.overrideReason
    },
    explanation: `Recommended: ${selectedTarget.label}\nWhy: ${whyParts.join(" + ")}.`
  };
}
