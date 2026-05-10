import path from "node:path";
import { fileURLToPath } from "node:url";
export { executeClaudeCliLaunch, getClaudeCliTargetSelection, planClaudeCliLaunch } from "../switchboard/claude_cli_launcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_LOG_PATH = path.join(__dirname, "logs", "claude-cli-launches.ndjson");
