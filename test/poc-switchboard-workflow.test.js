import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeSwitchboardContinuityProbe,
  planSwitchboardContinuityProbe,
  planSwitchboardTurn
} from "../src/poc/switchboard_workflow.js";

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "switchboard-workflow-test-"));
  return {
    storePath: path.join(dir, "sessions.json"),
    logPath: path.join(dir, "turns.ndjson"),
    routeContextPath: path.join(dir, "route-context.json")
  };
}

function readLog(logPath) {
  return fs.readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
}

test("Switchboard turn plans Claude launch and records separable evidence", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const result = planSwitchboardTurn({
    input: "Implement the plan.",
    threadId: "thread-1",
    sessionId: "claude-session-1",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  assert.equal(result.status, "planned");
  assert.equal(result.routeDecision.label, "best coder");
  assert.equal(result.selectedClaude.model, "sonnet");
  assert.equal(result.selectedClaude.effort, "high");
  assert.equal(result.selectedClaude.sessionId, "claude-session-1");
  assert.match(result.wrapperContext.text, /^Switchboard: best coder/);
  assert.equal(result.nextSession.currentTargetId, "anthropic-coder");
  assert.equal(result.nextSession.turnCount, 1);

  const [entry] = readLog(logPath);
  assert.equal(entry.source, "switchboard_wrapper");
  assert.equal(entry.userPrompt, "Implement the plan.");
  assert.equal(entry.wrapperContext.kind, "switchboard_context");
  assert.equal(entry.routeDecision.label, "best coder");
  assert.equal(entry.selectedClaude.effort, "high");
  assert.equal(entry.session.claudeSessionId, "claude-session-1");

  const routeContext = JSON.parse(fs.readFileSync(routeContextPath, "utf8"));
  assert.equal(routeContext["claude-session-1"].latest.threadId, "thread-1");
  assert.equal(routeContext["claude-session-1"].latest.routeLabel, "best coder");
  assert.equal(routeContext["claude-session-1"].latest.model, "sonnet");
});

test("Switchboard continuity probe preserves Claude session while route changes", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const result = planSwitchboardContinuityProbe({
    threadId: "thread-2",
    sessionId: "claude-session-2",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath
  });

  assert.equal(result.status, "verified");
  assert.deepEqual(result.verified, {
    sameClaudeSession: true,
    routeCanChange: true,
    turnCountAdvanced: true
  });
  assert.equal(result.turns[0].routeDecision.label, "best coder");
  assert.equal(result.turns[1].routeDecision.label, "quick");
  assert.equal(result.turns[0].selectedClaude.sessionId, "claude-session-2");
  assert.equal(result.turns[1].selectedClaude.sessionId, "claude-session-2");
  assert.equal(result.turns[0].claudePlan.resume, false);
  assert.equal(result.turns[1].claudePlan.resume, true);
  assert.equal(result.turns[1].selectedClaude.commandPreview.includes("--resume"), true);
  assert.equal(result.turns[1].previousSession.currentTargetId, "anthropic-coder");
  assert.equal(result.turns[1].nextSession.turnCount, 2);

  const entries = readLog(logPath);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].routeDecision.label, "best coder");
  assert.equal(entries[1].routeDecision.label, "quick");
  assert.equal(entries[0].session.claudeSessionId, entries[1].session.claudeSessionId);
});

test("Live Switchboard continuity probe captures execution evidence", () => {
  const { storePath, logPath, routeContextPath } = tempPaths();
  const executions = [];
  const result = executeSwitchboardContinuityProbe({
    threadId: "thread-3",
    sessionId: "claude-session-3",
    cwd: "/repo",
    storePath,
    logPath,
    routeContextPath,
    noTools: true,
    commandRunner(plan) {
      executions.push(plan);
      return {
        status: 0,
        signal: null,
        stdout:
          executions.length === 1
            ? "{\"result\":\"OK\"}"
            : "{\"result\":\"switchboard-continuity-2718\"}",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(result.status, "verified");
  assert.deepEqual(result.verified, {
    bothExecuted: true,
    sameClaudeSession: true,
    routeCanChange: true,
    turnCountAdvanced: true,
    secondTurnHasFirstTurnContext: true
  });
  assert.equal(result.turns[0].status, "executed");
  assert.equal(result.turns[1].status, "executed");
  assert.equal(result.turns[0].execution.status, "executed");
  assert.match(result.turns[1].execution.stdoutPreview, /switchboard-continuity-2718/);
  assert.equal(result.turns[0].routeDecision.label, "best coder");
  assert.equal(result.turns[1].routeDecision.label, "balanced");
  assert.equal(executions[0].args.includes("--tools="), true);

  const entries = readLog(logPath);
  assert.equal(entries[0].executionMode, "live");
  assert.equal(entries[0].execution.status, "executed");
  assert.equal(entries[1].execution.stdoutPreview, "{\"result\":\"switchboard-continuity-2718\"}");
});
