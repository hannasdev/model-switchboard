import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeGatewayTurn } from "../src/poc/gateway_surface.js";
import { loadThreadSession, saveThreadSession } from "../src/poc/thread_session_store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/router/data/targets.openai.json").targets;
const storePath = path.join(__dirname, "..", "src", "poc", "logs", "thread-sessions.thread-test.json");

test("gateway threaded turns persist and advance session continuity", async () => {
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

  const adapter = {
    async executeRoutedTurn({ routeResult }) {
      return {
        status: "executed",
        adapter: "mock",
        targetId: routeResult.selectedTarget?.id,
        profile: "mock-profile",
        response: { result: "ok" }
      };
    }
  };

  const threadId = "thread-continuity-1";
  const initial = { mode: "plan", cost_posture: "balanced", currentTargetId: "openai-balanced", turnCount: 0 };

  const first = await executeGatewayTurn({
    request: { input: "Implement the plan.", session: initial },
    targets: openaiTargets,
    adapter,
    executionSupported: true
  });
  saveThreadSession({ storePath, threadId, session: first.nextSession });

  const resumed = loadThreadSession({ storePath, threadId });
  const second = await executeGatewayTurn({
    request: { input: "Thanks, that makes sense.", session: resumed },
    targets: openaiTargets,
    adapter,
    executionSupported: true
  });

  assert.equal(first.nextSession.turnCount, 1);
  assert.equal(first.nextSession.currentTargetId, "openai-coder");
  assert.equal(second.nextSession.turnCount, 2);
  assert.equal(second.nextSession.currentTargetId, "openai-quick");
});
