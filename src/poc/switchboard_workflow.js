import {
  executeSwitchboardContinuityProbe as executeProductSwitchboardContinuityProbe,
  executeSwitchboardTurn as executeProductSwitchboardTurn,
  explainLatestSwitchboardTurn as explainProductLatestSwitchboardTurn,
  planSwitchboardContinuityProbe as planProductSwitchboardContinuityProbe,
  planSwitchboardTurn as planProductSwitchboardTurn
} from "../switchboard/workflow.js";
import {
  DEFAULT_CLAUDE_HOOK_LOG_PATH,
  DEFAULT_ROUTE_CONTEXT_PATH,
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "./paths.js";

export {
  DEFAULT_CLAUDE_HOOK_LOG_PATH,
  DEFAULT_ROUTE_CONTEXT_PATH,
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "./paths.js";

function withPocPaths(options = {}) {
  return {
    ...options,
    storePath: options.storePath || DEFAULT_SWITCHBOARD_STORE_PATH,
    logPath: options.logPath || DEFAULT_SWITCHBOARD_LOG_PATH,
    routeContextPath: options.routeContextPath || DEFAULT_ROUTE_CONTEXT_PATH
  };
}

export function planSwitchboardTurn(options) {
  return planProductSwitchboardTurn(withPocPaths(options));
}

export function executeSwitchboardTurn(options) {
  return executeProductSwitchboardTurn(withPocPaths(options));
}

export function planSwitchboardContinuityProbe(options) {
  return planProductSwitchboardContinuityProbe(withPocPaths(options));
}

export function executeSwitchboardContinuityProbe(options) {
  return executeProductSwitchboardContinuityProbe(withPocPaths(options));
}

export function explainLatestSwitchboardTurn(options) {
  const resolvedOptions = withPocPaths(options);
  return explainProductLatestSwitchboardTurn({
    ...resolvedOptions,
    hookLogPath: options?.hookLogPath || DEFAULT_CLAUDE_HOOK_LOG_PATH
  });
}
