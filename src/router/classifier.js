export const TASK_TYPE_TO_ADDITIONAL_REQUIREMENTS = {
  failing_tests: ["test_execution"],
  multi_file_refactor: ["file_edit"],
  code_review: ["reasoning", "structured_output"]
};

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function classifyPrompt(input) {
  const text = input.trim().toLowerCase();

  if (text.length === 0) {
    return {
      taskType: "handoff_summary",
      proposedMode: "summarize",
      confidence: 0.3,
      reason: "empty_input",
      modeStrongSignal: true,
      explicitModeShift: false
    };
  }

  if (hasAny(text, ["thanks", "thank you", "thx"])) {
    return {
      taskType: "simple_explanation",
      proposedMode: "summarize",
      confidence: 0.95,
      reason: "acknowledgement",
      modeStrongSignal: true,
      explicitModeShift: false
    };
  }

  if (hasAny(text, ["test suite is failing", "fix it", "failing test", "debug", "error"])) {
    return {
      taskType: "failing_tests",
      proposedMode: "debug",
      confidence: 0.88,
      reason: "debug_signal",
      modeStrongSignal: true,
      explicitModeShift: true
    };
  }

  if (hasAny(text, ["implement", "apply the plan", "/implement", "/apply"])) {
    return {
      taskType: "multi_file_refactor",
      proposedMode: "implement",
      confidence: 0.9,
      reason: "implementation_signal",
      modeStrongSignal: true,
      explicitModeShift: true
    };
  }

  if (hasAny(text, ["review", "auth change", "pr review"])) {
    return {
      taskType: "code_review",
      proposedMode: "review",
      confidence: 0.8,
      reason: "review_signal",
      modeStrongSignal: true,
      explicitModeShift: true
    };
  }

  if (hasAny(text, ["wrong assumption", "you are wrong", "that's wrong"])) {
    return {
      taskType: "architecture_decision",
      proposedMode: "plan",
      confidence: 0.75,
      reason: "user_correction_signal",
      escalate: "strong_reasoning",
      modeStrongSignal: true,
      explicitModeShift: false
    };
  }

  if (hasAny(text, ["tradeoff", "compare", "architecture", "plan"])) {
    return {
      taskType: "compare_tradeoffs",
      proposedMode: "plan",
      confidence: 0.86,
      reason: "planning_signal",
      modeStrongSignal: true,
      explicitModeShift: false
    };
  }

  return {
    taskType: "project_discussion",
    proposedMode: "plan",
    confidence: 0.6,
    reason: "fallback_plan",
    modeStrongSignal: false,
    explicitModeShift: false
  };
}