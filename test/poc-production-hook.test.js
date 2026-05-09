import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeProductionHookTurn } from "../src/poc/production_hook.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

const openaiTargets = readJson("../src/poc/data/targets.openai.json").targets;
const repoRoot = path.join(__dirname, "..");

test("production hook intercepts implement turn and executes safe repo action", () => {
  const result = executeProductionHookTurn({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced", turnCount: 3 },
    targets: openaiTargets,
    repoRoot,
    toolAction: "read_file"
  });

  assert.equal(result.status, "executed");
  assert.equal(result.route.mode, "implement");
  assert.equal(result.route.selectedTarget?.label, "best coder");
  assert.equal(result.execution.action, "read_file");
  assert.equal(result.execution.file, "package.json");
  assert.equal(result.nextSession.turnCount, 4);
  assert.equal(result.nextSession.currentTargetId, "openai-coder");
});

test("production hook keeps non-coder turns tool-free", () => {
  const result = executeProductionHookTurn({
    input: "Thanks, makes sense.",
    session: { mode: "plan", cost_posture: "balanced", turnCount: 0 },
    targets: openaiTargets,
    repoRoot
  });

  assert.equal(result.status, "executed_without_tools");
  assert.equal(result.route.selectedTarget?.label, "quick");
  assert.equal(result.execution.action, "none");
  assert.equal(result.nextSession.turnCount, 1);
});

test("production hook can execute test action via injected command runner", () => {
  const result = executeProductionHookTurn({
    input: "Implement the plan.",
    session: { mode: "plan", cost_posture: "balanced" },
    targets: openaiTargets,
    repoRoot,
    toolAction: "run_tests",
    runCommand: (command) => ({
      ok: true,
      command,
      stdout: "all tests passed",
      stderr: "",
      exitCode: 0
    })
  });

  assert.equal(result.status, "executed");
  assert.equal(result.execution.action, "run_tests");
  assert.equal(result.execution.command, "npm test");
  assert.equal(result.execution.exitCode, 0);
});
