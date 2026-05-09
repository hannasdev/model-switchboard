import { getTargetProfileMap } from "../model_mappings.js";

export const OPENAI_CODEX_TARGET_TO_PROFILE = getTargetProfileMap("openai-codex");

export function createOpenAICodexAdapter(client) {
  if (!client || typeof client.execute !== "function") {
    throw new Error("openai_codex_adapter_requires_execute_client");
  }

  return {
    vendor: "openai-codex",

    async executeRoutedTurn({ input, routeResult, session = {} }) {
      if (!routeResult || routeResult.status !== "ok") {
        return {
          status: "not_executed",
          reason: "route_not_ok",
          routeStatus: routeResult?.status || "missing_route"
        };
      }

      const targetId = routeResult.selectedTarget?.id;
      const profile = OPENAI_CODEX_TARGET_TO_PROFILE[targetId];

      if (!profile) {
        return {
          status: "not_executed",
          reason: "unknown_target_mapping",
          targetId: targetId || null
        };
      }

      const request = {
        profile,
        input,
        mode: routeResult.mode,
        shouldSwitch: routeResult.shouldSwitch,
        requiredCapabilities: routeResult.requiredCapabilities,
        session
      };

      const response = await client.execute(request);
      if (response?.result && response.result !== "ok") {
        return {
          status: "not_executed",
          reason: "client_execution_not_ok",
          targetId,
          profile,
          response
        };
      }

      return {
        status: "executed",
        adapter: "openai-codex",
        targetId,
        profile,
        response
      };
    }
  };
}

export function createMockOpenAIClient() {
  return {
    execute(request) {
      return {
        result: "ok",
        provider: "openai-codex",
        profile: request.profile,
        echoMode: request.mode,
        trace: "simulated_adapter_spike"
      };
    }
  };
}
