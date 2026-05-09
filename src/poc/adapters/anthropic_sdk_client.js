import Anthropic from "@anthropic-ai/sdk";

const PROFILE_TO_MODEL = {
  "claude-fast": "claude-haiku-4-5-20251001",
  "claude-balanced": "claude-sonnet-4-6",
  "claude-best-coder": "claude-sonnet-4-6"
};

export function createAnthropicSDKClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      kind: "sdk_unavailable",
      reason: "missing_anthropic_api_key",
      async execute() {
        return {
          result: "not_executed",
          reason: "missing_anthropic_api_key"
        };
      }
    };
  }

  const anthropic = new Anthropic({ apiKey });

  return {
    kind: "sdk_live",
    async execute(request) {
      const model = PROFILE_TO_MODEL[request.profile];
      if (!model) {
        return {
          result: "not_executed",
          reason: "unknown_profile_model_mapping",
          profile: request.profile
        };
      }

      const message = await anthropic.messages.create({
        model,
        max_tokens: 128,
        messages: [{ role: "user", content: request.input }]
      });

      const text = message.content
        .filter((chunk) => chunk.type === "text")
        .map((chunk) => chunk.text)
        .join("\n");

      return {
        result: "ok",
        provider: "anthropic-claude",
        profile: request.profile,
        model,
        responseId: message.id || null,
        outputText: text
      };
    }
  };
}
