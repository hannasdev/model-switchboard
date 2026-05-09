import { routePrompt } from "./router.js";
import { runCapabilityAction } from "./capability_actions.js";

export function executeProductionHookTurn({
  input,
  session = {},
  targets = [],
  repoRoot,
  toolAction = "read_file",
  runCommand
}) {
  const routeResult = routePrompt({
    input,
    session,
    targets,
    executionSupported: true
  });

  if (routeResult.status !== "ok") {
    return {
      status: "not_executed",
      reason: "route_not_ok",
      route: routeResult,
      nextSession: {
        ...session,
        turnCount: (session.turnCount || 0) + 1
      }
    };
  }

  const selectedLabel = routeResult.selectedTarget?.label || "";
  if (selectedLabel !== "best coder") {
    return {
      status: "executed_without_tools",
      reason: "target_not_tool_capable",
      route: routeResult,
      execution: {
        action: "none",
        selectedLabel
      },
      nextSession: {
        ...session,
        currentTargetId: routeResult.selectedTarget?.id || session.currentTargetId || null,
        turnCount: (session.turnCount || 0) + 1
      }
    };
  }

  const execution = runCapabilityAction({ toolAction, repoRoot, runCommand });
  return {
    status: execution.status === "ok" ? "executed" : "failed",
    route: routeResult,
    execution,
    nextSession: {
      ...session,
      currentTargetId: routeResult.selectedTarget?.id || session.currentTargetId || null,
      turnCount: (session.turnCount || 0) + 1
    }
  };
}
