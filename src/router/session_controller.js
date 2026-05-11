const MODE_TO_REQUIREMENTS = {
  plan: ["chat", "reasoning", "structured_output"],
  implement: ["repo_context", "file_read", "file_edit"],
  debug: ["repo_context", "file_read", "shell_execution", "test_execution"],
  review: ["repo_context", "file_read", "reasoning", "structured_output"],
  summarize: ["chat", "structured_output"],
  agent_workflow: ["chat", "reasoning", "structured_output"],
  out_of_domain: ["chat"]
};

const MODE_VALUES = new Set(Object.keys(MODE_TO_REQUIREMENTS));

export { MODE_TO_REQUIREMENTS, MODE_VALUES };

export function resolveSessionMode(session = {}, classification = {}) {
  const currentMode = MODE_VALUES.has(session.mode) ? session.mode : null;
  const proposedMode = MODE_VALUES.has(classification.proposedMode)
    ? classification.proposedMode
    : "plan";

  if (!currentMode) {
    return {
      previousMode: null,
      proposedMode,
      resolvedMode: proposedMode,
      transitionReason: "no_previous_mode"
    };
  }

  if (classification.explicitModeShift) {
    return {
      previousMode: currentMode,
      proposedMode,
      resolvedMode: proposedMode,
      transitionReason: "explicit_task_signal"
    };
  }

  if (proposedMode === "summarize") {
    return {
      previousMode: currentMode,
      proposedMode,
      resolvedMode: proposedMode,
      transitionReason: "acknowledgement_summary"
    };
  }

  if (!classification.modeStrongSignal && ["implement", "debug", "review"].includes(currentMode)) {
    return {
      previousMode: currentMode,
      proposedMode,
      resolvedMode: currentMode,
      transitionReason: "preserve_current_mode_for_ambiguous_turn"
    };
  }

  return {
    previousMode: currentMode,
    proposedMode,
    resolvedMode: proposedMode,
    transitionReason: "default_mode_resolution"
  };
}
