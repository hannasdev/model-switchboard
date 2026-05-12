import { DEFAULT_ROUTE_CONTEXT_PATH } from "./paths.js";
import { readStore, writeStore } from "./fs-utils.js";

export { DEFAULT_ROUTE_CONTEXT_PATH } from "./paths.js";

function extractTurnFields(context = {}) {
	const sessionState = context.sessionState || null;
	const routingDecision = context.routingDecision || null;
	const contextPackage = context.contextPackage || null;
	const claudeExecution = context.claudeExecution || null;

	return {
		threadId:
			context.threadId ||
			sessionState?.threadId ||
			contextPackage?.threadId ||
			null,
		turnCount:
			context.turnCount ??
			sessionState?.turnCount ??
			contextPackage?.turnIndex ??
			null,
		routeLabel:
			context.routeLabel ||
			contextPackage?.routeLabel ||
			routingDecision?.selectedTarget?.label ||
			null,
		targetId:
			context.targetId ||
			contextPackage?.targetId ||
			routingDecision?.selectedTarget?.id ||
			sessionState?.currentTargetId ||
			null,
		model:
			context.model ||
			claudeExecution?.model ||
			null,
		effort:
			context.effort ||
			claudeExecution?.effort ||
			null,
		mode:
			context.mode ||
			routingDecision?.mode ||
			sessionState?.mode ||
			contextPackage?.mode ||
			null,
		executionMode:
			context.executionMode ||
			claudeExecution?.executionMode ||
			null,
		wrapperContext:
			context.wrapperContext ||
			contextPackage?.wrapperContext ||
			null
	};
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
	const legacy = extractTurnFields(context);
	const turn = {
		threadId: legacy.threadId,
		claudeSessionId: sessionId,
		turnCount: legacy.turnCount,
		routeLabel: legacy.routeLabel,
		targetId: legacy.targetId,
		model: legacy.model,
		effort: legacy.effort,
		mode: legacy.mode,
		executionMode: legacy.executionMode,
		wrapperContext: legacy.wrapperContext,
		sessionState: context.sessionState || null,
		routingDecision: context.routingDecision || null,
		contextPackage: context.contextPackage || null,
		claudeExecution: context.claudeExecution || null,
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