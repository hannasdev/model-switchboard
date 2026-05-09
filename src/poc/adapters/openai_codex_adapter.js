export const OPENAI_CODEX_TARGET_TO_PROFILE = {
  "openai-quick": "codex-fast",
  "openai-balanced": "codex-balanced",
  "openai-coder": "codex-best-coder"
};

export function createOpenAICodexAdapter(client) {
  if (!client || typeof client.execute !== "function") {
    throw new Error("openai_codex_adapter_requires_execute_client");
  }

  return {
    vendor: "openai-codex",

    executeRoutedTurn({ input, routeResult, session = {} }) {
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

      const response = client.execute(request);

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
