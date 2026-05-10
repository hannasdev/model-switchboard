import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POC_LOG_DIR = path.join(__dirname, "logs");

export const DEFAULT_SWITCHBOARD_LOG_PATH = path.join(POC_LOG_DIR, "switchboard-turns.ndjson");
export const DEFAULT_SWITCHBOARD_STORE_PATH = path.join(POC_LOG_DIR, "switchboard-sessions.json");
export const DEFAULT_ROUTE_CONTEXT_PATH = path.join(POC_LOG_DIR, "switchboard-route-context.json");
export const DEFAULT_CLAUDE_HOOK_LOG_PATH = path.join(POC_LOG_DIR, "claude-hook-events.ndjson");
