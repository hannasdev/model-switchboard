import { getTargetProfileMap } from "../model_mappings.js";

export const GEMINI_TARGET_TO_PROFILE = getTargetProfileMap("google-gemini");

export function createGeminiAdapter(client) {
  if (!client || typeof client.execute !== "function") {
    throw new Error("gemini_adapter_requires_execute_client");
  }

  return {
    vendor: "google-gemini",

    async executeRoutedTurn({ input, routeResult, session = {} }) {
      if (!routeResult || routeResult.status !== "ok") {
        return {
          status: "not_executed",
          reason: "route_not_ok",
          routeStatus: routeResult?.status || "missing_route"
        };
      }

      const targetId = routeResult.selectedTarget?.id;
      const profile = GEMINI_TARGET_TO_PROFILE[targetId];

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
        adapter: "google-gemini",
        targetId,
        profile,
        response
      };
    }
  };
}

export function createMockGeminiClient() {
  return {
    async execute(request) {
      return {
        result: "ok",
        provider: "google-gemini",
        profile: request.profile,
        echoMode: request.mode,
        trace: "simulated_adapter_spike"
      };
    }
  };
}
