import { routePrompt } from "./router.js";
import { runCapabilityAction } from "./capability_actions.js";

export async function executeGatewayTurn({
  request,
  targets,
  adapter,
  executionSupported = true,
  repoRoot = null,
  toolAction = "none",
  runCommand
}) {
  const receivedAt = new Date().toISOString();
  const input = request?.input || "";
  const session = request?.session || {};

  const routeResult = routePrompt({
    input,
    session,
    targets,
    executionSupported
  });
  const routedAt = new Date().toISOString();

  if (routeResult.status !== "ok") {
    return {
      status: "not_executed",
      reason: "route_not_ok",
      hookEvidence: {
        surface: "gateway_entrypoint",
        receivedAt,
        routedAt,
        dispatchedAt: null
      },
      route: routeResult,
      execution: null,
      nextSession: {
        ...session,
        turnCount: (session.turnCount || 0) + 1
      }
    };
  }

  const execution = await adapter.executeRoutedTurn({
    input,
    routeResult,
    session
  });
  const dispatchedAt = new Date().toISOString();
  const selectedLabel = routeResult.selectedTarget?.label || "";
  const capabilityExecution =
    repoRoot && toolAction !== "none" && selectedLabel === "best coder"
      ? runCapabilityAction({ toolAction, repoRoot, runCommand })
      : null;

  return {
    status: execution.status === "executed" ? "executed" : "failed",
    hookEvidence: {
      surface: "gateway_entrypoint",
      receivedAt,
      routedAt,
      dispatchedAt
    },
    route: routeResult,
    execution,
    capabilityExecution,
    nextSession: {
      ...session,
      currentTargetId: routeResult.selectedTarget?.id || session.currentTargetId || null,
      turnCount: (session.turnCount || 0) + 1
    }
  };
}
