import { handleClaudeHookInput as handleProductClaudeHookInput } from "../switchboard/claude_hook_bridge.js";
import {
  DEFAULT_CLAUDE_HOOK_LOG_PATH,
  DEFAULT_ROUTE_CONTEXT_PATH
} from "./paths.js";

export { DEFAULT_CLAUDE_HOOK_LOG_PATH } from "./paths.js";

export function handleClaudeHookInput(hookInput, options = {}) {
  return handleProductClaudeHookInput(hookInput, {
    ...options,
    logPath: options.logPath || DEFAULT_CLAUDE_HOOK_LOG_PATH,
    routeContextPath: options.routeContextPath || DEFAULT_ROUTE_CONTEXT_PATH
  });
}
