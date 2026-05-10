import os from "node:os";
import path from "node:path";

export const DEFAULT_SWITCHBOARD_STATE_DIR = path.join(os.homedir(), ".model-switchboard");
export const DEFAULT_SWITCHBOARD_STORE_PATH = path.join(DEFAULT_SWITCHBOARD_STATE_DIR, "switchboard-sessions.json");
export const DEFAULT_SWITCHBOARD_LOG_PATH = path.join(DEFAULT_SWITCHBOARD_STATE_DIR, "switchboard-turns.ndjson");
export const DEFAULT_ROUTE_CONTEXT_PATH = path.join(DEFAULT_SWITCHBOARD_STATE_DIR, "switchboard-route-context.json");
export const DEFAULT_CLAUDE_HOOK_LOG_PATH = path.join(DEFAULT_SWITCHBOARD_STATE_DIR, "claude-hook-events.ndjson");
