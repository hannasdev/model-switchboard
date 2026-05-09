const MODE_TO_REQUIREMENTS = {
  plan: ["chat", "reasoning", "structured_output"],
  implement: ["repo_context", "file_read", "file_edit"],
  debug: ["repo_context", "file_read", "shell_execution", "test_execution"],
  review: ["repo_context", "file_read", "reasoning", "structured_output"],
  summarize: ["chat", "structured_output"],
  agent_workflow: ["chat", "reasoning", "structured_output"],
  out_of_domain: ["chat"]
};

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

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function classifyPrompt(input) {
  const text = input.trim().toLowerCase();

  if (text.length === 0) {
    return { mode: "summarize", confidence: 0.3, reason: "empty_input" };
  }

  if (hasAny(text, ["thanks", "thank you", "thx"])) {
    return { mode: "summarize", confidence: 0.95, reason: "acknowledgement" };
  }

  if (hasAny(text, ["test suite is failing", "fix it", "failing test", "debug", "error"])) {
    return { mode: "debug", confidence: 0.88, reason: "debug_signal" };
  }

  if (hasAny(text, ["implement", "apply the plan", "/implement", "/apply"])) {
    return { mode: "implement", confidence: 0.9, reason: "implementation_signal" };
  }

  if (hasAny(text, ["review", "auth change", "pr review"])) {
    return { mode: "review", confidence: 0.8, reason: "review_signal" };
  }

  if (hasAny(text, ["wrong assumption", "you are wrong", "that's wrong"])) {
    return { mode: "plan", confidence: 0.75, reason: "user_correction_signal", escalate: "strong_reasoning" };
  }

  if (hasAny(text, ["tradeoff", "compare", "architecture", "plan"])) {
    return { mode: "plan", confidence: 0.86, reason: "planning_signal" };
  }

  return { mode: "plan", confidence: 0.6, reason: "fallback_plan" };
}

function includesAllCapabilities(target, requiredCaps) {
  return requiredCaps.every((cap) => target.capabilities.includes(cap));
}

function selectByLabelPriority(eligible, preferredLabelOrder) {
  for (const label of preferredLabelOrder) {
    const found = eligible.find((target) => target.label === label);
    if (found) return found;
  }
  return eligible[0] || null;
}

export function routePrompt({
  input,
  session = {},
  targets = [],
  executionSupported = false
}) {
  const classification = classifyPrompt(input);
  const mode = classification.mode;
  const requiredCapabilities = MODE_TO_REQUIREMENTS[mode] || ["chat"];
  const desiredClass = classification.escalate || MODE_TO_CLASS[mode] || "medium_reasoning";
  const desiredLabel = CLASS_TO_LABEL[desiredClass] || "balanced";

  const eligible = targets.filter((target) => includesAllCapabilities(target, requiredCapabilities));
  const blocked = targets
    .filter((target) => !includesAllCapabilities(target, requiredCapabilities))
    .map((target) => ({
      id: target.id,
      missingCapabilities: requiredCapabilities.filter((cap) => !target.capabilities.includes(cap))
    }));

  const preferredOrder = [desiredLabel, "balanced", "deep reasoning", "best coder", "quick"];
  const selectedTarget = selectByLabelPriority(eligible, preferredOrder);
  const currentTargetId = session.currentTargetId || null;
  const shouldSwitch = Boolean(selectedTarget && currentTargetId && selectedTarget.id !== currentTargetId);

  if (!selectedTarget) {
    return {
      status: "refused",
      reason: "no_eligible_target",
      mode,
      requiredCapabilities,
      blocked,
      classification,
      explanation: "No eligible target satisfies required capabilities for this turn."
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

  return {
    status: "ok",
    action,
    mode,
    selectedTarget,
    shouldSwitch,
    requiredCapabilities,
    blocked,
    classification,
    explanation: `Recommended: ${selectedTarget.label}\nWhy: ${whyParts.join(" + ")}.`
  };
}
