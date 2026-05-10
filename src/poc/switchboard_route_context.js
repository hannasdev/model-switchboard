import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_ROUTE_CONTEXT_PATH = path.join(__dirname, "logs", "switchboard-route-context.json");

function ensureFile(storePath) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, "{}\n", "utf8");
}

function readStore(storePath) {
  ensureFile(storePath);
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeStore(storePath, store) {
  ensureFile(storePath);
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function saveRouteContext({
  storePath = DEFAULT_ROUTE_CONTEXT_PATH,
  context
}) {
  const sessionId = context?.claudeSessionId;
  if (!sessionId) {
    throw new Error("saveRouteContext requires context.claudeSessionId");
  }

  const store = readStore(storePath);
  const existing = store[sessionId] || { turns: [] };
  const turn = {
    threadId: context.threadId || null,
    claudeSessionId: sessionId,
    turnCount: context.turnCount ?? null,
    routeLabel: context.routeLabel || null,
    targetId: context.targetId || null,
    model: context.model || null,
    effort: context.effort || null,
    mode: context.mode || null,
    executionMode: context.executionMode || null,
    wrapperContext: context.wrapperContext || null,
    updatedAt: new Date().toISOString()
  };

  store[sessionId] = {
    ...existing,
    threadId: turn.threadId || existing.threadId || null,
    claudeSessionId: sessionId,
    latest: turn,
    turns: [...(existing.turns || []), turn]
  };
  writeStore(storePath, store);
  return store[sessionId];
}

export function loadRouteContext({
  storePath = DEFAULT_ROUTE_CONTEXT_PATH,
  claudeSessionId
}) {
  if (!claudeSessionId) {
    return {
      status: "missing",
      reason: "missing_claude_session_id",
      context: null
    };
  }

  const store = readStore(storePath);
  const context = store[claudeSessionId] || null;
  return context
    ? { status: "matched", reason: null, context }
    : { status: "missing", reason: "no_context_for_session", context: null };
}
