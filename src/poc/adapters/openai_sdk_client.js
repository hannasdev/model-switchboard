import OpenAI from "openai";

const PROFILE_TO_MODEL = {
  "codex-fast": "gpt-5.4-mini",
  "codex-balanced": "gpt-5.4",
  "codex-best-coder": "gpt-5.5"
};

export function createOpenAISDKClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      kind: "sdk_unavailable",
      reason: "missing_openai_api_key",
      async execute() {
        return {
          result: "not_executed",
          reason: "missing_openai_api_key"
        };
      }
    };
  }

  const openai = new OpenAI({ apiKey });

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

      const response = await openai.responses.create({
        model,
        input: request.input
      });

      return {
        result: "ok",
        provider: "openai-codex",
        profile: request.profile,
        model,
        responseId: response.id || null,
        outputText: response.output_text || ""
      };
    }
  };
}
