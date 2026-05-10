import { GoogleGenAI } from "@google/genai";
import { getProfileModelMap } from "./model_mappings.js";

const PROFILE_TO_MODEL = getProfileModelMap("google-gemini");

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
