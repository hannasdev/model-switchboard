#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnthropicSDKClient } from "../src/adapters/anthropic_sdk_client.js";
import { createGeminiSDKClient } from "../src/adapters/gemini_sdk_client.js";
import { createOpenAISDKClient } from "../src/adapters/openai_sdk_client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function getArg(flag) {
  const idx = process.argv.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function loadEnvFile(configPath) {
  if (!fs.existsSync(configPath)) return;
  for (const raw of fs.readFileSync(configPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = value;
  }
}

const VENDOR_CONFIG = {
  anthropic: { label: "anthropic-claude", profile: "claude-fast", createClient: createAnthropicSDKClient },
  openai:    { label: "openai-codex",     profile: "codex-fast",  createClient: createOpenAISDKClient },
  gemini:    { label: "google-gemini",    profile: "gemini-fast", createClient: createGeminiSDKClient }
};

async function main() {
  const vendor = getArg("--vendor");
  if (!vendor || !VENDOR_CONFIG[vendor]) {
    process.stderr.write(`Usage: check.js --vendor anthropic|openai|gemini [--input "..."] [--config .env.local]\n`);
    process.exitCode = 1;
    return;
  }

  const configPath = getArg("--config")
    ? path.resolve(process.cwd(), getArg("--config"))
    : path.join(REPO_ROOT, ".env.local");
  loadEnvFile(configPath);

  const input = getArg("--input") || "Connection check. Reply with OK.";
  const { label, profile, createClient } = VENDOR_CONFIG[vendor];
  const client = createClient();
  const response = await client.execute({ profile, input });

  const result = {
    status: response.result === "ok" ? "ok" : "failed",
    vendor: label,
    clientKind: client.kind || "sdk_unknown",
    check: {
      profile,
      model: response.model || null,
      result: response.result,
      reason: response.reason || null,
      responseId: response.responseId || null,
      outputText: response.outputText || ""
    }
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "ok") process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`check failed: ${error.message}\n`);
  process.exitCode = 1;
});
