import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeGatewayTurn } from "../src/poc/gateway_surface.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/poc/data/targets.openai.json").targets;

test("gateway surface routes before execution and dispatches selected target", async () => {
  let seenRoute = null;
  const adapter = {
    async executeRoutedTurn({ routeResult }) {
      seenRoute = routeResult;
      return {
        status: "executed",
        adapter: "mock",
        targetId: routeResult.selectedTarget?.id,
        profile: "codex-best-coder",
        response: { result: "ok" }
      };
    }
  };

  const result = await executeGatewayTurn({
    request: {
      input: "Implement the plan.",
      session: { mode: "plan", cost_posture: "balanced", turnCount: 2 }
    },
    targets: openaiTargets,
    adapter,
    executionSupported: true
  });

  assert.equal(result.status, "executed");
  assert.equal(result.route.selectedTarget?.id, "openai-coder");
  assert.equal(seenRoute?.selectedTarget?.id, "openai-coder");
  assert.ok(result.hookEvidence.receivedAt <= result.hookEvidence.routedAt);
  assert.ok(result.hookEvidence.routedAt <= result.hookEvidence.dispatchedAt);
  assert.equal(result.nextSession.turnCount, 3);
  assert.equal(result.nextSession.currentTargetId, "openai-coder");
});

test("gateway surface refuses execution when no eligible target exists", async () => {
  const quickOnly = openaiTargets.filter((t) => t.label === "quick");
  const adapter = {
    async executeRoutedTurn() {
      throw new Error("should_not_execute");
    }
  };

  const result = await executeGatewayTurn({
    request: {
      input: "Implement the plan.",
      session: { mode: "plan", cost_posture: "balanced", turnCount: 0 }
    },
    targets: quickOnly,
    adapter,
    executionSupported: true
  });

  assert.equal(result.status, "not_executed");
  assert.equal(result.reason, "route_not_ok");
  assert.equal(result.route.status, "refused");
  assert.equal(result.hookEvidence.dispatchedAt, null);
  assert.equal(result.nextSession.turnCount, 1);
});
