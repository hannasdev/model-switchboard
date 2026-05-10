import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_CLAUDE_HOOK_LOG_PATH,
  DEFAULT_ROUTE_CONTEXT_PATH,
  DEFAULT_SWITCHBOARD_LOG_PATH,
  DEFAULT_SWITCHBOARD_STATE_DIR,
  DEFAULT_SWITCHBOARD_STORE_PATH
} from "../src/switchboard/paths.js";
import {
  DEFAULT_SWITCHBOARD_LOG_PATH as PRODUCT_WORKFLOW_LOG_PATH,
  DEFAULT_SWITCHBOARD_STORE_PATH as PRODUCT_WORKFLOW_STORE_PATH
} from "../src/switchboard/workflow.js";
import { DEFAULT_ROUTE_CONTEXT_PATH as PRODUCT_ROUTE_CONTEXT_PATH } from "../src/switchboard/route_context.js";
import { DEFAULT_CLAUDE_HOOK_LOG_PATH as PRODUCT_HOOK_LOG_PATH } from "../src/switchboard/claude_hook_bridge.js";

test("product switchboard defaults resolve under the shared home-state directory", () => {
  const expectedDir = path.join(os.homedir(), ".model-switchboard");

  assert.equal(DEFAULT_SWITCHBOARD_STATE_DIR, expectedDir);
  assert.equal(DEFAULT_SWITCHBOARD_STORE_PATH, path.join(expectedDir, "switchboard-sessions.json"));
  assert.equal(DEFAULT_SWITCHBOARD_LOG_PATH, path.join(expectedDir, "switchboard-turns.ndjson"));
  assert.equal(DEFAULT_ROUTE_CONTEXT_PATH, path.join(expectedDir, "switchboard-route-context.json"));
  assert.equal(DEFAULT_CLAUDE_HOOK_LOG_PATH, path.join(expectedDir, "claude-hook-events.ndjson"));

  assert.equal(PRODUCT_WORKFLOW_STORE_PATH, DEFAULT_SWITCHBOARD_STORE_PATH);
  assert.equal(PRODUCT_WORKFLOW_LOG_PATH, DEFAULT_SWITCHBOARD_LOG_PATH);
  assert.equal(PRODUCT_ROUTE_CONTEXT_PATH, DEFAULT_ROUTE_CONTEXT_PATH);
  assert.equal(PRODUCT_HOOK_LOG_PATH, DEFAULT_CLAUDE_HOOK_LOG_PATH);
});
