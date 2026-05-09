import { GoogleGenAI } from "@google/genai";

const PROFILE_TO_MODEL = {
  "gemini-fast": "gemini-2.5-flash",
  "gemini-balanced": "gemini-2.5-flash",
  "gemini-best-coder": "gemini-2.5-pro"
};

export function createGeminiSDKClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      kind: "sdk_unavailable",
      reason: "missing_gemini_api_key",
      async execute() {
        return {
          result: "not_executed",
          reason: "missing_gemini_api_key"
        };
      }
    };
  }

  const ai = new GoogleGenAI({ apiKey });

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

      const response = await ai.models.generateContent({
        model,
        contents: request.input
      });

      return {
        result: "ok",
        provider: "google-gemini",
        profile: request.profile,
        model,
        responseId: response?.responseId || null,
        outputText: response?.text || ""
      };
    }
  };
}
