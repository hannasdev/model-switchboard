import {
  loadRouteContext as loadProductRouteContext,
  saveRouteContext as saveProductRouteContext
} from "../switchboard/route_context.js";
import { DEFAULT_ROUTE_CONTEXT_PATH } from "./paths.js";

export { DEFAULT_ROUTE_CONTEXT_PATH } from "./paths.js";

export function saveRouteContext({ storePath = DEFAULT_ROUTE_CONTEXT_PATH, context }) {
  return saveProductRouteContext({ storePath, context });
}

export function loadRouteContext({ storePath = DEFAULT_ROUTE_CONTEXT_PATH, claudeSessionId }) {
  return loadProductRouteContext({ storePath, claudeSessionId });
}
