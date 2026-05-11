/**
 * Outcome Attribution Constants (Milestone 4)
 *
 * Minimal taxonomy for tracking routing decision quality.
 * These enums map to RoutingLogEvent.outcome and .attribution fields.
 */

export const EXECUTION_STATUS = {
  EXECUTED: "executed",
  FAILED: "failed",
  PLANNED: "planned"
};

/**
 * Error signals indicate why a decision or execution failed.
 * Maps to RoutingLogEvent.outcome.errorSignal
 */
export const ERROR_SIGNAL = {
  SUCCESS: null,  // explicitly null for "no error"
  TOOL_FAILURE: "tool_failure",
  TEST_FAILURE: "test_failure",
  EXECUTION_TIMEOUT: "execution_timeout",
  AUTH_FAILURE: "auth_failure",
  HOOK_CORRELATION_MISS: "hook_correlation_miss",
  TARGET_NOT_AVAILABLE: "target_not_available",
  LOW_CONFIDENCE_ESCALATION: "low_confidence_escalation",
  USER_CORRECTION_NEEDED: "user_correction_needed"
};

/**
 * Switching reasons explain why the router chose a different target.
 * Maps to RoutingLogEvent.attribution.switchingReason
 */
export const SWITCHING_REASON = {
  NO_SWITCH: null,  // explicitly null for "stayed on current"
  CONTINUITY_COST: "continuity_cost",
  CAPABILITY_GAP: "capability_gap",
  USER_OVERRIDE: "user_override",
  ESCALATION: "escalation",
  AVAILABILITY: "availability"
};

/**
 * Execution statuses for decision outcomes.
 * Used to populate RoutingLogEvent.outcome.executionStatus
 */
export const OUTCOME_EXECUTION = {
  EXECUTED: EXECUTION_STATUS.EXECUTED,
  FAILED: EXECUTION_STATUS.FAILED,
  PLANNED: EXECUTION_STATUS.PLANNED
};

/**
 * Success signals (optional, for enriching positive outcomes).
 * Complement to ERROR_SIGNAL.
 */
export const SUCCESS_SIGNAL = {
  FIRST_TRY: "completed_on_first_try",
  REQUIRED_ESCALATION: "required_escalation_but_succeeded",
  FALLBACK_ACCEPTABLE: "fallback_acceptable",
  CONTINUITY_PRESERVED: "continuity_preserved"
};

/**
 * Policy versions for attribution tracking.
 * Should be updated when policy logic changes.
 */
export const POLICY_VERSION = "0.1.0-experimental";

/**
 * Determine error signal from execution status.
 * @param {string} status - execution status ("executed" | "failed" | "planned")
 * @param {object} executionResult - execution result from child process
 * @returns {string|null} - error signal or null for success
 */
export function determineErrorSignal(status, executionResult) {
  // Planned turns don't have errors
  if (status === EXECUTION_STATUS.PLANNED) {
    return ERROR_SIGNAL.SUCCESS;
  }

  // Failed execution
  if (status === EXECUTION_STATUS.FAILED) {
    // Check for specific failure modes if detailed info is available
    if (executionResult?.error?.message?.includes("auth")) {
      return ERROR_SIGNAL.AUTH_FAILURE;
    }
    if (executionResult?.signal === "SIGTERM") {
      return ERROR_SIGNAL.EXECUTION_TIMEOUT;
    }
    // Generic tool/test failure determined from stderr
    return ERROR_SIGNAL.TOOL_FAILURE;
  }

  // Successful execution
  return ERROR_SIGNAL.SUCCESS;
}

/**
 * Generate a deterministic decision ID.
 * @param {object} params - parameters for ID generation
 * @returns {string} - unique decision ID
 */
export function generateDecisionId({ sessionId, threadId, turnCount }) {
  // Deterministic hash using available fields
  // In a real system, this could use crypto.createHash
  const input = `${sessionId}:${threadId}:${turnCount}`;
  const hash = input.split("").reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `decision_${Math.abs(hash).toString(36)}_t${turnCount}`;
}

/**
 * Determine switching reason from routing decision.
 * @param {object} routingDecision - the routing decision
 * @param {object} previousTargetId - the previously selected target
 * @returns {string|null} - switching reason
 */
export function determineSwitchingReason(routingDecision, previousTargetId) {
  const selectedId = routingDecision?.selectedTargetId;

  // No switch
  if (selectedId === previousTargetId) {
    return SWITCHING_REASON.NO_SWITCH;
  }

  // Determine reason for switch
  if (routingDecision?.escalationPolicy?.applied) {
    return SWITCHING_REASON.ESCALATION;
  }

  if (routingDecision?.routingOverride?.applied && routingDecision?.routingOverride?.requested !== "auto") {
    return SWITCHING_REASON.USER_OVERRIDE;
  }

  // Check if continuity cost drove the decision
  if (routingDecision?.continuityCost && routingDecision?.continuityCost !== "low") {
    return SWITCHING_REASON.CONTINUITY_COST;
  }

  // Check if capability gap
  if (routingDecision?.hardConstraintResults?.blocked?.length > 0) {
    const previousWasBlocked = routingDecision.hardConstraintResults.blocked.some(
      (b) => b.targetId === previousTargetId
    );
    if (previousWasBlocked) {
      return SWITCHING_REASON.CAPABILITY_GAP;
    }
  }

  // Default: switching reason not determined
  return SWITCHING_REASON.NO_SWITCH;
}
